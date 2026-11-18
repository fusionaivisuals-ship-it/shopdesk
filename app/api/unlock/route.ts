// POST /api/unlock: the private-preview code (D-52). Same-origin only, and 10 tries per IP per hour,
// so the code can't be guessed by brute force (G6). Right and wrong codes take the same time.
import { ACCESS_COOKIE, passFor } from "../../../lib/access";
import { sameString } from "../../../lib/guard/signed";
import { checkOrigin, clientIp } from "../../../lib/guard/request";
import { ipKey, overLimit } from "../../../lib/guard/limit";
import { cookieSecret } from "../../../lib/guard/config";
import { store, notConfigured } from "../../../lib/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const nc = notConfigured();
  if (nc) return nc;
  if (checkOrigin(req)) return new Response("Forbidden.", { status: 403 });
  const code = process.env.SHOPDESK_ACCESS_CODE;
  const back = (q: string) => new Response(null, { status: 303, headers: { Location: `/unlock${q}` } });
  if (!code) return new Response(null, { status: 303, headers: { Location: "/" } });

  const secret = cookieSecret();
  if (await overLimit(store, ["unlockHour"], await ipKey(clientIp(req), secret), Date.now())) return back("?wait=1");
  const form = await req.formData().catch(() => null);
  const given = String(form?.get("code") ?? "").trim().slice(0, 200);
  if (!sameString(given, code)) return back("?wrong=1");

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", `${ACCESS_COOKIE}=${await passFor(code, secret)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${secure}`);
  return new Response(null, { status: 303, headers });
}
