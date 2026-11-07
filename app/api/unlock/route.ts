import { ACCESS_COOKIE, safeEqual } from "../../../lib/access";

export async function POST(req: Request) {
  const code = process.env.SHOPDESK_ACCESS_CODE;
  const form = await req.formData();
  const given = String(form.get("code") ?? "").trim();
  const ok = !code || safeEqual(given, code);
  const res = Response.redirect(new URL(ok ? "/" : "/unlock?wrong=1", req.url), 303);
  if (ok && code) {
    const headers = new Headers(res.headers);
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers.append("Set-Cookie", `${ACCESS_COOKIE}=${encodeURIComponent(code)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${secure}`);
    return new Response(null, { status: 303, headers });
  }
  return res;
}
