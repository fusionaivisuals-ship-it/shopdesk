// list_orders tests (D-05, D-06, D-30). Fictional data only, no Claude API calls.
import { describe, it, expect } from "vitest";
import { listOrders } from "./list_orders";
import { verifyCustomer } from "./verify_customer";
import { memoryStore } from "./store";

const ctx = { conversationId: "conv_1", visitorId: "vis_1", now: Date.UTC(2026, 10, 6) };
const verified = (opts = {}) => {
  const store = memoryStore(opts);
  verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx, store);
  return store;
};

describe("list_orders", () => {
  it("returns only the verified customer's orders, summary fields only", () => {
    const r = listOrders({}, ctx, verified());
    expect(r).toEqual({
      orders: [
        { number: "GC-1042", placed: "2026-10-20", status: "delivered" },
        { number: "GC-1043", placed: "2026-11-01", status: "shipped" },
      ],
    });
    expect(JSON.stringify(r)).not.toContain("GC-2001"); // another customer's order
  });

  it("not verified -> permission error pointing to verify_customer", () => {
    const r = listOrders({}, ctx, memoryStore());
    expect(r).toMatchObject({ isError: true, category: "permission", retryable: false });
    expect((r as any).next_step).toContain("verify_customer");
  });

  it("database down -> transient error, NOT an empty list (D-30)", () => {
    const store = verified({ down: true });
    const r = listOrders({}, ctx, store);
    expect(r).toMatchObject({ isError: true, category: "transient", retryable: true });
    expect(r).not.toHaveProperty("orders");
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "list_orders_failed" }));
  });
});
