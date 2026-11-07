// Implements D-08 (Claude detects a reaction; code handles what follows), D-38 (structured
// urgent ticket), D-39 (after this, the hook blocks every other tool in the conversation).
import type { Store } from "./store";
import type { Context } from "./verify_customer";
import type { Message } from "../agent/loop";
import { buildTicket } from "../agent/handoff";

// Fixed, pre-approved wording. The loop sends THIS to the customer, not Claude's paraphrase (D-08).
export const SAFETY_MESSAGE =
  "I'm sorry this happened. Please stop using the product now. If you have swelling, difficulty breathing or a severe reaction, " +
  "seek medical help immediately. A member of the Glow & Co team will contact you today about your order.";

export const definition = {
  name: "report_reaction",
  description: `Reports that the customer describes a possible skin or allergic reaction to a product (for example burning, stinging, redness, rash, swelling, itching, "my skin freaked out"). Creates an URGENT ticket for a person and sends the customer a fixed safety message.

USE IT: as soon as the customer describes any physical reaction after using a product, in any words, even if they mainly ask about something else (a return, a refund, an order).

DO NOT USE IT:
- for general product questions without a reaction ("does this serum sting?", "is it good for sensitive skin?"): answer from the policies;
- for delivery or damaged-packaging problems with no reaction.

AFTER CALLING IT: do not give any product, skin or medical advice and do not call other tools. The conversation is now with a person.

EXAMPLES:
- "I used the vitamin C serum and my face is burning" -> report_reaction.
- "Can I return the cleanser? It gave me a rash" -> report_reaction (the rash matters more than the return).
- "Is the retinol cream suitable for sensitive skin?" -> do NOT report; this is a product question.`,
  input_schema: {
    type: "object",
    properties: {
      what_happened: { type: "string", description: "One line in plain words: the product and what the customer describes, e.g. 'Vitamin C serum, burning and redness after first use'. No medical interpretation." },
    },
    required: ["what_happened"],
  },
} as const;

export async function reportReaction(
  input: { what_happened: string },
  ctx: Context,
  store: Store,
  messages: Message[]
) {
  const ticket = await buildTicket({ kind: "reaction", messages, customerWants: String(input.what_happened ?? "").slice(0, 200), ctx, store });
  await store.createTicket(ticket);
  // Only what Claude needs to act: no ticket internals, no customer data (D-06).
  return {
    ok: true,
    next_step: "Done. The customer will receive the fixed safety message. Do not add product, skin or medical advice and do not call other tools.",
  };
}
