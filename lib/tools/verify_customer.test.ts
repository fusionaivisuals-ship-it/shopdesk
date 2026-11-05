// verify_customer tests (D-02b, D-03b, D-04, D-21, D-29). Fictional data only, no Claude API calls.
import { describe, it, expect } from "vitest";
import { verifyCustomer, definition } from "./verify_customer";
import { memoryStore } from "./store";

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 5, 15, 0);
const ctx = (over: Partial<{ conversationId: string; visitorId: string; now: number }> = {}) =>
  ({ conversationId: "conv_1", visitorId: "vis_1", now: T0, ...over });

describe("verify_customer", () => {
  it("matching email + order -> verified, conversation flag set by code", () => {
    const store = memoryStore();
    const r = verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx(), store);
    expect(r.ok).toBe(true);
    expect(store.getVerifiedCustomer("conv_1")).toBe("cus_1");
  });

  it("tolerates spacing and letter case", () => {
    const r = verifyCustomer({ email: "  Mei.Lin@Example.com ", order_number: "gc-1042" }, ctx(), memoryStore());
    expect(r.ok).toBe(true);
  });

  it("wrong email and non-existent order give the SAME generic result (no enumeration)", () => {
    const a = verifyCustomer({ email: "sam.carter@example.com", order_number: "GC-1042" }, ctx(), memoryStore());
    const b = verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-9999" }, ctx(), memoryStore());
    expect(a).toEqual(b);
    expect(a).toMatchObject({ ok: false, reason: "no_match", attempts_left: 2 });
  });

  it("result never contains customer data or the detailed reason", () => {
    const store = memoryStore();
    const fail = verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx(), store);
    const ok = verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx({ conversationId: "c2", visitorId: "v2" }), store);
    const text = JSON.stringify([fail, ok]);
    expect(text).not.toMatch(/Mei|cus_1|email_mismatch|order_not_found/);
    expect(store.logs).toContainEqual(expect.objectContaining({ detail: "email_mismatch" })); // detail goes to the staff log
  });

  it("3rd failure locks for 15 min; correct details during the lock are refused", () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx({ now: T0 + i * MIN }), store);
    const r = verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx({ now: T0 + 5 * MIN }), store);
    expect(r).toMatchObject({ ok: false, locked: true });
    expect(store.getVerifiedCustomer("conv_1")).toBeNull();
  });

  it("order lock follows the order into a new chat with a new browser (D-03b)", () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx({ now: T0 + i * MIN }), store);
    const r = verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx({ conversationId: "new", visitorId: "new", now: T0 + 5 * MIN }), store);
    expect(r).toMatchObject({ ok: false, locked: true });
  });

  it("6th failure -> person only, exactly one ticket", () => {
    const store = memoryStore();
    for (let i = 0; i < 3; i++) verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx({ now: T0 + i * MIN }), store);
    for (let i = 0; i < 3; i++) verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx({ now: T0 + (20 + i) * MIN }), store);
    const r = verifyCustomer({ email: "x@example.com", order_number: "GC-1042" }, ctx({ now: T0 + 30 * MIN }), store);
    expect(r).toMatchObject({ ok: false, locked: true, unlock_in_minutes: null });
    expect(store.tickets).toHaveLength(1);
  });

  it("description covers when to use, when not, results and examples (D-29)", () => {
    for (const part of ["USE IT", "DO NOT USE IT", "RESULTS", "EXAMPLES", "search_policy", "list_orders"]) {
      expect(definition.description).toContain(part);
    }
  });
});
