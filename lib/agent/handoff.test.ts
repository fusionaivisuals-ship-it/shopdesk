// Handoff ticket tests (D-38, D-38b). Fictional data, no Claude API calls.
import { describe, it, expect } from "vitest";
import { buildTicket } from "./handoff";
import { memoryStore } from "../tools/store";
import { verifyCustomer } from "../tools/verify_customer";
import type { Message } from "./loop";

const DAY = 24 * 60 * 60_000;
const NOW = Date.UTC(2026, 10, 7);
const ctx = { conversationId: "conv_1", visitorId: "vis_1", now: NOW };

// A conversation where Claude verified the customer and listed orders.
const convo: Message[] = [
  { role: "user", content: "I'm mei.lin@example.com, order GC-1042. The serum burns my skin." },
  { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "verify_customer", input: { email: "mei.lin@example.com", order_number: "GC-1042" } }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ ok: true, next_step: "..." }) }] },
  { role: "assistant", content: [{ type: "tool_use", id: "t2", name: "list_orders", input: {} }] },
  { role: "user", content: [{ type: "tool_result", tool_use_id: "t2", content: JSON.stringify({ orders: [{ number: "GC-1042" }, { number: "GC-1043" }] }) }] },
];

async function verifiedStore() {
  const store = memoryStore();
  await verifyCustomer({ email: "mei.lin@example.com", order_number: "GC-1042" }, ctx, store);
  return store;
}

describe("handoff ticket", () => {
  it("reaction -> urgent, facts filled by code from the conversation", async () => {
    const t = await buildTicket({ kind: "reaction", messages: convo, customerWants: "Serum caused a burning feeling", ctx, store: await verifiedStore() });
    expect(t.priority).toBe("urgent");
    expect(t.customerId).toBe("cus_1");
    expect(t.details).toMatchObject({
      customer: { verified: true, id: "cus_1" },
      customerWants: "Serum caused a burning feeling",
      ordersMentioned: ["GC-1042", "GC-1043"],
      actionsTaken: [
        { tool: "verify_customer", outcome: "verified" },
        { tool: "list_orders", outcome: "2 order(s) listed" },
      ],
    });
  });

  it("button handoff (no model involved) -> customerWants is null, every fact still present (D-09)", async () => {
    const t = await buildTicket({ kind: "customer_request", messages: convo, customerWants: null, ctx, store: await verifiedStore() });
    expect(t.details.customerWants).toBeNull();
    expect(t.details.actionsTaken).toHaveLength(2);
    expect(t.priority).toBe("normal");
  });

  it("not verified -> no customer id and NO history (would leak someone else's history)", async () => {
    const t = await buildTicket({ kind: "customer_request", messages: [{ role: "user", content: "help" }], customerWants: null, ctx, store: memoryStore() });
    expect(t.details.customer).toEqual({ verified: false });
    expect(t.details.history60d).toBeNull();
  });

  it("60-day history: neutral counts by type, older tickets excluded (D-38b)", async () => {
    const store = await verifiedStore();
    const old = { priority: "normal" as const, conversationId: "x", customerId: "cus_1", details: {} };
    await store.createTicket({ ...old, kind: "delivery_problem", createdAt: NOW - 10 * DAY });
    await store.createTicket({ ...old, kind: "delivery_problem", createdAt: NOW - 40 * DAY });
    await store.createTicket({ ...old, kind: "customer_request", createdAt: NOW - 59 * DAY });
    await store.createTicket({ ...old, kind: "delivery_problem", createdAt: NOW - 90 * DAY }); // too old
    await store.createTicket({ ...old, kind: "delivery_problem", customerId: "cus_2", createdAt: NOW - 5 * DAY }); // other customer
    const t = await buildTicket({ kind: "customer_request", messages: convo, customerWants: null, ctx, store });
    expect(t.details.history60d).toEqual({ delivery_problem: 2, customer_request: 1 });
  });
});
