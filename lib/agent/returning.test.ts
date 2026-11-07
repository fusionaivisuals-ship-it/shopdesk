// Returning-customer tests (D-42). Fictional data, no model calls.
import { describe, it, expect } from "vitest";
import { memoryStore } from "../tools/store";
import { verifyCustomer } from "../tools/verify_customer";

const HOUR = 60 * 60_000;
const NOW = Date.UTC(2026, 10, 7, 10);
const mei = { email: "mei.lin@example.com", order_number: "GC-1042" };
const ticket = (hoursAgo: number, conv = "yesterday") => ({
  kind: "reaction", priority: "urgent" as const, conversationId: conv, customerId: "cus_1",
  createdAt: NOW - hoursAgo * HOUR, details: { ordersMentioned: ["GC-1043"] },
});

describe("returning customer (D-42)", () => {
  it("after verification, recent contact (last 48h) is included as a summary from records", async () => {
    const store = memoryStore();
    await store.createTicket(ticket(20));
    const r: any = await verifyCustomer(mei, { conversationId: "today", visitorId: "v", now: NOW }, store);
    expect(r.ok).toBe(true);
    expect(r.recent_contact).toContain("reported a possible skin reaction");
    expect(r.recent_contact).toContain("GC-1043");
    expect(r.recent_contact).toContain("Look up anything current");
  });

  it("contact older than 48 hours is not carried over", async () => {
    const store = memoryStore();
    await store.createTicket(ticket(50));
    const r: any = await verifyCustomer(mei, { conversationId: "today", visitorId: "v", now: NOW }, store);
    expect(r.recent_contact).toBeUndefined();
  });

  it("nothing about past contact appears before verification succeeds (same browser, different person)", async () => {
    const store = memoryStore();
    await store.createTicket(ticket(20));
    const r: any = await verifyCustomer({ email: "someone.else@example.com", order_number: "GC-1042" }, { conversationId: "today", visitorId: "v", now: NOW }, store);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/reaction|GC-1043|recent/);
  });

  it("a new conversation is never verified just because an old one was (no resumed verification)", async () => {
    const store = memoryStore();
    await verifyCustomer(mei, { conversationId: "yesterday", visitorId: "v", now: NOW - 20 * HOUR }, store);
    expect(await store.getVerifiedCustomer("today")).toBeNull();
  });
});
