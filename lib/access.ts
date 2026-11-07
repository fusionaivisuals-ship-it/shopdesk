// D-52: private test days. When SHOPDESK_ACCESS_CODE is set, every page and API needs the code once
// (kept in an httpOnly cookie). Remove the variable in Vercel to go public; no code change needed.
export const ACCESS_COOKIE = "sd_access";

export function allowed(code: string | undefined, cookie: string | undefined, path: string): boolean {
  if (!code) return true; // public mode
  if (path === "/unlock" || path === "/api/unlock") return true;
  return !!cookie && safeEqual(cookie, code);
}

// Same time whatever the input, so the code can't be guessed letter by letter from response times.
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
