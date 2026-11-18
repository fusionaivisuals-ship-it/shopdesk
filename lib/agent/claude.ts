// The real Claude client behind the loop's `Claude` interface (tests use a scripted one instead).
// Model is a setting (D-12: Haiku for now). The key comes from the environment, never from a file.
import Anthropic from "@anthropic-ai/sdk";
import type { Claude, ClaudeReply } from "./loop";
import { BUDGET } from "../rules/budget";

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function anthropicClaude(apiKey: string, model = DEFAULT_MODEL): Claude {
  // G9: a hung call can't hold the server (25 s, one retry), and each call has an output ceiling.
  // The key lives only in this server-side object: never logged, never sent to the browser.
  const client = new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
  return {
    async create(req): Promise<ClaudeReply> {
      const r: any = await client.messages.create({
        model,
        max_tokens: BUDGET.maxOutputTokens,
        system: req.system,
        tools: req.tools as any,
        messages: req.messages as any,
      });
      return { stop_reason: r.stop_reason, content: r.content, usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens } };
    },
  };
}
