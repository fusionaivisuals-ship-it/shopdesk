// Hook + report_reaction tests (D-08, D-38, D-39). Scripted Claude, fictional data, $0.
import { describe, it, expect } from "vitest";
import { runTurn, type Claude, type ClaudeReply, type Message } from "./loop";
import { beforeTool } from "./hooks";
import { memoryStore } from "../tools/store";
import { SAFETY_MESSAGE } from "../tools/report_reaction";

const ctx = { conversationId: "conv_1", visitorId: "vis_1", now: Date.UTC(2026, 10, 7) };
const text = (t: string) => ({ type: "text" as const, text: t });
const use = (id: string, name: string, input: any = {}) => ({ type: "tool_use" as const, id, name, input });
function scripted(replies: ClaudeReply[]) {
  const seen: Message[][] = [];
  const claude: Claude = { async create(req) { seen.push(JSON.parse(JSON.stringify(req.messages))); const n = replies.shift(); if (!n) throw new Error("script ran out"); return n; } };
  return { claude, seen };
}

describe("report_reaction + conversation hook", () => {
  it("reaction -> exactly one URGENT ticket, and the customer gets the FIXED safety message (not Claude's words)", async () => {
    const store = memoryStore();
    const { claude } = scripted([
      { stop_reason: "tool_use", content: [use("r1", "report_reaction", { what_happened: "Vitamin C serum, burning after first use" })] },
      { stop_reason: "end_turn", content: [text("Try some aloe vera, it should calm down soon.")] }, // unsafe advice from the model
    ]);
    const r = await runTurn({ claude, system: "", history: [{ role: "user", content: "The serum burns my face" }], ctx, store });
    expect(r.reply).toBe(SAFETY_MESSAGE);
    expect(r.reply).not.toContain("aloe");
    expect(store.tickets).toHaveLength(1);
    expect(store.tickets[0]).toMatchObject({ kind: "reaction", priority: "urgent", details: { customerWants: "Vitamin C serum, burning after first use" } });
  });

  it("after a reaction, other tools are blocked in the SAME turn", async () => {
    const store = memoryStore();
    const { claude, seen } = scripted([
      { stop_reason: "tool_use", content: [use("r1", "report_reaction", { what_happened: "rash" })] },
      { stop_reason: "tool_use", content: [use("t2", "list_orders")] },
      { stop_reason: "end_turn", content: [text("ok")] },
    ]);
    await runTurn({ claude, system: "", history: [{ role: "user", content: "rash, where is my order" }], ctx, store });
    const blocked = (seen[2].at(-1)!.content as any[])[0];
    expect(blocked.is_error).toBe(true);
    expect(JSON.parse(blocked.content).category).toBe("business");
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "tool_blocked_by_hook", tool: "list_orders" }));
  });

  it("...and in LATER turns of the same conversation", async () => {
    const store = memoryStore();
    const first = scripted([
      { stop_reason: "tool_use", content: [use("r1", "report_reaction", { what_happened: "redness" })] },
      { stop_reason: "end_turn", content: [text("x")] },
    ]);
    const t1 = await runTurn({ claude: first.claude, system: "", history: [{ role: "user", content: "redness" }], ctx, store });
    const second = scripted([
      { stop_reason: "tool_use", content: [use("v1", "verify_customer", { email: "mei.lin@example.com", order_number: "GC-1042" })] },
      { stop_reason: "end_turn", content: [text("A person will contact you.")] },
    ]);
    const t2 = await runTurn({ claude: second.claude, system: "", history: [...t1.messages, { role: "user", content: "ok can you check my order" }], ctx, store });
    expect(await store.getVerifiedCustomer("conv_1")).toBeNull(); // verify_customer never ran
    expect(t2.reply).toBe("A person will contact you."); // later turns aren't forced to repeat the safety message
  });

  it("before any reaction, tools are allowed; tools added later are covered automatically", () => {
    expect(beforeTool("list_orders", [])).toEqual({ allow: true });
    const afterReaction: Message[] = [
      { role: "assistant", content: [use("r1", "report_reaction", { what_happened: "x" })] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "r1", content: "{\"ok\":true}" }] },
    ];
    expect(beforeTool("get_order", afterReaction).allow).toBe(false); // get_order doesn't exist yet
    expect(beforeTool("report_reaction", afterReaction).allow).toBe(true);
  });
});
