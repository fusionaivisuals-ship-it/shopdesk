// Implements D-02b (verify once, code sets the verified flag), D-03/D-03b/D-21 (locks),
// D-04 (generic result + next step), D-29 (full description with sample messages).
import { gate, recordFailure, recordSuccess, LIMITS } from "../rules/lock";
import type { Store } from "./store";

export const definition = {
  name: "verify_customer",
  description: `Checks that the customer owns an order by matching their email address with an order number (format GC-1234). On success, this conversation is marked verified and order tools (list_orders, get_order) start working for this customer's orders only.

USE IT: once, before answering any question about the customer's own orders (status, items, delivery, tracking, returns of a specific order). Ask the customer for both their email and their order number first.

DO NOT USE IT:
- if this conversation is already verified (just use list_orders / get_order);
- for policy questions that don't need the customer's orders (shipping countries, ingredients policy, how returns work in general): use search_policy instead;
- to check whether an email or order exists;
- again after a result with locked: true. Follow next_step instead.

RESULTS:
- {ok: true}: verified. Continue with list_orders.
- {ok: false, reason: "no_match", attempts_left, next_step}: the details don't match. Never say which detail was wrong; ask the customer to re-check both.
- {ok: false, locked: true, ...}: stop verifying. Follow next_step (wait, or offer the "Talk to a person" button).

EXAMPLES:
- "Where is my order?" -> ask for email + order number, then verify_customer.
- "My order GC-1042 hasn't arrived, I'm mei.lin@example.com" -> verify_customer with both.
- "Do you ship to Japan?" -> do NOT verify; use search_policy.
- "I ordered the vitamin C serum last week, what's your return policy for opened items?" -> do NOT verify; this is a general policy question even though it mentions an order. Use search_policy. Verify only if they then ask about THEIR specific order.
- "Is this email registered with you?" -> do NOT verify; say you can only help with orders after verification.`,
  input_schema: {
    type: "object",
    properties: {
      email: { type: "string", description: "Email address the customer gave, e.g. mei.lin@example.com" },
      order_number: { type: "string", description: "Order number the customer gave, e.g. GC-1042" },
    },
    required: ["email", "order_number"],
  },
} as const;

export type Context = { conversationId: string; visitorId: string; now: number };

export type VerifyResult =
  | { ok: true; next_step: string }
  | { ok: false; reason: "no_match"; attempts_left: number; next_step: string }
  | { ok: false; locked: true; unlock_in_minutes: number | null; next_step: string };

const MIN = 60_000;

export function verifyCustomer(
  input: { email: string; order_number: string },
  ctx: Context,
  store: Store
): VerifyResult {
  if (store.getVerifiedCustomer(ctx.conversationId)) {
    return { ok: true, next_step: "Already verified. Use list_orders." };
  }

  const orderNumber = input.order_number.trim().toUpperCase();
  const order = store.findOrder(orderNumber);
  const orderKey = order ? `order:${order.number}` : null; // non-existent order: visitor only (Q5)
  const visitorKey = `visitor:${ctx.visitorId}`;
  const orderCounter = orderKey ? store.getCounter(orderKey) : null;
  const visitorCounter = store.getCounter(visitorKey);

  // Either lock blocks (Q2). Details are not even checked while locked.
  const before = gate(orderCounter, visitorCounter, ctx.now);
  if (before.kind !== "open") return lockedResult(before, ctx.now);

  const customer = order ? store.findCustomer(order.customerId) : null;
  const matches = !!customer && customer.email.toLowerCase() === input.email.trim().toLowerCase();

  if (matches && order && orderCounter) {
    const s = recordSuccess(orderCounter, visitorCounter, ctx.now);
    store.setCounter(orderKey!, s.order);
    store.setCounter(visitorKey, s.visitor);
    store.setVerifiedCustomer(ctx.conversationId, order.customerId);
    return { ok: true, next_step: "Verified. Use list_orders to see this customer's orders." };
  }

  // Detailed reason goes to the staff log only, never to Claude (D-04).
  store.log({
    event: "verify_failed",
    detail: !order ? "order_not_found" : "email_mismatch",
    orderNumber,
    visitorId: ctx.visitorId,
    at: ctx.now,
  });

  const r = recordFailure(orderCounter, visitorCounter, ctx.now);
  if (orderKey && r.order) store.setCounter(orderKey, r.order);
  store.setCounter(visitorKey, r.visitor);
  if (r.events.includes("create_ticket")) {
    store.createTicket({ kind: "verification_locked", orderNumber, conversationId: ctx.conversationId });
  }

  if (r.status.kind !== "open") return lockedResult(r.status, ctx.now);
  return {
    ok: false,
    reason: "no_match",
    attempts_left: r.status.attemptsLeft,
    next_step: "Say the details don't match our records and ask the customer to re-check both the email and the order number. Don't say which one is wrong.",
  };
}

function lockedResult(s: Exclude<ReturnType<typeof gate>, { kind: "open" }>, now: number): VerifyResult {
  if (s.kind === "locked") {
    return {
      ok: false,
      locked: true,
      unlock_in_minutes: Math.ceil((s.unlockAt - now) / MIN),
      next_step: `Too many verification attempts. Tell the customer they can try again in about ${Math.ceil((s.unlockAt - now) / MIN)} minutes, or contact the shop by email.`,
    };
  }
  return {
    ok: false,
    locked: true,
    unlock_in_minutes: null,
    next_step: `Verification is closed for this order. Tell the customer to use the "Talk to a person" button; a support person will help. (Lifts automatically after ${LIMITS.autoUnlockDays} days.)`,
  };
}
