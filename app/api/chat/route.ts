// POST /api/chat: one customer message in, a stream of events out (D-50).
//   event: step   -> { tool, label, ok }   (label built by code, D-51)
//   event: answer -> { text, status }      (whole answer after the loop; the browser reveals it)
//   event: error  -> { text }              (fixed fallback, never an internal error)
// Gates, in order, before Claude is ever called (SECURITY.md): config, origin, body, text, IP rate.
import { handleMessage } from "../../../lib/agent/turn";
import { FALLBACK } from "../../../lib/agent/loop";
import { store, claudeClient, ids, notConfigured } from "../../../lib/server";
import { checkOrigin, readJson, cleanText, clientIp, MAX_CHARS } from "../../../lib/guard/request";
import { ipKey, overLimit } from "../../../lib/guard/limit";
import { cookieSecret } from "../../../lib/guard/config";
import { SLOW_DOWN } from "../../../lib/rules/budget";

export const runtime = "nodejs";
export const maxDuration = 60;
const reject = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const nc = notConfigured();
  if (nc) return nc;
  const bad = checkOrigin(req);
  if (bad) return reject(bad.status, bad.error);
  const parsed = await readJson(req);
  if (!parsed.ok) return reject(parsed.rejection.status, parsed.rejection.error);
  const text = cleanText(parsed.body?.text);
  if (!text) return reject(400, `Please send a message of 1 to ${MAX_CHARS} characters.`);
  const claude = claudeClient();
  if (!claude) return reject(503, "Chat is not available right now.");

  const now = Date.now();
  const ipHash = await ipKey(clientIp(req), cookieSecret());
  if (await overLimit(store, ["chatMinute", "chatDay"], ipHash, now)) {
    await store.log({ event: "rate_limited", route: "chat", ipHash }).catch(() => {});
    return reject(429, SLOW_DOWN);
  }

  const { visitorId, conversationId, setCookies } = await ids(req.headers.get("cookie"));
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(c) {
      const send = (event: string, data: unknown) => c.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const r = await handleMessage({ claude, store, conversationId, visitorId, text, now, onStep: (s) => send("step", s) });
        send("answer", { text: r.reply, status: r.status });
      } catch (e) {
        // Full error to the staff log only; the visitor gets the fixed fallback (no stack, no names).
        await store.log({ event: "chat_route_error", detail: String(e).slice(0, 500), conversationId }).catch(() => {});
        send("error", { text: FALLBACK });
      } finally {
        c.close();
      }
    },
  });
  const headers = new Headers({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(stream, { headers });
}
