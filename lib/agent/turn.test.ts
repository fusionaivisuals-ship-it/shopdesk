// Fixed-shell tests (D-36, D-44). Scripted Claude, fictional data, $0.
import { describe, it, expect } from "vitest";
import { handleMessage } from "./turn";
import { memoryStore } from "../tools/store";
import { BUDGET, OVER_DAILY, OVER_VISITOR, costCents, taipeiDay } from "../rules/budget";
import type { Claude, ClaudeReply } from "./loop";

const NOW = Date.UTC(2026, 10, 8, 2); // 10:00 Taipei
function scripted(replies: ClaudeReply[]) {
  let calls = 0;
  const claude: Claude = { async create() { calls++; const n = replies.shift(); if (!n) throw new Error("script ran out"); return n; } };
  return { claude, calls: () => calls };
}
const answer = (t: string, input = 1000, output = 200): ClaudeReply =>
  ({ stop_reason: "end_turn", content: [{ type: "text", text: t }], usage: { input_tokens: input, output_tokens: output } });

describe("fixed shell around each message", () => {
  it("answers, saves the conversation, and records spend from the reported tokens", async () => {
    const store = memoryStore();
    const { claude } = scripted([answer("We ship to Japan.", 1000, 200)]);
    const r = await handleMessage({ claude, store, conversationId: "c1", visitorId: "v1", text: "Do you ship to Japan?", now: NOW });
    expect(r).toEqual({ reply: "We ship to Japan.", status: "answered" });
    expect(await store.loadMessages("c1")).toHaveLength(2); // user + assistant saved
    expect(await store.getSpent(taipeiDay(NOW))).toBeCloseTo(costCents({ input_tokens: 1000, output_tokens: 200 }));
  });

  it("the next message loads the saved conversation from the database", async () => {
    const store = memoryStore();
    await handleMessage({ claude: scripted([answer("Hi!")]).claude, store, conversationId: "c1", visitorId: "v1", text: "hello", now: NOW });
    await handleMessage({ claude: scripted([answer("Sure.")]).claude, store, conversationId: "c1", visitorId: "v1", text: "and returns?", now: NOW });
    expect(await store.loadMessages("c1")).toHaveLength(4);
  });

  it("over the daily total: Claude is NOT called, polite fixed message, $0 spent", async () => {
    const store = memoryStore();
    await store.addSpent(taipeiDay(NOW), BUDGET.dailyCents);
    const s = scripted([]);
    const r = await handleMessage({ claude: s.claude, store, conversationId: "c1", visitorId: "v1", text: "hi", now: NOW });
    expect(r).toEqual({ reply: OVER_DAILY, status: "over_daily_cap" });
    expect(s.calls()).toBe(0);
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "budget_block", reason: "daily_cap" }));
  });

  it("one visitor over their limit is blocked; another visitor still gets answers", async () => {
    const store = memoryStore();
    const day = taipeiDay(NOW);
    for (let i = 0; i < BUDGET.visitorMessagesPerDay; i++) await store.addVisitorMessage("heavy", day);
    const blocked = await handleMessage({ claude: scripted([]).claude, store, conversationId: "c1", visitorId: "heavy", text: "hi", now: NOW });
    expect(blocked).toEqual({ reply: OVER_VISITOR, status: "over_visitor_limit" });
    const other = await handleMessage({ claude: scripted([answer("Hello!")]).claude, store, conversationId: "c2", visitorId: "light", text: "hi", now: NOW });
    expect(other.status).toBe("answered");
  });

  it("the budget day is the Taipei calendar day (resets at midnight Taipei, not UTC)", () => {
    expect(taipeiDay(Date.UTC(2026, 10, 8, 15, 59))).toBe("2026-11-08"); // 23:59 Taipei
    expect(taipeiDay(Date.UTC(2026, 10, 8, 16, 0))).toBe("2026-11-09");  // 00:00 Taipei
  });
});
