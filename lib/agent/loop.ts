// The agent loop for one customer message. Implements D-37 (stop_reason drives the loop,
// cap = backstop only), D-36 (this is the adaptive part inside the fixed shell),
// D-31 (tool_choice auto: Claude picks tools; the tools enforce the rules).
import type { Store } from "../tools/store";
import type { Context } from "../tools/verify_customer";
import { verifyCustomer, definition as verifyDef } from "../tools/verify_customer";
import { listOrders, definition as listDef } from "../tools/list_orders";

// The slice of the Anthropic Messages API the loop needs. Injected so tests can script it.
export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type Message = { role: "user" | "assistant"; content: string | Block[] };
export type ClaudeReply = { stop_reason: string; content: Block[] };
export type Claude = {
  create(req: { system: string; tools: unknown[]; messages: Message[] }): Promise<ClaudeReply>;
};

type Tool = (input: any, ctx: Context, store: Store) => Promise<unknown>;
const TOOLS: Record<string, { definition: unknown; run: Tool }> = {
  verify_customer: { definition: verifyDef, run: verifyCustomer },
  list_orders: { definition: listDef, run: listOrders },
};

export const MAX_ROUNDS = 8;
export const FALLBACK =
  "Sorry, I couldn't finish that just now. Please use the \"Talk to a person\" button and someone from Glow & Co will help.";

export type TurnResult = {
  reply: string;
  messages: Message[]; // full history including tool calls and results
  rounds: number;
  endedBy: "end_turn" | "cap" | "other_stop_reason";
};

export async function runTurn(args: {
  claude: Claude;
  system: string;
  history: Message[]; // previous turns + the new customer message
  ctx: Context;
  store: Store;
}): Promise<TurnResult> {
  const messages = [...args.history];
  const tools = Object.values(TOOLS).map((t) => t.definition);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const reply = await args.claude.create({ system: args.system, tools, messages });
    messages.push({ role: "assistant", content: reply.content });

    if (reply.stop_reason === "end_turn") {
      const text = reply.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      return { reply: text, messages, rounds: round, endedBy: "end_turn" };
    }

    if (reply.stop_reason !== "tool_use") {
      // max_tokens, refusal, anything unexpected: never guess, fail honestly (D-37).
      await args.store.log({ event: "loop_unexpected_stop", stop_reason: reply.stop_reason, conversationId: args.ctx.conversationId });
      return { reply: FALLBACK, messages, rounds: round, endedBy: "other_stop_reason" };
    }

    // Run EVERY tool Claude asked for (there may be text in the same reply; that is not a stop signal).
    const results: Block[] = [];
    for (const b of reply.content) {
      if (b.type !== "tool_use") continue;
      const tool = TOOLS[b.name];
      if (!tool) {
        results.push({
          type: "tool_result",
          tool_use_id: b.id,
          is_error: true,
          content: JSON.stringify({ isError: true, category: "validation", retryable: false, next_step: `No tool named ${b.name}. Use one of: ${Object.keys(TOOLS).join(", ")}.` }),
        });
        continue;
      }
      const out: any = await tool.run(b.input ?? {}, args.ctx, args.store);
      results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out), is_error: out?.isError === true });
    }
    // Tool results go back as the next user message, matched by tool_use_id.
    messages.push({ role: "user", content: results });
  }

  await args.store.log({ event: "loop_cap_hit", rounds: MAX_ROUNDS, conversationId: args.ctx.conversationId });
  return { reply: FALLBACK, messages, rounds: MAX_ROUNDS, endedBy: "cap" };
}
