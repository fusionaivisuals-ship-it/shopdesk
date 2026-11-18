// Signed values (HMAC-SHA256, Web Crypto so it runs in middleware too).
// The server only trusts cookie values it signed itself: a visitor can't invent an id or a pass.
const enc = new TextEncoder();

async function key(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function mac(value: string, secret: string): Promise<string> {
  return b64url(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(value)));
}

export async function sign(value: string, secret: string): Promise<string> {
  return `${value}.${await mac(value, secret)}`;
}

// Returns the value only if the signature is ours; otherwise null.
export async function unsign(signed: string | undefined | null, secret: string): Promise<string | null> {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i <= 0) return null;
  const value = signed.slice(0, i);
  return sameString(signed.slice(i + 1), await mac(value, secret)) ? value : null;
}

// Constant-time comparison: takes the same time whether the first or last character differs.
export function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
