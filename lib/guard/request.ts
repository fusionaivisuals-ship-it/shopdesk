// Gates every POST passes before any work is done (SECURITY.md G1-G3).
export type Rejection = { status: number; error: string };

// G1 Same-origin: browsers always send Origin on POST. A page on another site can't make our
// visitors' browsers spend the demo budget (cross-site request forgery).
export function checkOrigin(req: Request): Rejection | null {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return { status: 403, error: "Forbidden." };
  try {
    if (new URL(origin).host !== host) return { status: 403, error: "Forbidden." };
  } catch {
    return { status: 403, error: "Forbidden." };
  }
  return null;
}

// G2 Body size + type, checked BEFORE parsing, so a huge body can't tie up the server.
export const MAX_BODY_BYTES = 4096;
export async function readJson(req: Request): Promise<{ ok: true; body: any } | { ok: false; rejection: Rejection }> {
  if (!(req.headers.get("content-type") ?? "").startsWith("application/json")) {
    return { ok: false, rejection: { status: 415, error: "Send JSON." } };
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return { ok: false, rejection: { status: 413, error: "Message too large." } };
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return { ok: false, rejection: { status: 413, error: "Message too large." } };
  try {
    return { ok: true, body: JSON.parse(raw) };
  } catch {
    return { ok: false, rejection: { status: 400, error: "Bad request." } };
  }
}

// G3 The customer's text: a string, 1-1000 characters, control characters removed (newlines kept).
export const MAX_CHARS = 1000;
export function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "").trim();
  return t.length >= 1 && t.length <= MAX_CHARS ? t : null;
}

// Client IP as Vercel reports it. Vercel overwrites x-forwarded-for, so a visitor can't fake it.
// Stored only as a keyed hash (see ipKey), never as the raw address.
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
