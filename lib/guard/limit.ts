// G6 Per-IP rate limits. The IP is stored only as a keyed hash: the database never holds
// real addresses, and without the secret the hashes can't be turned back into IPs.
import type { Store } from "../tools/store";
import { RATE_RULES, overRate, windowStart } from "../rules/budget";
import { mac } from "./signed";

export async function ipKey(ip: string, secret: string): Promise<string> {
  return (await mac(`ip:${ip}`, secret)).slice(0, 22);
}

// Counts this request, then says whether it is over ANY of the given rules.
export async function overLimit(store: Store, rules: (keyof typeof RATE_RULES)[], ipHash: string, now: number): Promise<boolean> {
  let over = false;
  for (const name of rules) {
    const rule = RATE_RULES[name];
    const n = await store.hit(`${name}:${ipHash}`, windowStart(now, rule.windowMs));
    if (overRate(n, rule)) over = true;
  }
  return over;
}
