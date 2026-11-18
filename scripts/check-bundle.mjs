// G12 After `next build`: fails if any file the BROWSER downloads mentions a server secret's name
// or contains a secret-looking value. Proves the API key can't reach a visitor, by construction.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NAMES = ["ANTHROPIC_API_KEY", "SHOPDESK_DATABASE_URL", "SHOPDESK_COOKIE_SECRET", "SHOPDESK_ACCESS_CODE", "@anthropic-ai/sdk", "neondatabase"];
const VALUES = [/sk-ant-[A-Za-z0-9_-]{20,}/, /postgres(?:ql)?:\/\/[^\s"']+@/];
for (const k of ["ANTHROPIC_API_KEY", "SHOPDESK_DATABASE_URL", "SHOPDESK_COOKIE_SECRET", "SHOPDESK_ACCESS_CODE"]) {
  if (process.env[k] && process.env[k].length >= 8) VALUES.push(process.env[k]); // the real values, when the build has them
}
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(".next/static");
const hits = [];
for (const f of files) {
  const t = readFileSync(f, "utf8");
  for (const n of NAMES) if (t.includes(n)) hits.push(`${f}: mentions ${n}`);
  for (const v of VALUES) if (typeof v === "string" ? t.includes(v) : v.test(t)) hits.push(`${f}: contains a secret value`);
}
if (hits.length) { console.error("BUNDLE CHECK FAILED\n" + hits.join("\n")); process.exit(1); }
console.log(`bundle check: ${files.length} browser files clean`);
