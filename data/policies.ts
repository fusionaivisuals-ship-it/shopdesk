// Fictional Glow & Co policies (approved 2026-11-08). Old versions are KEPT (evidence for
// "what did the bot say on date X", TS 5.6) but tools only ever answer from the current one.
export type Policy = {
  section: string; version: number; title: string; effectiveFrom: string;
  supersededOn: string | null; body: string;
};

export const policies: Policy[] = [
  {
    section: "returns", version: 1, title: "Returns", effectiveFrom: "2026-01-01", supersededOn: "2026-11-01",
    body: "Unopened items can be returned within 14 days of delivery. Opened items cannot be returned.",
  },
  {
    section: "returns", version: 2, title: "Returns", effectiveFrom: "2026-11-01", supersededOn: null,
    body:
      "Unopened items can be returned within 30 days of delivery for a full refund to the original payment method. " +
      "Opened items can only be returned if the customer reported a skin reaction to that product. " +
      "To start a return, contact the Glow & Co team with your order number. Return shipping is free within Taiwan.",
  },
  {
    section: "shipping", version: 1, title: "Shipping", effectiveFrom: "2026-01-01", supersededOn: null,
    body:
      "We ship to Taiwan, Japan, Singapore, Hong Kong and Australia. We do not ship to other countries yet. " +
      "Delivery takes 1-3 business days within Taiwan and 5-10 business days to other countries. " +
      "Every order gets a tracking link once it has shipped.",
  },
  {
    section: "subscriptions", version: 1, title: "Subscriptions", effectiveFrom: "2026-01-01", supersededOn: null,
    body:
      "Subscriptions can be paused or cancelled at any time before the next charge date, with no fee. " +
      "Changes made after the charge date apply from the following delivery.",
  },
  {
    section: "skin-reactions", version: 1, title: "Skin reactions", effectiveFrom: "2026-01-01", supersededOn: null,
    body:
      "If a product causes a reaction, stop using it and contact the Glow & Co team; we arrange the next steps, including a return of the opened product. " +
      "We do not give medical advice. If you have swelling, difficulty breathing or a severe reaction, seek medical help immediately.",
  },
  {
    section: "ingredients", version: 1, title: "Ingredients and testing", effectiveFrom: "2026-01-01", supersededOn: null,
    body:
      "All Glow & Co products are cruelty-free and never tested on animals. " +
      "The full ingredient list for each product is on its product page.",
  },
];
