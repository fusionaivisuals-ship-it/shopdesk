// Implements D-05 (short list first, then get_order for one), D-02b (verified customer only),
// D-06 (summary fields only), D-30 (structured errors; "no orders" is a success).
import type { Store } from "./store";
import type { Context } from "./verify_customer";

export const definition = {
  name: "list_orders",
  description: `Lists the verified customer's orders as a short summary: order number, date placed and status. Returns ONLY orders belonging to the customer verified in this conversation.

USE IT: after verify_customer succeeded, when the customer asks about their orders and you need to know which order they mean, or they ask "what have I ordered?".

DO NOT USE IT:
- before the conversation is verified (call verify_customer first);
- to get details of one order (items, delivery date, tracking, return eligibility): use get_order with the order number;
- for general policy questions: use search_policy.

RESULTS:
- {orders: [...]}: the summary list. An empty list means this customer genuinely has no orders.
- {isError: true, category, retryable, next_step}: something went wrong. Follow next_step. Never tell the customer they have no orders after an error.`,
  input_schema: { type: "object", properties: {}, required: [] },
} as const;

export type OrderSummary = { number: string; placed: string; status: string };
export type ToolError = {
  isError: true;
  category: "transient" | "validation" | "business" | "permission";
  retryable: boolean;
  next_step: string;
};

export async function listOrders(_input: Record<string, never>, ctx: Context, store: Store): Promise<{ orders: OrderSummary[] } | ToolError> {
  const customerId = await store.getVerifiedCustomer(ctx.conversationId);
  if (!customerId) {
    return {
      isError: true,
      category: "permission",
      retryable: false,
      next_step: "The conversation is not verified. Ask for the customer's email and order number and call verify_customer first.",
    };
  }
  try {
    const orders = await store.listOrdersFor(customerId);
    return { orders: orders.map((o) => ({ number: o.number, placed: o.placedAt, status: o.status })) };
  } catch (e) {
    await store.log({ event: "list_orders_failed", detail: String(e), conversationId: ctx.conversationId, at: ctx.now });
    return {
      isError: true,
      category: "transient",
      retryable: true,
      next_step: "Retry once. If it fails again, tell the customer their orders can't be loaded right now (not that they have none) and offer the \"Talk to a person\" button.",
    };
  }
}
