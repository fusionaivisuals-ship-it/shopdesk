// Agent loop tests (D-37). Claude is SCRIPTED: no real API calls, $0, same result every run (D-16).
import { describe, it, expect } from "vitest";
import { runTurn, MAX_ROUNDS, FALLBACK, type Claude, type ClaudeReply, type Message } from "./loop";
import { memoryStore } from "../tools/store";

const ctx = { conversationId: "conv_1", visitorId: "vis_1", now: Date.UTC(2026, 10, 7) };
const ask = (text: string): Message[] => [{ role: "user", content: text }];

// A fake Claude that replies from a script and records what it was sent.
function scripted(replies: ClaudeReply[]) {
  const seen: Message[][] = [];
  const claude: Claude = {
    async create(req) {
      seen.push(JSON.parse(JSON.stringify(req.messages)));
      const next = replies.shift();
      if (!next) throw new Error("script ran out");
      return next;
    },
  };
  return { claude, seen };
}
const text = (t: string) => ({ type: "text" as const, text: t });
const use = (id: string, name: string, input: any = {}) => ({ type: "tool_use" as const, id, name, input });

describe("agent loop", () => {
  it("end_turn on the first reply -> answer, 1 round", async () => {
    const { claude } = scripted([{ stop_reason: "end_turn", content: [text("We ship to Japan.")] }]);
    const r = await runTurn({ claude, system: "", history: ask("Do you ship to Japan?"), ctx, store: memoryStore() });
    expect(r).toMatchObject({ reply: "We ship to Japan.", rounds: 1, endedBy: "end_turn" });
  });

  it("text + tool_use in the same reply does NOT stop the loop (anti-pattern check)", async () => {
    const store = memoryStore();
    const { claude } = scripted([
      { stop_reason: "tool_use", content: [text("Let me check that for you..."), use("t1", "verify_customer", { email: "mei.lin@example.com", order_number: "GC-1042" })] },
      { stop_reason: "end_turn", content: [text("Thanks, you're verified.")] },
    ]);
    const r = await runTurn({ claude, system: "", history: ask("I'm mei.lin@example.com, order GC-1042"), ctx, store });
    expect(r.reply).toBe("Thanks, you're verified.");
    expect(await store.getVerifiedCustomer("conv_1")).toBe("cus_1"); // the tool really ran
  });

  it("verify -> list -> answer: each tool result goes back to Claude, matched by tool_use_id", async () => {
    const { claude, seen } = scripted([
      { stop_reason: "tool_use", content: [use("t1", "verify_customer", { email: "mei.lin@example.com", order_number: "GC-1042" })] },
      { stop_reason: "tool_use", content: [use("t2", "list_orders")] },
      { stop_reason: "end_turn", content: [text("You have 2 orders.")] },
    ]);
    const r = await runTurn({ claude, system: "", history: ask("What have I ordered?"), ctx, store: memoryStore() });
    expect(r).toMatchObject({ rounds: 3, endedBy: "end_turn", reply: "You have 2 orders." });
    const round2 = seen[1].at(-1)!.content as any[];
    expect(round2[0]).toMatchObject({ type: "tool_result", tool_use_id: "t1" });
    expect(JSON.parse(round2[0].content)).toMatchObject({ ok: true });
    const round3 = seen[2].at(-1)!.content as any[];
    expect(round3[0].tool_use_id).toBe("t2");
    expect(JSON.parse(round3[0].content).orders).toHaveLength(2);
  });

  it("permission error from a tool is passed back as is_error, and Claude can recover", async () => {
    const { claude, seen } = scripted([
      { stop_reason: "tool_use", content: [use("t1", "list_orders")] },
      { stop_reason: "end_turn", content: [text("Could you give me your email and order number?")] },
    ]);
    await runTurn({ claude, system: "", history: ask("Where's my order?"), ctx, store: memoryStore() });
    const result = (seen[1].at(-1)!.content as any[])[0];
    expect(result.is_error).toBe(true);
    expect(JSON.parse(result.content).category).toBe("permission");
  });

  it("unknown tool name -> error result, loop continues", async () => {
    const { claude, seen } = scripted([
      { stop_reason: "tool_use", content: [use("t1", "give_discount")] },
      { stop_reason: "end_turn", content: [text("I can't do that.")] },
    ]);
    const r = await runTurn({ claude, system: "", history: ask("Give me a discount"), ctx, store: memoryStore() });
    expect(r.endedBy).toBe("end_turn");
    expect((seen[1].at(-1)!.content as any[])[0]).toMatchObject({ is_error: true });
  });

  it("endless tool_use -> stops at the cap with the honest fallback + staff log (D-37)", async () => {
    const store = memoryStore();
    const replies = Array.from({ length: MAX_ROUNDS + 2 }, (_, i) => ({ stop_reason: "tool_use", content: [use(`t${i}`, "list_orders")] }));
    const { claude } = scripted(replies);
    const r = await runTurn({ claude, system: "", history: ask("loop forever"), ctx, store });
    expect(r).toMatchObject({ endedBy: "cap", rounds: MAX_ROUNDS, reply: FALLBACK });
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "loop_cap_hit" }));
  });

  it("other stop_reason (max_tokens) -> fallback + log, never a half answer", async () => {
    const store = memoryStore();
    const { claude } = scripted([{ stop_reason: "max_tokens", content: [text("Your order is curr")] }]);
    const r = await runTurn({ claude, system: "", history: ask("Where's my order?"), ctx, store });
    expect(r).toMatchObject({ endedBy: "other_stop_reason", reply: FALLBACK });
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "loop_unexpected_stop", stop_reason: "max_tokens" }));
  });
});
