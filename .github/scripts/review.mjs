// ShopDesk CI review bot (D-23..D-27). Runs Claude Code with -p and a JSON schema,
// keeps ONE summary comment per PR (no duplicates, D-25), fails the check when the
// review is incomplete (D-26), and closes criterion-3 findings by code when the
// matching test file changed (D-25b).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, BASE_SHA, HEAD_SHA } = process.env;
const MARKER = "<!-- shopdesk-review -->";
const MAX_DIFF_CHARS = 100_000;
const api = (path, opts = {}) =>
  fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", ...(opts.headers || {}) },
  }).then(async (r) => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); });

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 50e6 });
const diff = git("diff", `${BASE_SHA}...${HEAD_SHA}`);
const changed = git("diff", "--name-only", `${BASE_SHA}...${HEAD_SHA}`).split("\n").filter(Boolean);

// Previous findings live as JSON inside our own summary comment.
const comments = await api(`/issues/${PR_NUMBER}/comments?per_page=100`);
const mine = comments.find((c) => c.body.includes(MARKER));
const prev = mine ? JSON.parse(mine.body.match(/<!-- data:(.*?) -->/s)?.[1] ?? "[]") : [];

let review;
if (diff.length > MAX_DIFF_CHARS) {
  // Decided by code, not the model: too big to review reliably (D-26).
  review = { review_status: "incomplete", incomplete_reason: `diff is ${diff.length} characters (limit ${MAX_DIFF_CHARS})`, findings: [] };
} else {
  const prompt = `You are the independent CI reviewer for this pull request.
Apply ONLY the "Review criteria" in CLAUDE.md (criteria 1-4). Ignore style and naming.
You may read files in the repo to understand the change.

Changed files:
${changed.join("\n")}

Previous findings on this PR (JSON):
${JSON.stringify(prev)}

Rules for previous findings: if one is still present, report it with status "still_open";
if the change appears to fix it, report it with status "looks_fixed". Report new problems
with status "new". Do not repeat a previous finding as new.
If you could not review everything (unreadable file, unclear diff), set review_status "incomplete"
and say why. Never return complete with an empty list unless you checked everything.

Diff:
${diff}`;
  try {
    const out = execFileSync("claude", [
      "-p", prompt,
      "--model", "haiku",
      "--output-format", "json",
      "--json-schema", readFileSync(".github/review-schema.json", "utf8"),
      "--allowedTools", "Read,Grep,Glob",
      "--disallowedTools", "Bash,Write,Edit",
      "--max-turns", "15",
    ], { encoding: "utf8", maxBuffer: 50e6, timeout: 10 * 60_000 });
    const parsed = JSON.parse(out);
    review = parsed.structured_output ?? JSON.parse(parsed.result);
  } catch (e) {
    review = { review_status: "incomplete", incomplete_reason: `review run failed: ${String(e.message).slice(0, 300)}`, findings: [] };
  }
}

// D-25b: criterion 3 is provable by code: close it if the matching test file changed.
for (const f of review.findings) {
  if (f.criterion === 3 && changed.includes(f.file.replace(/\.ts$/, ".test.ts"))) f.status = "closed_by_code";
}

const label = { 1: "Rule in a prompt", 2: "Tool returns too much", 3: "Rule changed without test", 4: "Secret committed" };
const row = (f) => `| \`${f.file}${f.line ? `:${f.line}` : ""}\` | ${f.criterion}. ${label[f.criterion]} | ${f.explanation} | ${f.suggested_fix} |`;
const section = (title, list) => list.length ? `\n**${title}**\n\n| Where | Criterion | Problem | Fix |\n|---|---|---|---|\n${list.map(row).join("\n")}\n` : "";
const open = review.findings.filter((f) => f.status === "new" || f.status === "still_open");
const looksFixed = review.findings.filter((f) => f.status === "looks_fixed");
const closed = review.findings.filter((f) => f.status === "closed_by_code");

const body = `${MARKER}
## ShopDesk review: ${review.review_status === "incomplete" ? "⚠️ INCOMPLETE" : open.length ? `${open.length} open finding(s)` : "✅ checked, no findings"}
${review.review_status === "incomplete" ? `\nReview incomplete: ${review.incomplete_reason}\n` : ""}${section("Open", open)}${section("Looks fixed: a person must confirm (D-25b)", looksFixed)}${section("Closed by code (matching test changed)", closed)}
<sub>Commit ${HEAD_SHA.slice(0, 7)} · criteria from CLAUDE.md · model: haiku (D-27)</sub>
<!-- data:${JSON.stringify(review.findings.filter((f) => f.status !== "closed_by_code"))} -->`;

if (mine) await api(`/issues/comments/${mine.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
else await api(`/issues/${PR_NUMBER}/comments`, { method: "POST", body: JSON.stringify({ body }) });

console.log(body);
if (review.review_status === "incomplete") { console.error("Review incomplete"); process.exit(1); }
