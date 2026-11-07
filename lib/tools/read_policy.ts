// Implements D-10 (the read half of search + read), D-43 (structured errors), 5.6 (version + URL).
import type { Store } from "./store";
import type { Context } from "./verify_customer";
import type { ToolError } from "./list_orders";
import { policyUrl } from "./search_policy";

export const definition = {
  name: "read_policy",
  description: `Returns the full CURRENT text of one Glow & Co policy section, with its version, effective date and link.

USE IT: after search_policy, with a section id it returned, before answering a policy question. Answer only from this text and include the link.

DO NOT USE IT:
- to guess section ids: use search_policy first;
- for the customer's own orders: use list_orders.

RESULTS:
- {section, title, version, effective_from, text, url}: answer from text, cite the url.
- {isError: true, category: "validation"}: unknown section id; run search_policy.
- {isError: true, category: "transient"}: follow next_step.`,
  input_schema: {
    type: "object",
    properties: { section: { type: "string", description: "Section id from search_policy, e.g. 'shipping'" } },
    required: ["section"],
  },
} as const;

export async function readPolicy(input: { section: string }, ctx: Context, store: Store) {
  try {
    const p = (await store.currentPolicies()).find((x) => x.section === String(input.section ?? "").trim().toLowerCase());
    if (!p) {
      const err: ToolError = { isError: true, category: "validation", retryable: false, next_step: "No current policy section with that id. Use search_policy to find the right section id." };
      return err;
    }
    return { section: p.section, title: p.title, version: p.version, effective_from: p.effectiveFrom, text: p.body, url: policyUrl(p) };
  } catch (e) {
    await store.log({ event: "read_policy_failed", detail: String(e), conversationId: ctx.conversationId, at: ctx.now });
    const err: ToolError = {
      isError: true, category: "transient", retryable: true,
      next_step: "Retry once. If it fails again, tell the customer our policies can't be loaded right now and offer the \"Talk to a person\" button.",
    };
    return err;
  }
}
