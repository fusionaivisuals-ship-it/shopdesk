// THE ONLY FILE IN evals/ ALLOWED TO TOUCH THE AGENT (enforced by tests/separation.test.ts).
// The eval treats the agent as a black box through this one door: send a customer message, get the
// reply, read back the saved transcript and tickets. Everything else (cases, grading, cost, keys)
// belongs to the eval alone, so a change in the agent can't quietly change how it is judged.
import { handleMessage } from "../lib/agent/turn";
import { memoryStore } from "../lib/tools/store";
import { anthropicClaude, DEFAULT_MODEL } from "../lib/agent/claude";
import type { Claude } from "../lib/agent/loop";

export type Usage = { input_tokens: number; output_tokens: number };

export function targetModel(override?: string) {
  return override || DEFAULT_MODEL;
}

// A fresh agent with the fictional shop data. `meter` sees every model call's raw usage, so the eval
// measures cost itself instead of trusting the agent's own accounting.
export function freshAgent(apiKey: string, model: string, meter: (u: Usage) => void) {
  const real = anthropicClaude(apiKey, model);
  const claude: Claude = { async create(req) { const r = await real.create(req); if (r.usage) meter(r.usage); return r; } };
  const store = memoryStore();
  return {
    async send(conversationId: string, text: string, now: number): Promise<string> {
      return (await handleMessage({ claude, store, conversationId, visitorId: conversationId, text, now })).reply;
    },
    transcript: (conversationId: string) => store.loadMessages(conversationId),
    tickets: () => store.tickets.map((t) => ({ kind: t.kind })),
  };
}
