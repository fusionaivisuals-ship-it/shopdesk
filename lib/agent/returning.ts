// Returning-customer summary (D-42). Built by CODE from records, only after verification,
// only for the last 48 hours, never containing old tool results.
import type { Store } from "../tools/store";

const HOURS = 60 * 60_000;
export const RECENT_WINDOW_HOURS = 48;

const LABEL: Record<string, string> = {
  reaction: "reported a possible skin reaction",
  customer_request: "asked for a person",
  verification_locked: "verification was locked",
};

export async function recentContactSummary(store: Store, customerId: string, conversationId: string, now: number): Promise<string | null> {
  const tickets = (await store.recentTicketsFor(customerId, now - RECENT_WINDOW_HOURS * HOURS))
    .filter((t) => t.conversationId !== conversationId);
  if (!tickets.length) return null;
  const lines = tickets.map((t) => {
    const day = new Date(t.createdAt).toISOString().slice(0, 10);
    const orders = (t.details.ordersMentioned as string[] | undefined)?.join(", ");
    const status = (t.details.status as string | undefined) ?? "open";
    return `- ${day}: ${LABEL[t.kind] ?? t.kind}${orders ? ` (orders ${orders})` : ""}; ticket ${status}.`;
  });
  return [
    `Earlier contact in the last ${RECENT_WINDOW_HOURS} hours (from records, not memory):`,
    ...lines,
    `Use this only for context. Look up anything current (like order status) again with the tools.`,
  ].join("\n");
}
