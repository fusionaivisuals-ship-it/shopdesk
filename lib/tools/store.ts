// Storage the tools use. In-memory for now; replaced by Neon Postgres in Domain 2 (D-15).
// Tools depend on this interface, not on a database, so the swap doesn't change them.
import { customers, orders, type Customer, type Order } from "../../data/shop";
import { emptyCounter, type Counter } from "../rules/lock";

export type Store = {
  findOrder(number: string): Order | null;
  findCustomer(id: string): Customer | null;
  getCounter(key: string): Counter;
  setCounter(key: string, c: Counter): void;
  getVerifiedCustomer(conversationId: string): string | null;
  setVerifiedCustomer(conversationId: string, customerId: string): void;
  createTicket(t: { kind: string; orderNumber: string; conversationId: string }): void;
  log(entry: Record<string, unknown>): void; // server log: staff only, never shown to Claude (D-04)
};

export function memoryStore(): Store & { tickets: unknown[]; logs: unknown[] } {
  const counters = new Map<string, Counter>();
  const verified = new Map<string, string>();
  const tickets: unknown[] = [];
  const logs: unknown[] = [];
  return {
    tickets,
    logs,
    findOrder: (n) => orders.find((o) => o.number === n) ?? null,
    findCustomer: (id) => customers.find((c) => c.id === id) ?? null,
    getCounter: (k) => counters.get(k) ?? emptyCounter(),
    setCounter: (k, c) => void counters.set(k, c),
    getVerifiedCustomer: (id) => verified.get(id) ?? null,
    setVerifiedCustomer: (id, cus) => void verified.set(id, cus),
    createTicket: (t) => void tickets.push(t),
    log: (e) => void logs.push(e),
  };
}
