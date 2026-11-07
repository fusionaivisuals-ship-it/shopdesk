// The agent loop for one customer message. Implements D-37 (stop_reason drives the loop,
// cap = backstop only), D-36 (this is the adaptive part inside the fixed shell),
// D-31 (tool_choice auto: Claude picks tools; the tools enforce the rules).
import type { Store } from "../tools/store";
import type { Context } from "../tools/verify_customer";
import { verifyCustomer, definition as verifyDef } from "../tools/verify_customer";
import { listOrders, definition as listDef } from "../tools/list_orders";
import { reportReaction, definition as reactionDef, SAFETY_MESSAGE } from "../tools/report_reaction";
import { beforeTool, reactionReported } from "./hooks";
import { searchPolicy, definition as searchDef } from "../tools/search_policy";
import { readPolicy, definition as readDef } from "../tools/read_policy";
import { stepLabel, type Step } from "./steps";

// The slice of the Anthropic Messages API the loop needs. Injected so tests can script it.
export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type Message = { role: "user" | "assistant"; content: string | Block[] };
export type ClaudeReply = { stop_reason: string; content: Block[]; usage?: { input_tokens: number; output_tokens: number } };
export type Claude = {
  create(req: { system: string; tools: unknown[]; messages: Message[] }): Promise<ClaudeReply>;
};

type Tool = (input: any, ctx: Context, store: Store, messages: Message[]) => Promise<unknown>;
const TOOLS: Record<string, { definition: unknown; run: Tool }> = {
  verify_customer: { definition: verifyDef, run: verifyCustomer },
  list_orders: { definition: listDef, run: listOrders },
  report_reaction: { definition: reactionDef, run: reportReaction },
  search_policy: { definition: searchDef, run: searchPolicy },
  read_policy: { definition: readDef, run: readPolicy },
};

export const MAX_ROUNDS = 8;
// D-39b: after a reaction report, code answers every later message itself; Claude is not called.
export const AFTER_REACTION_REPLY =
  "A member of the Glow & Co team will contact you today about this. If your symptoms get worse, please seek medical help.";
export const FALLBACK =
  "Sorry, I couldn't finish that just now. Please use the \"Talk to a person\" button and someone from Glow & Co will help.";

export type TurnResult = {
  reply: string;
  messages: Message[]; // full history including tool calls and results
  rounds: number;
  endedBy: "end_turn" | "cap" | "other_stop_reason";
  usage: { input_tokens: number; output_tokens: number }; // summed over every model call this turn (D-44)
};

export async function runTurn(args: {
  claude: Claude;
  system: string;
  history: Message[]; // previous turns + the new customer message
  ctx: Context;
  store: Store;
  onStep?: (step: Step) => void | Promise<void>; // D-50: one event per tool call, label built by code (D-51)
}): Promise<TurnResult> {
  const messages = [...args.history];
  const usage = { input_tokens: 0, output_tokens: 0 };
  // Fixed-shell rule (D-36, D-39b): once a reaction was reported earlier in this conversation,
  // no model call at all: no advice can be written, and the reply costs $0.
  if (reactionReported(args.history)) {
    messages.push({ role: "assistant", content: [{ type: "text", text: AFTER_REACTION_REPLY }] });
    return { reply: AFTER_REACTION_REPLY, messages, rounds: 0, endedBy: "end_turn", usage };
  }
  const tools = Object.values(TOOLS).map((t) => t.definition);

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const reply = await args.claude.create({ system: args.system, tools, messages });
    usage.input_tokens += reply.usage?.input_tokens ?? 0;
    usage.output_tokens += reply.usage?.output_tokens ?? 0;
    messages.push({ role: "assistant", content: reply.content });

    if (reply.stop_reason === "end_turn") {
      const text = reply.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
      // D-08: once a reaction is reported this turn, the customer gets the FIXED safety message, not Claude's wording.
      const reported = reactionThisTurn(messages, args.history.length);
      return { reply: reported ? SAFETY_MESSAGE : text, messages, rounds: round, endedBy: "end_turn", usage };
    }

    if (reply.stop_reason !== "tool_use") {
      // max_tokens, refusal, anything unexpected: never guess, fail honestly (D-37).
      await args.store.log({ event: "loop_unexpected_stop", stop_reason: reply.stop_reason, conversationId: args.ctx.conversationId });
      return { reply: FALLBACK, messages, rounds: round, endedBy: "other_stop_reason", usage };
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
        await args.onStep?.(stepLabel(b.name, null));
        continue;
      }
      const hook = beforeTool(b.name, messages); // D-39: conversation-wide rules, every tool
      if (!hook.allow) {
        await args.store.log({ event: "tool_blocked_by_hook", tool: b.name, conversationId: args.ctx.conversationId });
        results.push({ type: "tool_result", tool_use_id: b.id, is_error: true, content: JSON.stringify(hook.result) });
        await args.onStep?.({ tool: b.name, label: "Skipped", ok: false });
        continue;
      }
      const out: any = await tool.run(b.input ?? {}, args.ctx, args.store, messages);
      results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out), is_error: out?.isError === true });
      await args.onStep?.(stepLabel(b.name, out));
    }
    // Tool results go back as the next user message, matched by tool_use_id.
    messages.push({ role: "user", content: results });
  }

  await args.store.log({ event: "loop_cap_hit", rounds: MAX_ROUNDS, conversationId: args.ctx.conversationId });
  return { reply: FALLBACK, messages, rounds: MAX_ROUNDS, endedBy: "cap", usage };
}

function reactionThisTurn(messages: Message[], historyLength: number): boolean {
  const ids = new Set<string>();
  for (const m of messages.slice(historyLength)) {
    if (typeof m.content === "string") continue;
    for (const b of m.content as Block[]) {
      if (b.type === "tool_use" && b.name === "report_reaction") ids.add(b.id);
      if (b.type === "tool_result" && ids.has(b.tool_use_id) && !b.is_error) return true;
    }
  }
  return false;
}
