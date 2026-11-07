// Storage the tools use (D-15, D-34). Two implementations of ONE interface:
// - memoryStore(): for unit tests (fast, $0, same result every run, D-16)
// - neonStore(url): the real Neon Postgres database in Singapore (D-35)
// Every method is async because a real database answers asynchronously.
import { neon } from "@neondatabase/serverless";
import { customers, orders, type Customer, type Order } from "../../data/shop";
import { policies, type Policy } from "../../data/policies";
import { emptyCounter, type Counter } from "../rules/lock";

// A handoff ticket (D-38). Facts are filled by code; customerWants is the only model-written field.
export type Ticket = {
  kind: string; // "verification_locked" | "reaction" | "customer_request" | ...
  priority: "normal" | "urgent";
  conversationId: string;
  customerId: string | null; // null = not verified
  createdAt: number;
  details: Record<string, unknown>;
};

export type Store = {
  findOrder(number: string): Promise<Order | null>;
  findCustomer(id: string): Promise<Customer | null>;
  listOrdersFor(customerId: string): Promise<Order[]>; // throws when the database is unavailable
  getCounter(key: string): Promise<Counter>;
  setCounter(key: string, c: Counter): Promise<void>;
  getVerifiedCustomer(conversationId: string): Promise<string | null>;
  setVerifiedCustomer(conversationId: string, customerId: string): Promise<void>;
  createTicket(t: Ticket): Promise<void>;
  ticketCountsByKind(customerId: string, sinceMs: number): Promise<Record<string, number>>; // D-38b
  recentTicketsFor(customerId: string, sinceMs: number): Promise<Ticket[]>; // D-42
  currentPolicies(): Promise<Policy[]>; // never superseded versions (D-10); throws when unavailable
  // D-44 spend cap + D-36 shell
  getSpent(day: string): Promise<number>;
  addSpent(day: string, cents: number): Promise<void>;
  getVisitorMessages(visitorId: string, day: string): Promise<number>;
  addVisitorMessage(visitorId: string, day: string): Promise<void>;
  loadMessages(conversationId: string): Promise<{ role: "user" | "assistant"; content: unknown }[]>;
  appendMessages(conversationId: string, fromSeq: number, msgs: { role: "user" | "assistant"; content: unknown }[]): Promise<void>;
  log(entry: Record<string, unknown>): Promise<void>; // staff only, never shown to Claude (D-04)
};

export function memoryStore(opts: { down?: boolean } = {}): Store & { tickets: Ticket[]; logs: unknown[] } {
  const counters = new Map<string, Counter>();
  const verified = new Map<string, string>();
  const tickets: Ticket[] = [];
  const spent = new Map<string, number>();
  const visitorMsgs = new Map<string, number>();
  const convMsgs = new Map<string, { role: "user" | "assistant"; content: unknown }[]>();
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
    getSpent: async (d) => spent.get(d) ?? 0,
    addSpent: async (d, c) => void spent.set(d, (spent.get(d) ?? 0) + c),
    getVisitorMessages: async (v, d) => visitorMsgs.get(`${v}|${d}`) ?? 0,
    addVisitorMessage: async (v, d) => void visitorMsgs.set(`${v}|${d}`, (visitorMsgs.get(`${v}|${d}`) ?? 0) + 1),
    loadMessages: async (id) => [...(convMsgs.get(id) ?? [])],
    appendMessages: async (id, from, msgs) => {
      const list = convMsgs.get(id) ?? [];
      if (list.length !== from) throw new Error(`conversation ${id} changed concurrently`);
      convMsgs.set(id, [...list, ...msgs]);
    },
    currentPolicies: async () => {
      if (opts.down) throw new Error("connection timeout"); // simulated outage (D-43)
      return policies.filter((p) => p.supersededOn === null);
    },
    recentTicketsFor: async (cus, since) => tickets.filter((t) => t.customerId === cus && t.createdAt >= since),
    ticketCountsByKind: async (cus, since) => {
      const counts: Record<string, number> = {};
      for (const t of tickets) if (t.customerId === cus && t.createdAt >= since) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
      return counts;
    },
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
      await sql`INSERT INTO tickets (kind, order_number, conversation_id, customer_id, priority, details, created_at)
                VALUES (${t.kind}, ${(t.details.orderNumber as string) ?? null}, ${t.conversationId}, ${t.customerId},
                        ${t.priority}, ${JSON.stringify(t.details)}::jsonb, ${new Date(t.createdAt).toISOString()})`;
    },
    async getSpent(d) {
      const rows = await sql`SELECT cents FROM spend_ledger WHERE day = ${d}`;
      return rows[0] ? Number(rows[0].cents) : 0;
    },
    async addSpent(d, c) {
      await sql`INSERT INTO spend_ledger (day, cents) VALUES (${d}, ${c})
                ON CONFLICT (day) DO UPDATE SET cents = spend_ledger.cents + EXCLUDED.cents`;
    },
    async getVisitorMessages(v, d) {
      const rows = await sql`SELECT messages FROM visitor_usage WHERE visitor_id = ${v} AND day = ${d}`;
      return rows[0] ? Number(rows[0].messages) : 0;
    },
    async addVisitorMessage(v, d) {
      await sql`INSERT INTO visitor_usage (visitor_id, day, messages) VALUES (${v}, ${d}, 1)
                ON CONFLICT (visitor_id, day) DO UPDATE SET messages = visitor_usage.messages + 1`;
    },
    async loadMessages(id) {
      const rows = await sql`SELECT role, content FROM messages WHERE conversation_id = ${id} ORDER BY seq`;
      return rows.map((r: any) => ({ role: r.role, content: r.content }));
    },
    async appendMessages(id, from, msgs) {
      // seq is part of the primary key: if another request already wrote these positions, this fails
      // instead of silently interleaving two turns.
      for (let i = 0; i < msgs.length; i++) {
        await sql`INSERT INTO messages (conversation_id, seq, role, content)
                  VALUES (${id}, ${from + i}, ${msgs[i].role}, ${JSON.stringify(msgs[i].content)}::jsonb)`;
      }
    },
    async currentPolicies() {
      const rows = await sql`SELECT section, version, title, effective_from::text AS effective_from, body
                             FROM policies WHERE superseded_on IS NULL ORDER BY section`;
      return rows.map((r: any) => ({ section: r.section, version: r.version, title: r.title, effectiveFrom: r.effective_from, supersededOn: null, body: r.body }));
    },
    async recentTicketsFor(cus, since) {
      const rows = await sql`SELECT kind, priority, conversation_id, customer_id, details, status, created_at FROM tickets
                             WHERE customer_id = ${cus} AND created_at >= ${new Date(since).toISOString()} ORDER BY created_at`;
      return rows.map((r: any) => ({
        kind: r.kind, priority: r.priority, conversationId: r.conversation_id, customerId: r.customer_id,
        createdAt: new Date(r.created_at).getTime(), details: { ...r.details, status: r.status },
      }));
    },
    async ticketCountsByKind(cus, since) {
      const rows = await sql`SELECT kind, count(*)::int AS n FROM tickets
                             WHERE customer_id = ${cus} AND created_at >= ${new Date(since).toISOString()} GROUP BY kind`;
      return Object.fromEntries(rows.map((r: any) => [r.kind, r.n]));
    },
    async log(e) {
      await sql`INSERT INTO staff_log (event, detail) VALUES (${String(e.event ?? "event")}, ${JSON.stringify(e)}::jsonb)`;
    },
  };
}
