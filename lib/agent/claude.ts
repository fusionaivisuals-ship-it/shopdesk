// The real Claude client behind the loop's `Claude` interface (tests use a scripted one instead).
// Model is a setting (D-12: Haiku for now). The key comes from the environment, never from a file.
import Anthropic from "@anthropic-ai/sdk";
import type { Claude, ClaudeReply } from "./loop";

export const DEFAULT_MODEL = "claude-haiku-5-5";

export function anthropicClaude(apiKey: string, model = DEFAULT_MODEL): Claude {
  const client = new Anthropic({ apiKey });
  return {
    async create(req): Promise<ClaudeReply> {
      const r: any = await client.messages.create({
        model,
        max_tokens: 1024,
        system: req.system,
        tools: req.tools as any,
        messages: req.messages as any,
      });
      return { stop_reason: r.stop_reason, content: r.content, usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens } };
    },
  };
}
