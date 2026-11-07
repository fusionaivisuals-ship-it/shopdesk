// Investigator handoff tests (D-41). Pure code, no model calls, $0.
import { describe, it, expect } from "vitest";
import { subagentTask, mergeFindings, type Finding } from "./findings";

const f = (claim: string, conv: string, certain = true): Finding => ({
  claim, evidence: "quote", source: { conversationId: conv, messageIndex: 4, tool: "list_orders", at: "2026-11-06T10:00:00Z" }, certain,
});

describe("investigator handoff", () => {
  it("the subagent's task carries everything it needs: goal, chats, constraints, prior findings with sources", () => {
    const task = subagentTask({
      role: "tool-log checker",
      goal: "Find why these chats hit the 8-round cap",
      conversationIds: ["c1", "c2"],
      constraints: ["The lock rule changed on 2026-11-05"],
      priorFindings: [f("list_orders timed out", "c1")],
    });
    for (const must of ["no other context", "c1, c2", "lock rule changed on 2026-11-05", "list_orders timed out", "\"conversationId\":\"c1\"", "certain=false"]) {
      expect(task).toContain(must);
    }
  });

  it("findings without a source are rejected by code", () => {
    const { accepted, rejected } = mergeFindings([f("ok", "c1"), { claim: "vague", evidence: "x", certain: true } as any]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("conflicting findings are BOTH kept, never silently dropped", () => {
    const a = f("Customer was verified before list_orders", "c7");
    const b = f("Customer was NOT verified before list_orders", "c7", false);
    const { accepted } = mergeFindings([a], [b]);
    expect(accepted).toEqual([a, b]);
  });
});
