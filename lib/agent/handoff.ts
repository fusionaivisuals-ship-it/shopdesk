// Builds the structured handoff ticket (D-38, D-38b). Every fact is taken by CODE from the
// conversation's tool calls/results and the database. The only model-written field is
// `customerWants` (one line), and it is null when no model was involved (button, D-09).
import type { Store, Ticket } from "../tools/store";
import type { Context } from "../tools/verify_customer";
import type { Message, Block } from "./loop";

const DAY = 24 * 60 * 60_000;
const HISTORY_DAYS = 60;

export type HandoffKind = "verification_locked" | "reaction" | "customer_request";

const REASON: Record<HandoffKind, { priority: Ticket["priority"]; reason: string; recommended: string }> = {
  verification_locked: { priority: "normal", reason: "Too many failed verification attempts", recommended: "Confirm identity another way, then unlock the order from the tickets page." },
  reaction: { priority: "urgent", reason: "Customer reported a possible skin reaction", recommended: "Contact the customer today. Do not give medical advice; follow the reaction procedure." },
  customer_request: { priority: "normal", reason: "Customer asked for a person", recommended: "Reply to the customer; the actions below have already been tried." },
};

// Pair each tool request with its result and summarise the outcome without any free text.
export function actionsFrom(messages: Message[]) {
  const uses = new Map<string, { tool: string; input: any }>();
  const actions: { tool: string; outcome: string }[] = [];
  for (const m of messages) {
    if (typeof m.content === "string") continue;
    for (const b of m.content as Block[]) {
      if (b.type === "tool_use") uses.set(b.id, { tool: b.name, input: b.input });
      if (b.type === "tool_result") {
        const u = uses.get(b.tool_use_id);
        let r: any = {};
        try { r = JSON.parse(b.content); } catch {}
        const outcome =
          r.isError ? `error: ${r.category}` :
          r.locked ? "locked" :
          r.ok === true ? "verified" :
          r.reason === "no_match" ? "no match" :
          Array.isArray(r.orders) ? `${r.orders.length} order(s) listed` : "done";
        actions.push({ tool: u?.tool ?? "unknown", outcome });
      }
    }
  }
  return actions;
}

export function ordersFrom(messages: Message[]): string[] {
  const found = new Set<string>();
  for (const m of messages) {
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    for (const n of text.match(/GC-\d+/gi) ?? []) found.add(n.toUpperCase());
  }
  return [...found];
}

export async function buildTicket(args: {
  kind: HandoffKind;
  messages: Message[];
  customerWants: string | null; // one line from Claude, or null (button)
  ctx: Context;
  store: Store;
}): Promise<Ticket> {
  const customerId = await args.store.getVerifiedCustomer(args.ctx.conversationId);
  const r = REASON[args.kind];
  return {
    kind: args.kind,
    priority: r.priority,
    conversationId: args.ctx.conversationId,
    customerId,
    createdAt: args.ctx.now,
    details: {
      customer: customerId ? { verified: true, id: customerId } : { verified: false },
      customerWants: args.customerWants,
      reason: r.reason,
      recommended: r.recommended,
      ordersMentioned: ordersFrom(args.messages),
      actionsTaken: actionsFrom(args.messages),
      // D-38b: only for verified customers, neutral counts, never labels.
      history60d: customerId ? await args.store.ticketCountsByKind(customerId, args.ctx.now - HISTORY_DAYS * DAY) : null,
      transcript: `/owner/conversations/${args.ctx.conversationId}`,
    },
  };
}
