// POST /api/handoff: the "Talk to a person" button (D-09). Code only, no AI: build the ticket
// from the saved conversation (D-38), store it (D-14b), reply with a fixed message.
import { buildTicket } from "../../../lib/agent/handoff";
import type { Message } from "../../../lib/agent/loop";
import { store, ids } from "../../../lib/server";
import { canHandOff, recordHandoff } from "../../../lib/rules/handoff";

export const runtime = "nodejs";
const HANDOFF_MESSAGE = "Thanks. Your request is with the Glow & Co team, and a person will reply to you.";

export async function POST(req: Request) {
  const { visitorId, conversationId, setCookies } = ids(req.headers.get("cookie"));
  const now = Date.now();
  const key = `handoff:${conversationId}`;
  const counter = await store.getCounter(key);
  // D-53: repeat clicks get the same reply but no new ticket, so a script can't flood the queue.
  if (canHandOff(counter)) {
    const messages = (await store.loadMessages(conversationId)) as Message[];
    const ticket = await buildTicket({ kind: "customer_request", messages, customerWants: null, ctx: { conversationId, visitorId, now }, store });
    await store.createTicket(ticket);
    await store.setCounter(key, recordHandoff(counter, now));
  }
  const headers = new Headers();
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return Response.json({ text: HANDOFF_MESSAGE }, { headers });
}
