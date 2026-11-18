// D-52: private test days. When SHOPDESK_ACCESS_CODE is set, every page and API needs the code once.
// The cookie holds a signed pass derived from the code, never the code itself (G4); changing the
// code in Vercel invalidates every old pass. Remove the variable to go public; no code change needed.
import { mac, sameString } from "./guard/signed";

export const ACCESS_COOKIE = "sd_access";

export function passFor(code: string, secret: string): Promise<string> {
  return mac(`access:${code}`, secret);
}

export async function allowed(code: string | undefined, cookie: string | undefined, path: string, secret: string): Promise<boolean> {
  if (!code) return true; // public mode
  if (path === "/unlock" || path === "/api/unlock") return true;
  return !!cookie && sameString(cookie, await passFor(code, secret));
}
