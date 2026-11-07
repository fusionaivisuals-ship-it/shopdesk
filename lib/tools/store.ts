// Storage the tools use (D-15, D-34). Two implementations of ONE interface:
// - memoryStore(): for unit tests (fast, $0, same result every run, D-16)
// - neonStore(url): the real Neon Postgres database in Singapore (D-35)
// Every method is async because a real database answers asynchronously.
import { neon } from "@neondatabase/serverless";
import { customers, orders, type Customer, type Order } from "../../data/shop";
import { emptyCounter, type Counter } from "../rules/lock";

export type Store = {
  findOrder(number: string): Promise<Order | null>;
  findCustomer(id: string): Promise<Customer | null>;
  listOrdersFor(customerId: string): Promise<Order[]>; // throws when the database is unavailable
  getCounter(key: string): Promise<Counter>;
  setCounter(key: string, c: Counter): Promise<void>;
  getVerifiedCustomer(conversationId: string): Promise<string | null>;
  setVerifiedCustomer(conversationId: string, customerId: string): Promise<void>;
  createTicket(t: { kind: string; orderNumber: string; conversationId: string }): Promise<void>;
  log(entry: Record<string, unknown>): Promise<void>; // staff only, never shown to Claude (D-04)
};

export function memoryStore(opts: { down?: boolean } = {}): Store & { tickets: unknown[]; logs: unknown[] } {
  const counters = new Map<string, Counter>();
  const verified = new Map<string, string>();
  const tickets: unknown[] = [];
  const logs: unknown[] = [];
  return {
    tickets,
    logs,
    findOrder: async (n) => orders.find((o) => o.number === n) ?? null,
    findCustomer: async (id) => customers.find((c) => c.id === id) ?? null,
    listOrdersFor: async (id) => {
      if (opts.down) throw new Error("connection timeout"); // simulated outage for tests (D-30)
      return orders.filter((o) => o.customerId === id);
    },
    getCounter: async (k) => counters.get(k) ?? emptyCounter(),
    setCounter: async (k, c) => void counters.set(k, c),
    getVerifiedCustomer: async (id) => verified.get(id) ?? null,
    setVerifiedCustomer: async (id, cus) => void verified.set(id, cus),
    createTicket: async (t) => void tickets.push(t),
    log: async (e) => void logs.push(e),
  };
}

export function neonStore(databaseUrl: string): Store {
  const sql = neon(databaseUrl);
  const toOrder = (r: any): Order => ({
    number: r.number,
    customerId: r.customer_id,
    status: r.status,
    placedAt: r.placed_at, // selected as text in SQL: a JS Date would shift the day by timezone
  });
  return {
    async findOrder(n) {
      const rows = await sql`SELECT number, customer_id, status, placed_at::text AS placed_at FROM orders WHERE number = ${n}`;
      return rows[0] ? toOrder(rows[0]) : null;
    },
    async findCustomer(id) {
      const rows = await sql`SELECT id, email, name FROM customers WHERE id = ${id}`;
      return (rows[0] as Customer) ?? null;
    },
    async listOrdersFor(id) {
      const rows = await sql`SELECT number, customer_id, status, placed_at::text AS placed_at FROM orders WHERE customer_id = ${id} ORDER BY placed_at`;
      return rows.map(toOrder);
    },
    async getCounter(k) {
      const rows = await sql`SELECT failures, reset_at FROM attempt_counters WHERE key = ${k}`;
      if (!rows[0]) return emptyCounter();
      return {
        failures: (rows[0].failures as (string | Date)[]).map((t) => new Date(t).getTime()),
        resetAt: new Date(rows[0].reset_at as string).getTime(),
      };
    },
    async setCounter(k, c) {
      const failures = c.failures.map((t) => new Date(t).toISOString());
      const resetAt = new Date(c.resetAt).toISOString();
      await sql`INSERT INTO attempt_counters (key, failures, reset_at)
                VALUES (${k}, ${failures}::timestamptz[], ${resetAt})
                ON CONFLICT (key) DO UPDATE SET failures = EXCLUDED.failures, reset_at = EXCLUDED.reset_at`;
    },
    async getVerifiedCustomer(id) {
      const rows = await sql`SELECT verified_customer_id FROM conversations WHERE id = ${id}`;
      return (rows[0]?.verified_customer_id as string) ?? null;
    },
    async setVerifiedCustomer(id, cus) {
      await sql`INSERT INTO conversations (id, verified_customer_id, verified_at) VALUES (${id}, ${cus}, now())
                ON CONFLICT (id) DO UPDATE SET verified_customer_id = EXCLUDED.verified_customer_id, verified_at = now()`;
    },
    async createTicket(t) {
      await sql`INSERT INTO tickets (kind, order_number, conversation_id) VALUES (${t.kind}, ${t.orderNumber}, ${t.conversationId})`;
    },
    async log(e) {
      await sql`INSERT INTO staff_log (event, detail) VALUES (${String(e.event ?? "event")}, ${JSON.stringify(e)}::jsonb)`;
    },
  };
}
