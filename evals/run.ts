// Runs the eval set against the REAL model (D-55, D-56). Code grades every case; nothing is judged by a model.
// Usage (CI only): npm run eval. Key: ANTHROPIC_EVAL_API_KEY, the eval's OWN key (never the site's).
// The agent is reached only through ./target.ts. Each case gets a fresh agent with the fictional data.
import { writeFileSync, mkdirSync } from "node:fs";
import { CASES, type Case, type Check } from "./cases";
import { freshAgent, targetModel, type Usage } from "./target";

const RUN_CAP_CENTS = 200; // hard stop for the whole run: US$2
const CONCURRENCY = 3;
const NOW = Date.UTC(2026, 10, 10, 2); // fixed clock: 10:00 Taipei, after returns v2 took effect

// D-56 separation: the eval has its own key and never runs next to the site's secrets or database.
const key = process.env.ANTHROPIC_EVAL_API_KEY;
if (!key) { console.error("ANTHROPIC_EVAL_API_KEY not set. The eval uses its own key, never the site's."); process.exit(1); }
for (const forbidden of ["ANTHROPIC_API_KEY", "SHOPDESK_DATABASE_URL", "SHOPDESK_COOKIE_SECRET"]) {
  if (process.env[forbidden]) { console.error(`${forbidden} is set. The eval must not run with the site's secrets.`); process.exit(1); }
}
const model = targetModel(process.env.EVAL_TARGET_MODEL);
// The eval's own price table (US cents per million tokens), separate from the site's budget rules.
const PRICE = { input: 100, output: 500 };
const centsFor = (u: Usage) => (u.input_tokens * PRICE.input + u.output_tokens * PRICE.output) / 1_000_000;
let spent = 0;

type Call = { name: string; input: unknown };
type Outcome = { id: string; category: string; why: string; pass: boolean; failures: string[]; replies: string[]; tools: string[]; cents: number; ms: number; error?: string };

function toolCalls(messages: any[]): Call[] {
  const out: Call[] = [];
  for (const m of messages) if (m.role === "assistant" && Array.isArray(m.content))
    for (const b of m.content) if (b.type === "tool_use") out.push({ name: b.name, input: b.input });
  return out;
}
const hit = (text: string, p: string | RegExp) => (typeof p === "string" ? text.toLowerCase().includes(p.toLowerCase()) : p.test(text));
const show = (p: string | RegExp) => (typeof p === "string" ? JSON.stringify(p) : String(p));

function grade(c: Check, replies: string[], calls: Call[], tickets: any[]): string | null {
  const names = calls.map((x) => x.name);
  const at = (t?: number) => replies[t ?? replies.length - 1] ?? "";
  switch (c.kind) {
    case "tools_include": { const miss = c.tools.filter((t) => !names.includes(t)); return miss.length ? `expected tool(s) not called: ${miss.join(", ")}` : null; }
    case "tools_exclude": { const bad = c.tools.filter((t) => names.includes(t)); return bad.length ? `tool(s) should not be called: ${bad.join(", ")}` : null; }
    case "tool_order": { const a = names.indexOf(c.first), b = names.indexOf(c.then); return a < 0 || b < 0 || a > b ? `expected ${c.first} before ${c.then}; got [${names.join(", ")}]` : null; }
    case "reply_equals": return at(c.turn) === c.text ? null : `reply ${c.turn ?? "last"} is not the fixed message`;
    case "reply_has": return c.any.some((p) => hit(at(c.turn), p)) ? null : `reply ${c.turn ?? "last"} has none of ${c.any.map(show).join(" | ")}`;
    case "reply_lacks": { const bad = c.all.filter((p) => replies.some((r) => hit(r, p))); return bad.length ? `reply contains ${bad.map(show).join(", ")}` : null; }
    case "ticket": return tickets.some((t) => t.kind === c.kind_) ? null : `no ${c.kind_} ticket`;
    case "no_ticket": return tickets.length ? `unexpected ticket(s): ${tickets.map((t) => t.kind).join(", ")}` : null;
  }
}

async function runCase(c: Case): Promise<Outcome> {
  const t0 = Date.now();
  let cents = 0;
  const agent = freshAgent(key!, model, (u) => { const c2 = centsFor(u); cents += c2; spent += c2; });
  const conv = `eval-${c.id}`;
  const replies: string[] = [];
  let error: string | undefined;
  try {
    for (const [i, text] of c.turns.entries()) {
      if (spent >= RUN_CAP_CENTS) throw new Error("run cap reached");
      replies.push(await agent.send(conv, text, NOW + i * 60_000));
    }
  } catch (e) { error = String(e).slice(0, 200); }
  const calls = toolCalls(await agent.transcript(conv));
  const failures = error ? [`error: ${error}`] : c.checks.map((k) => grade(k, replies, calls, agent.tickets())).filter((x): x is string => !!x);
  return { id: c.id, category: c.category, why: c.why, pass: failures.length === 0, failures, replies, tools: calls.map((x) => x.name), cents, ms: Date.now() - t0, error };
}

const results: Outcome[] = [];
const queue = [...CASES];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { for (let c = queue.shift(); c; c = queue.shift()) results.push(await runCase(c)); }));
results.sort((a, b) => a.id.localeCompare(b.id));

const cats = [...new Set(results.map((r) => r.category))];
const pct = (n: number, d: number) => `${n}/${d} (${Math.round((100 * n) / d)}%)`;
const passed = results.filter((r) => r.pass).length;
const ms = results.map((r) => r.ms / Math.max(1, CASES.find((c) => c.id === r.id)!.turns.length)).sort((a, b) => a - b);
let md = `# ShopDesk eval: ${model}\n\nRun ${new Date().toISOString()} · ${results.length} cases · code-graded · cost ${(spent / 100).toFixed(3)} USD\n\n`;
md += `**Overall ${pct(passed, results.length)}** · median ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)} s per message\n\n| Category | Passed |\n|---|---|\n`;
for (const k of cats) { const rs = results.filter((r) => r.category === k); md += `| ${k} | ${pct(rs.filter((r) => r.pass).length, rs.length)} |\n`; }
md += `\n## Failures\n\n`;
for (const r of results.filter((r) => !r.pass)) {
  md += `### ${r.id} (${r.category}): ${r.why}\n- ${r.failures.join("\n- ")}\n- tools: ${r.tools.join(" → ") || "none"}\n`;
  r.replies.forEach((t, i) => (md += `- reply ${i}: ${t.replace(/\n/g, " ").slice(0, 400)}\n`));
  md += "\n";
}
if (passed === results.length) md += "None.\n";
mkdirSync("evals/out", { recursive: true });
writeFileSync("evals/out/report.md", md);
writeFileSync("evals/out/results.json", JSON.stringify({ model, spentCents: spent, results }, null, 2));
console.log(md);
