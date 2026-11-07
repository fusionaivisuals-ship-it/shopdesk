// Implements D-10 (search + read pair), D-11/D-43 (no match = normal result; outage = transient
// error), D-07/5.6 (every result cites section, version and URL), D-13 (scope: shop policies only).
import type { Store } from "./store";
import type { Context } from "./verify_customer";
import type { ToolError } from "./list_orders";
import type { Policy } from "../../data/policies";

export const definition = {
  name: "search_policy",
  description: `Searches Glow & Co's CURRENT policies (returns, shipping, subscriptions, skin reactions, ingredients and testing) and returns the best-matching sections with a short snippet, section id, version and a link. Superseded versions are never returned.

USE IT: for any question about how the shop works: returns in general, which countries we ship to, delivery times, pausing or cancelling a subscription, cruelty-free/testing, what to do about a reaction. No verification needed.

DO NOT USE IT:
- for the customer's own order (status, items, tracking): use verify_customer, then list_orders;
- when a customer describes a reaction they are having: use report_reaction first;
- for questions outside this shop (general skincare advice, other brands): say you can only help with Glow & Co orders and policies.

AFTER SEARCHING: the snippet may be cut short. Before answering, call read_policy with the section id to read the full text, and quote only what it says. Always give the link.

RESULTS:
- {found: true, results: [...]}: read the best section with read_policy, then answer from it.
- {found: false, next_step}: the policies don't cover this. Say so honestly and offer the "Talk to a person" button. Never answer from general knowledge.
- {isError: true, ...}: follow next_step.`,
  input_schema: {
    type: "object",
    properties: { query: { type: "string", description: "The customer's question in a few words, e.g. 'ship to Japan', 'return opened product'" } },
    required: ["query"],
  },
} as const;

export const policyUrl = (p: Pick<Policy, "section" | "version">) => `/policies/${p.section}#v${p.version}`;

// Small word groups so "send", "deliver" and "ship" find the same section. Matching is by code;
// it only RANKS sections. Claude still reads the full text and decides what answers the question.
const GROUPS = [
  ["ship", "shipping", "deliver", "delivery", "send", "country", "countries", "abroad", "international", "tracking"],
  ["return", "returns", "refund", "send back", "exchange", "opened", "unopened"],
  ["subscription", "subscriptions", "pause", "cancel", "charge", "renew"],
  ["reaction", "rash", "burn", "burning", "itch", "allergic", "allergy", "redness", "swelling", "sting"],
  ["ingredient", "ingredients", "cruelty", "animal", "animals", "tested", "testing", "vegan"],
];
const STOP = new Set(["the", "and", "you", "your", "can", "for", "what", "how", "does", "are", "with", "our", "about", "any", "there",
  "have", "has", "had", "this", "that", "will", "from", "into", "its", "get", "got", "not", "but", "was", "were", "they", "them", "who", "why", "when", "which", "would", "could", "should", "please", "want", "need", "know", "tell", "like"]);

const stem = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);
function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
}
function expand(ws: string[]): Set<string> {
  const out = new Set(ws);
  for (const g of GROUPS) if (g.some((x) => out.has(stem(x)))) g.forEach((x) => out.add(stem(x)));
  return out;
}

export async function searchPolicy(input: { query: string }, ctx: Context, store: Store) {
  let current: Policy[];
  try {
    current = await store.currentPolicies();
  } catch (e) {
    await store.log({ event: "search_policy_failed", detail: String(e), conversationId: ctx.conversationId, at: ctx.now });
    const err: ToolError = {
      isError: true, category: "transient", retryable: true,
      next_step: "Retry once. If it fails again, tell the customer our policies can't be loaded right now (not that they don't exist) and offer the \"Talk to a person\" button.",
    };
    return err;
  }
  const q = expand(words(String(input.query ?? "")));
  const scored = current
    .map((p) => {
      // Whole words only: "have" must not match inside unrelated text, "ship" not inside "relationship".
      const hay = new Set(words(`${p.section.replace("-", " ")} ${p.title} ${p.body}`));
      let score = 0;
      for (const w of q) if (hay.has(w)) score++;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  if (!scored.length) {
    await store.log({ event: "policy_gap", query: input.query, conversationId: ctx.conversationId, at: ctx.now }); // D-11 trial count
    return {
      found: false,
      next_step: "Our policies don't cover this. Tell the customer honestly and offer the \"Talk to a person\" button. Do not answer from general knowledge.",
    };
  }
  return {
    found: true,
    results: scored.map(({ p }) => ({ section: p.section, title: p.title, version: p.version, snippet: p.body.slice(0, 120), url: policyUrl(p) })),
  };
}
