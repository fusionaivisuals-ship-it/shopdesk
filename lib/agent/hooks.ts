// "Before tool" hook (D-39): rules that span the whole conversation, applied to EVERY tool call,
// including tools added later. Single-tool rules stay inside their tools (e.g. verification, D-02b).
import type { Message, Block } from "./loop";

export type HookDecision = { allow: true } | { allow: false; result: Record<string, unknown> };

// True once report_reaction has run successfully anywhere in this conversation (any earlier turn too).
export function reactionReported(messages: Message[]): boolean {
  const reactionIds = new Set<string>();
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    for (const b of m.content as Block[]) {
      if (b.type === "tool_use" && b.name === "report_reaction") reactionIds.add(b.id);
      if (b.type === "tool_result" && reactionIds.has(b.tool_use_id) && !b.is_error) return true;
    }
  }
  return false;
}

export function beforeTool(toolName: string, messages: Message[]): HookDecision {
  // D-08 / D-39: after a reaction report, only a person handles this conversation.
  if (toolName !== "report_reaction" && reactionReported(messages)) {
    return {
      allow: false,
      result: {
        isError: true,
        category: "business",
        retryable: false,
        next_step: "A skin reaction was reported in this conversation. Do not use tools or give product advice. Tell the customer a member of the team will contact them today.",
      },
    };
  }
  return { allow: true };
}
