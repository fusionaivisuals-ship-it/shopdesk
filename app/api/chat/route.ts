// POST /api/chat: one customer message in, a stream of events out (D-50).
//   event: step   -> { tool, label, ok }   (label built by code, D-51)
//   event: answer -> { text, status }      (whole answer after the loop; the browser reveals it)
//   event: error  -> { text }              (fixed fallback, never an internal error)
import { handleMessage } from "../../../lib/agent/turn";
import { FALLBACK } from "../../../lib/agent/loop";
import { store, claudeClient, ids } from "../../../lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_CHARS = 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_CHARS) {
    return Response.json({ error: `Please send a message of 1 to ${MAX_CHARS} characters.` }, { status: 400 });
  }
  const claude = claudeClient();
  if (!claude) return Response.json({ error: "Chat is not configured yet." }, { status: 503 });

  const { visitorId, conversationId, setCookies } = ids(req.headers.get("cookie"));
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const send = (event: string, data: unknown) => c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const r = await handleMessage({ claude, store, conversationId, visitorId, text, now: Date.now(), onStep: (s) => send("step", s) });
        send("answer", { text: r.reply, status: r.status });
      } catch (e) {
        await store.log({ event: "chat_route_error", detail: String(e), conversationId }).catch(() => {});
        send("error", { text: FALLBACK });
      } finally {
        c.close();
      }
    },
  });
  const headers = new Headers({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(stream, { headers });
}
