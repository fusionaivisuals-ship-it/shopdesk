// Cost and rate rules (D-44, SECURITY.md G6-G8). Pure functions, $0.
import { describe, it, expect } from "vitest";
import { BUDGET, RATE_RULES, checkBudget, conversationFull, overRate, windowStart } from "./budget";

describe("budget rules", () => {
  it("allows a turn only if its reservation still fits under the daily cap", () => {
    expect(checkBudget(BUDGET.dailyCents - BUDGET.reserveCentsPerTurn, 0).ok).toBe(true);
    expect(checkBudget(BUDGET.dailyCents - BUDGET.reserveCentsPerTurn + 0.01, 0).ok).toBe(false);
  });
  it("same window for every request in the same minute; a new minute starts fresh", () => {
    const m = RATE_RULES.chatMinute.windowMs;
    expect(windowStart(120_000 + 59_999, m)).toBe(120_000);
    expect(windowStart(180_000, m)).toBe(180_000);
  });
  it("the request that goes past the limit is the one refused", () => {
    expect(overRate(RATE_RULES.chatMinute.limit, RATE_RULES.chatMinute)).toBe(false);
    expect(overRate(RATE_RULES.chatMinute.limit + 1, RATE_RULES.chatMinute)).toBe(true);
  });
  it("conversation length counts customer messages only, not tool results", () => {
    const toolResult = { role: "user", content: [{ type: "tool_result" }] };
    const hist = Array.from({ length: BUDGET.customerMessagesPerConversation - 1 }, () => ({ role: "user", content: "q" }));
    expect(conversationFull([...hist, toolResult, toolResult])).toBe(false);
    expect(conversationFull([...hist, { role: "user", content: "q" }])).toBe(true);
  });
});
