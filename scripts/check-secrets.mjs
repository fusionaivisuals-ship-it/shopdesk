// G11 Fails if any committed file contains something that looks like a real secret (review criterion 4,
// enforced by code, not only by the AI reviewer). Runs in CI on every push and pull request.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  ["Anthropic API key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["database URL with password", /postgres(?:ql)?:\/\/[^\s:@/'"`$]+:[^\s@/'"`$]{6,}@/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["Vercel token", /\bvercel_[A-Za-z0-9]{20,}/i],
];
const files = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter((f) => f && !f.startsWith("package-lock"));
const hits = [];
for (const f of files) {
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue; // binary
  for (const [name, re] of PATTERNS) if (re.test(text)) hits.push(`${f}: looks like a ${name}`);
}
if (hits.length) { console.error("SECRET SCAN FAILED\n" + hits.join("\n")); process.exit(1); }
console.log(`secret scan: ${files.length} files clean`);
