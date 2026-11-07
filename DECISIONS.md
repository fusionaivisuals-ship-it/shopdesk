# ShopDesk — decisions (Niel's words)

Context: fictional skincare shop, English only.

## D-01 What the agent may do: B (answer + look up orders, no actions) — 2026-11-03
- Why (Niel): Answer-only is too short-term and useless for a shop or for learning. Actions with money (C) are the future, but while I'm learning, a mistake involving money could be horrendous for me and a client.
- Rejected: A answer-only (no long-term value); C act (money moves before I can enforce rules reliably).
- Later: C is a planned upgrade; B must be built so actions can be added as new tools, not a redesign.
- Meeting line: "We start read-only because the main risk is data exposure, which we can control; we add money-moving actions only once the enforcement layer is proven."
- Exam link: TS 1.4, 2.3 (scope of tools = scope of risk)

## D-02 Identity check: B (email + order number must match) — 2026-11-03
- Why (Niel): Shows I know what I'm doing and why, and it can be tested on my site: I give testers a sample email + order number.
- Rejected: A order number only (guessable/shared); C one-time email code (more build, drop-off) — needed later before any actions (see D-01); D shop login (too heavy for small shops).
- Demo note: public test credentials only ever unlock fictional data.
- Meeting line: "Email plus order number is proportionate for read-only order status; we upgrade to a one-time code before the agent can change anything."
- Who enforces: see D-02b
- Exam link: TS 1.4 (prerequisite before order data)

## D-02b Who enforces identity: C (code, verify once -> 'verified' flag in the database) — 2026-11-03
- Why (Niel): A (Claude decides) won't hold long term and could show the wrong order to a customer. B (check inside each lookup) breaks when a customer has several orders and asks several things in one message. C gives long-term stability: I know I'm talking to the right customer and can handle several questions at once.
- How it works: verify_customer(email, order_number) -> code sets conversations.verified_customer_id. Every lookup returns ONLY orders of that verified customer. Claude never stores or decides 'verified'.
- Why A fails even at 99%: by the time Claude decides, the order data is already in its context; a prompt is a request, so 1 in 100 pushy customers gets someone else's data. Code makes it 0, and the data never reaches Claude.
- Upgrade path: the one-time email code (D-02 option C) plugs into verify_customer later without changing lookups.
- Meeting line: "Identity is a fact stored by code, not something the AI remembers or judges; the AI can only see orders that code has already proven belong to this customer."
- Exam link: TS 1.4 (programmatic prerequisite), 1.5 (a hook can block lookups before verification)

## D-03 Failed verification: 3 tries -> 15-min lock -> 3 more tries -> human only — 2026-11-03
- Why (Niel): Unlimited retries (A) invite scripted guessing; sooner or later a guesser hits a real email. Handoff-only (B) floods staff at scale. B+C with a hard stop: a guesser gets 6 tries total, which is very unlikely to hit a valid email+order pair. Fewer problems long term, and the numbers can be tuned if it causes too much friction.
- Enforced by: code (attempt counter + lock timestamp), never Claude.
- Open: what the counter is tied to, and what the agent says on failure (D-03b).
- Meeting line: "Six attempts, then a person: generous to typos, useless to scripts, and the thresholds are settings, not rewrites."
- Exam link: TS 1.4 (enforced workflow), 5.2 (escalation trigger: can't proceed)

## D-03b Lock attaches to: order number AND visitor (IP/browser); failure message is generic — 2026-11-03
- Why (Niel): Per-conversation counters reset when a guesser opens a new chat. Tying the lock to the order protects each order; tying it to the visitor stops one person spraying many orders. The message stays generic ("those details don't match our records") because "the order number is wrong" tells a guesser the email is probably right.
- Accepted side effect: someone can deliberately lock a real customer's order; that customer is routed to a human, nothing leaks.
- Meeting line: "Limits follow the target and the attacker, not the chat window, and failures never reveal which half was right."
- Exam link: TS 1.4, 2.2 (what an error reveals), 5.2

## D-04 What verify_customer returns to Claude: C (generic result + attempts left + next step) — 2026-11-03
- Why (Niel): Claude never gets the full reason, so it can't leak it. B (generic only) would also be safe and the log still holds the detail; C adds what Claude needs to respond well and when to stop.
- Shape: {ok:false, reason:"no_match", attempts_left:n, next_step:"..."}; at the limit {locked:true, unlock_in_minutes:15, next_step:"offer email contact"}. Detailed reason -> server log only.
- Other leak paths if Claude had the detail: handoff ticket text, stored transcripts, conversation summaries, later turns.
- Future idea (Niel): on a large, busy shop, a separate owner-side Claude assistant could read the logs to spot and help fix small problems. That is a different role with different tools.
- Meeting line: "Tools give the AI what it needs to act, not everything they know; sensitive detail goes to logs that only staff can read."
- Exam link: TS 2.2 (structured errors with next step), 2.3 (different roles, different tools)

## D-05 Order lookup tools: B (list_orders summary + get_order(order_number) detail) — 2026-11-03
- Why (Niel): Filters (C) make Claude guess; 9/10 right is exactly what we're avoiding (a wrong filter = "not found" for a real order). One big tool (A) floods context as order counts grow. B keeps context small and brings only the order in question into context.
- Both tools only ever see the verified customer's orders (D-02b).
- Consequence: two similar tools -> their descriptions must say when to use each (list first, then get one).
- Meeting line: "The agent browses a short list, then opens one record, like a human agent would; context cost stays flat whether a customer has 2 orders or 200."
- Exam link: TS 2.1 (tool split + descriptions), 5.1 (keep context small)

## D-06 What get_order returns: B, trimmed to items, status, delivery dates, tracking link — 2026-11-03
- Why (Niel): Never the full record; only what the customer's question needs. Status-only (C) would push too many chats into support tickets. Start with B and run a one-month trial to see whether the field list causes problems.
- Excluded: full address, phone, payment details, internal notes, warehouse codes (never sent to Claude, so they can't leak into replies, transcripts or tickets).
- Trial: 1 month of logged chats, then review which questions failed for lack of a field.
- Meeting line: "The agent gets the minimum data to answer support questions; anything it never receives, it can never leak."
- Exam link: TS 2.1/5.1 (trimmed tool output), 5.5 (review real results before widening)

## D-07 "Can I return this?": C (code decides eligibility, Claude explains) — 2026-11-03
- Why (Niel): A sends one of the most common questions to support. B leaves Claude doing date maths and rule-reading = the 9-out-of-10 problem. C puts the policy in code, so it can be checked and referenced easily, with a URL to the policy section.
- Shape: get_order returns per item {return_eligible, reason, policy_section, policy_url}; Claude only explains.
- Needed facts: delivery date + opened yes/no (added to D-06 fields for this purpose only).
- Niel's "mix of B and C": code decides the mechanical rules; cases that need judgment (e.g. opened item + reported reaction) are not decided by Claude either -> see D-08.
- Meeting line: "Eligibility is computed, not interpreted: same facts, same answer, with a link to the exact policy line."
- Exam link: TS 1.4 (deterministic rule in code), 5.6 (answer cites its source)

## D-08 Skin reaction reports: B (Claude detects, code handles what follows) — 2026-11-03
- First choice (Niel): C, a keyword list + immediate handoff, because Claude might miss 1 in 10 and that one miss could be serious.
- Changed to B because: spotting a reaction is language understanding, not a mechanical check. A keyword list misses normal phrasing ("my skin freaked out", typos) and false-alarms ("burn-relief balm"), so it can be worse than Claude, and it fails silently on real reactions.
- How it works: Claude calls report_reaction when it recognises a reaction -> code sends a fixed, pre-approved safety message, creates an URGENT ticket for a person, and stops product advice in that chat.
- Later test: 30 realistic messages, compare keyword-only vs Claude-only vs both (measured, not assumed).
- Meeting line: "The AI decides what is happening, because that's language; code decides what happens next, because that's safety."
- Exam link: TS 5.2 (escalation), 1.4 (enforced follow-up); trap = keyword/text matching for meaning

## D-09 "I want a real person": a permanent "Talk to a person" button — 2026-11-03
- Why (Niel): Handoff must be immediate and hard-coded; it cannot be ignored or decided by Claude.
- How: the button is always visible in the chat window; clicking it creates the ticket in code (no AI involved) and shows a fixed "a person will reply within X hours" message.
- Typed requests ("can a human help?"): Claude points the customer to the button; no separate AI-triggered handoff tool for now. If Claude misses one, the button is still on screen, so the failure is recoverable.
- Rejected: Claude tries first (ignores a clear request); mood-based handoff (anger is a poor signal).
- Meeting line: "Reaching a human never depends on the AI understanding you: there's a button, always."
- Exam link: TS 5.2 (explicit request for a human = honour immediately), 1.4

## D-10 Policy text: B (search_policy + read_policy tools) — 2026-11-03
- Why (Niel): A (whole policy in the prompt) risks Claude making answers up to satisfy a customer, or giving no answer. C (pre-written answers) is unpredictable: you can only think of so many questions at the start.
- Note: A's real limits are size and details lost in long text; making things up is a risk in B too when search finds nothing -> handled in D-11.
- Same list-then-open pattern as orders (D-05); answers cite the section + URL (D-07).
- Meeting line: "The agent looks up the relevant policy section like a new staff member would, and quotes it, instead of memorising the whole handbook."
- Exam link: TS 2.1 (search/read pair), 5.1 (context), 5.6 (citations)

## D-11 Search finds nothing: B (say it isn't in the policies, point to the button) + test run — 2026-11-03
- Why (Niel): Never invent policy (A). C (search says *why* it found nothing) rejected: Niel expects it to cause problems later. Run a trial and count how many tickets come from "not found".
- Caveat (Claude): with B, a search outage also shows as "not in our policies". For policy questions that's low-harm (the customer is sent to a person, nothing false is promised) but the trial count will mix outages with real policy gaps. For ORDER lookups, an outage that looks like "no orders" would be a false statement -> revisit in Domain 2 (TS 2.2).
- Meeting line: "When the agent can't find a policy, it says so and hands over; unanswered questions become the owner's to-do list for the policy page."
- Exam link: TS 5.3 (don't hide failures), 2.2, 5.6

## D-12 Model: Haiku, with a test run — 2026-11-03
- Why (Niel): Cheap to run and test, and shows what problems actually appear. No clear case yet where a larger model is needed; going larger may cost too much to be worth it.
- Guard: hard daily spend cap stays (e.g. $1/day = max $30/month, $365/year; ~NT$960/month, NT$11,700/year). Prices not verified.
- Upgrade trigger: if the test run shows misses on reaction detection (D-08), wrong sibling tool (D-05, D-10) or improvised policy (D-11), rerun the same test set on Sonnet and compare before switching.
- Meeting line: "Most rules live in code, so the model mainly handles language; we start with the cheapest model and only upgrade where a measured failure justifies the cost."
- Exam link: cost/latency trade-off; measure before changing (TS 5.5)

## D-13 Off-topic questions: B (strictly in scope, fixed polite redirect) — 2026-11-03
- Why (Niel): Least room to break the chatbot or get something else out of it. Product-catalogue answers (C) can come later.
- First reasoning picked C as "least room"; corrected: every allowed topic is more surface to push on, so B is the narrowest.
- Real protection against "give me a discount code": no such tool exists (D-01). A missing tool can't be argued with; a prompt can.
- Meeting line: "The agent's scope is orders and policies only, and it has no tools that could give anything away, so jailbreaks have nothing to win."
- Exam link: TS 2.3 (tool scope = attack surface), 4.1 (explicit scope criteria)

---
PLANNING COMPLETE (13 decisions). Next: Domain 3 build, starting with TS 3.4 (plan mode turns these decisions into a repo structure).

## D3 S1 (TS 3.4) Repo structure approved — 2026-11-03
- Plan mode turned D-01..D-13 into a top-level tree (app, lib/rules, lib/tools, lib/agent, data, tests, CLAUDE.md + .claude). Niel approved: "looks good for now, needs to be created and then tested".
- Plan mode surfaced 2 gaps before building: where tickets go, where data lives.

## D-14 Tickets: written to a file Niel can read after test runs — 2026-11-03
- Why (Niel): For now, so I can check what I might have gotten wrong when I test it.
- Caveat (Claude): a file works when ShopDesk runs locally; on Vercel, written files don't persist between requests -> decide before going public (D-14b).

## D-15 Shop data (customers, orders, verified flag, lock counters): a database — 2026-11-03
- Why (Niel): database for now.
- Provider: Neon Postgres, free tier ($0/month, $0/year). Confirmed by Niel 2026-11-03.

## D-14b Tickets when public: B (database table + owner-only tickets page + "download as file") — 2026-11-03
- Why: works locally and on Vercel with one code path; Niel still gets a file to review after test runs.
- Rejected: file-only (lost on Vercel); file locally + database when public (two paths that drift, public version tested less).
- Meeting line: "One storage path for every environment; the file is an export, not the source of truth."

## D3 S1 result — 2026-11-03
- Exam question (one-line fix vs 30-file multi-shop change): answered C correctly. Reason (Niel): the one-line fix location is known; the multi-shop change must be planned precisely or both shops break.
- Skeleton folders created by direct execution after approval. Next: D3 S2, TS 3.1 (CLAUDE.md).

## D3 S2 (TS 3.1) Where each build instruction lives — 2026-11-03
- Placement drill: 2/5 right first time (1 Project, 5 Project). Corrected: 2 -> Personal, 3 -> Folder (lib/tools/CLAUDE.md), 4 -> enforcement, not CLAUDE.md.
- Final placements (pending Niel's approval to write):
  - shopdesk/CLAUDE.md: business rules are code in lib/rules, never prompt text; run tests before calling a task done.
  - lib/tools/CLAUDE.md: tools return trimmed fields only (D-06); verification failures return only the generic result (D-04).
  - ~/.claude/CLAUDE.md (Niel's computer, personal): plain-English explanations; costs in USD + NTD.
  - Secrets: .gitignore now; permission deny + secret scan in later D3 sessions.
- Written 2026-11-03: shopdesk/CLAUDE.md, lib/tools/CLAUDE.md, .gitignore. DECISIONS.md is referenced by path, NOT @imported (Niel: don't overload context from the start).

## D3 S2 result — 2026-11-03
- Exam question (freelancer missing a convention): answered B correctly (rule in personal ~/.claude/CLAUDE.md, not shared). Key clue: "works on my machine, not theirs" = difference in unshared config.
- Next: D3 S3, TS 3.3 (.claude/rules/ with path globs).

## D-16 Unit tests live next to their code (lib/rules/lock.test.ts beside lock.ts) — 2026-11-03
- Why (Niel): best long term, and it's common practice.
- Consequence: test files are spread across folders, so their conventions need a path rule in .claude/rules/ (a folder CLAUDE.md can't cover them). Planned test RUNS (D-08, D-12) stay in tests/.
- Meeting line: "Tests sit beside the code they check, so nobody changes a rule without seeing its test; one path rule applies test conventions wherever they are."
- Exam link: TS 3.3
- Written 2026-11-03: .claude/rules/tests.md with paths ["**/*.test.ts"] (Niel first picked lib/*/*.test.ts; corrected: * is one level only).

## D3 S3 result — 2026-11-03
- Pattern drill: picked lib/*/*.test.ts, corrected to **/*.test.ts. Exam Q (query files missed): chose **/*, correct **/*.query.ts. Glob scope = recurring weak spot; revisit in review.
- Next: D3 S4, TS 3.2 (commands and skills).

## D-17 "Add a new tool" steps: C (project skill /new-tool <name>) — 2026-11-04
- Choice: Niel (no reason stated). Suggested meeting line (Niel to confirm): "Procedures for one specific job are loaded on demand as a skill; CLAUDE.md only holds standards every session needs."
- Rejected: root CLAUDE.md (loads in every session); lib/tools/CLAUDE.md (misses the test + decision note elsewhere; loads on every edit, not only on creation).
- Exam link: TS 3.2 (skills vs always-loaded CLAUDE.md, project-scoped = shared)

## D-18 /new-tool runs WITHOUT context: fork — 2026-11-04
- Why (Niel): I want to see what happens, for my studies. A tool's files are short and are exactly what I want to review.
- First reason given for fork (avoid loading a client's orders) was about the live agent, not this build skill; that is solved by D-05.
- Fork is for later skills whose details we don't need (e.g. auditing all tools).
- Meeting line: "We fork skills that do verbose or exploratory work; we keep skills inline when their output is what we need to review."
- Exam link: TS 3.2 (context: fork)

## D-19 /new-tool allowed-tools: B (Read, Write, Edit, Glob, Grep; no Bash) — 2026-11-04
- Why (Niel): No-restriction (A) could cause problems later; B is safest for the test run and shows what can be done with a small set of tools. Can be widened later if needed.
- Consequence: the skill can't run tests itself; it must end by saying the test still needs to run, never claim it passes (CLAUDE.md: tests before "finished").
- Meeting line: "Each skill gets only the tools its job needs; a skill that adds one tool can't delete, install or push."
- Exam link: TS 3.2 (allowed-tools = safety, not context)

## D3 S4 result — 2026-11-04
- Wrote .claude/skills/new-tool/SKILL.md (argument-hint, allowed-tools without Bash, no fork).
- Exam Q (/audit-tools floods context): answered B (context: fork) correctly.
- Next: D3 S5, TS 3.5 (iterative refinement).

## D-20 How to build the lock rule: C (interview first, answers become the tests) — 2026-11-04
- Why (Niel): A means Claude guesses, which causes problems under heavy use. B risks locking in cases before any test run. C surfaces questions I might not have thought of and may suggest a new way to work.
- Note: tests are not permanent; they record today's decision. If the trial changes thresholds (D-03 says they're settings), the tests change with them.
- Meeting line: "For rules with edge cases, we let the AI interview us first, then turn every answer into a test before writing code."
- Exam link: TS 3.5 (interview pattern -> test-driven iteration)

## D-21 Lock rule interview answers (feed the tests) — 2026-11-04
- Q1 Success resets: that ORDER's counter only; visitor counter keeps counting (B). Niel's addition: log a note when fail-fail-success happens too often (possible guess testing). May change after the trial.
- Q2 Order lock vs visitor lock: EITHER lock blocks (B). First answer "visitor wins" changed: with cookie-based visitors (Q6), clearing cookies would defeat the order lock. When blocked -> a support ticket is created (Niel). Proposed detail: one ticket per locked order, not one per blocked attempt, so a script can't flood tickets (Niel to object if not).
- Q3 Failures expire after one month.
- Q6 "Same visitor" = browser cookie.
- Q4 After 'person only': C - a support person can unlock early from the tickets page; otherwise auto-unlock after 7 days. Why (Niel): staff shouldn't be solely responsible for unlocking; 24h auto-unlock gives a guesser 6 tries every day.
- Q5 Non-existent order number: counts against the VISITOR only (no order to lock); same generic 'details don't match' message, so order numbers can't be probed (D-03b). Claude's advice, Niel agreed.
- Interview complete -> answers become test cases.
- Test cases 1-15 approved 2026-11-04. Gaps filled (Claude's suggestion, Niel approved): "too often" = 3 fail-fail-success in 7 days per visitor; visitor limits = same as order limits (3, 15 min, 3, person only).
- 2026-11-04: lib/rules/lock.test.ts (15 cases) written first -> failed (no code); lib/rules/lock.ts written -> 15/15 pass (vitest, local run).
- FLAG: test 15 only passes because the test manually unlocks the visitor between rounds. With the approved rules, fail-fail-success x3 = 6 visitor failures, so the visitor lock (15 min at 3, person only at 6) fires before the 3rd success. The note (Q1 addition) and the visitor limits (gap 2) interact. Decision needed (D-22).

## D-22 Suspicious-pattern note dropped (A) — 2026-11-04
- Why (Niel): keep it simple for now, fewer problems to run into. The visitor lock already stops repeated fail-fail-success (3rd visitor failure = 15-min lock).
- Test 15 rewritten to check exactly that, with no workaround. 15/15 pass (local vitest run 2026-11-04).
- Lesson (TS 3.5): writing tests before code exposed two interacting decisions (Q1 note vs visitor limits). Interacting issues are resolved together in one decision, not patched one at a time.

## D3 S5 result — 2026-11-04
- Exam Q (two interacting fixes + one independent): answered C correctly. Refinement: the test is "do the fixes affect each other", not "are they similar".
- Next: D3 S6, TS 3.6 (CI/CD with claude -p). Needs a GitHub repo.

## D-23 CI checks: B (Claude review on explicit ShopDesk criteria only) + run the tests on every PR — 2026-11-05
- Why (Niel): try B and see how it goes; a generic "find any problems" review (A) won't work long term. Tests run in CI now as well, to pick up smaller problems and fix them as early as possible.
- Review criteria: (1) business rule in a prompt instead of lib/rules (D-02b, D-07); (2) tool returns fields outside D-06 or verification detail beyond the generic result (D-04); (3) rule code changed without a matching test change (D-16); (4) a secret in a committed file. Style and naming are explicitly ignored.
- Meeting line: "Tests catch what we wrote tests for; the AI review checks only our four design rules, so every comment it posts is one we decided matters."
- Exam link: TS 3.6, 4.1 (explicit criteria reduce false positives)

## D-24 Review criteria live in the project CLAUDE.md (A) — 2026-11-05
- Why (Niel): I don't want problems only caught afterwards in review; with the criteria in CLAUDE.md, Claude Code avoids the mistakes while building, and CI reads the same file. A separate file (C) or the CI prompt (B) leaves a building gap.
- Meeting line: "The same four rules guide the AI while it writes code and when it reviews it, from one file, so the rules can't drift apart."
- Exam link: TS 3.6 (CLAUDE.md gives CI its project context), 3.1

## D-25 Review re-runs: B (pass previous findings; report only new or still-unfixed) — 2026-11-05
- Why (Niel): reviewing from scratch (A) causes duplicate comments and bloated context long term; deleting and reposting (C) might work but loses discussion and history.
- Open: who has the final word on "fixed" (D-25b).
- Exam link: TS 3.6 (prior findings in context to avoid duplicate comments)

## D-25b Who decides "fixed": C (code closes what it can prove, a person closes the rest) — 2026-11-05
- Why (Niel): the bot alone (A) is too risky and might only be a temporary fix; a person for everything (B) creates too much review work for small fixes that don't need a human.
- Code-provable example: criterion 3 (rule code changed without a test) -> closed automatically when the PR also changes the matching .test.ts. Criteria 1, 2, 4 -> the bot may say "looks fixed"; a person closes the thread.
- Meeting line: "The bot can suggest a fix is done, but only code or a person can close a finding, because a wrongly closed problem is never looked at again."
- Exam link: TS 3.6, 5.5 (model judgment is a suggestion, not proof)

## D-26 Review output schema: findings[] + required review_status complete|incomplete (B) — 2026-11-05
- Choice: Niel (no reason stated). Suggested meeting line (Niel to confirm): "A clean review always means checked and clean; if the bot couldn't finish, the check fails and says why."
- Rejected: empty findings on failure (A: "couldn't review" = "found nothing", same trap as D-11); warning only (C: warnings get ignored).
- Schema: {review_status, incomplete_reason?, findings: [{file, line, criterion 1-4, explanation, suggested_fix, status new|still_open|looks_fixed}]}
- Exam link: TS 3.6 (--output-format json + --json-schema), 5.3 (failure must stay visible)

## D-27 CI review model: Haiku (for now) — 2026-11-05
- Why (Niel): this is a test product. For a real product I'd choose Sonnet, which I think is best for review, especially code.
- Guard: hard monthly limit on the CI API key in the Anthropic console (e.g. $5/month = $60/year, ~NT$160/month, NT$1,920/year). Prices not verified.
- Upgrade trigger: if the review misses a finding we later catch by hand, rerun that PR on Sonnet and compare (same approach as D-12).
- Meeting line: "We review with the cheap model while the stakes are a demo; for a real client, code review is where the larger model earns its cost, because reviews are rare and misses are expensive."
- Exam link: TS 3.6, cost vs reliability trade-off

## D3 S6 test run — 2026-11-05
- PR #1 deliberately put return eligibility in the agent prompt (criterion 1).
- tests: success (run 41881600262, 01:54:38 Taipei) -> tests can't see this mistake.
- claude-review: success (run 41881600285, 01:54:55 Taipei), posted 1 open finding: criterion 1 at lib/agent/system-prompt.ts:4, correct reason and fix. No false positives.
- Observation: the check is green even with an open finding, because only "incomplete" fails it (D-26). Whether open findings should block merging is undecided (D-28).

## D-28 Open findings block merging, a person can override with the "review-override" label (C) — 2026-11-05
- Why (Niel): comment-only (A) means someone has to go and read the comments, which slows things down and gets missed; blocking with no way out (B) lets each small problem hold up the whole process.
- How: the claude-review check fails while there are open findings, unless the PR has the review-override label. Adding/removing the label re-runs the check WITHOUT a new Claude call (reuses the findings, $0).
- Meeting line: "Findings block by default; a person can overrule the bot, but only visibly, with a label on the record."
- Exam link: TS 3.6, 5.5 (human review where the model may be wrong)
- Incident: commit eca0287 pushed a review.mjs with a syntax error (Claude's command committed even though the syntax check failed). Fixed in the next commit; commit steps now only run after the check passes.
- D-28 / D-25 verified on PR #1 re-run (commit d39e1f5): tests success (run 41882929845); claude-review FAILURE (run 41882929851, 02:02:17 Taipei) = blocked by 1 open finding, no override label. Still exactly 1 bot comment (updated, not duplicated); finding status "still_open".
- Domain 3 build complete (TS 3.1-3.6).

## D-29 verify_customer description: C (full description + sample customer messages) — 2026-11-05
- Why (Niel): be prepared for the edge cases, which is exactly what could go wrong with B; A doesn't cover enough cases or give the LLM enough structure.
- Contents: what it checks + input formats; when to use (before any order question, once per conversation); when NOT (already verified, "checking" an email, retrying after locked, policy-only questions); what each result means (follow next_step, never say which detail was wrong); sample messages.
- Watch item (Domain 4): examples can make Claude over-match their exact wording; check this in the Haiku trial (D-12).
- Meeting line: "The tool's description is the agent's instruction manual; it says when to use the tool, when not to, and what to do with every result."
- Exam link: TS 2.1
- Built 2026-11-05 with /new-tool: data/shop.ts (fictional), lib/tools/store.ts (in-memory, Neon later), verify_customer.ts + test (8 tests). Full suite 23/23 pass (local run).
- 2026-11-06: added mixed-message example to verify_customer description after the 2.1 exam question (policy question that mentions an order -> search_policy, no verification).

## D-30 Tool errors: C (structured: isError, category, retryable, next_step); "no orders" stays a normal success — 2026-11-06
- Why (Niel): A is a mistake: with no record of what went wrong I can never fix things, and this LLM should help me, not hinder me. B is too little information to act on. C is best for long-term gain.
- Also (Claude): A's worst effect is on the customer: an outage looks like "you have no orders", so the agent states something false (TrailShop: 6/6 fooled; with a contract 0/15).
- Categories: transient (retry once), validation (ask the customer to correct), business (don't retry, explain), permission (do the prerequisite, e.g. verify_customer). Detail still goes to the staff log.
- Revisits D-11's caveat for policy search later (same contract).
- Meeting line: "Every tool failure says what kind it is and what to do next; an outage can never be mistaken for an empty result."
- Exam link: TS 2.2, 5.3
- Built 2026-11-06 with /new-tool: list_orders + test (verified customer only, summary fields, permission + transient errors; outage never returns an empty list). Suite 26/26 pass (local).
- D2 S2 exam Q (get_order timeout returned null): answered C correctly. Note: B (hook rewriting null) can't tell a real 'not found' from a timeout, so it would make every genuine not-found look like an outage; fix at the source.

## D-31 tool_choice for the live chat: B (auto everywhere) — 2026-11-06
- Why (Niel): forcing verify_customer first (A) makes simple questions complicated when the customer just wants an answer; tools every turn (C) means constant pointless calls.
- Niel's concern: auto gets riskier as the bot grows, because more choices mean more wrong guesses. Mitigations: keep the live agent's tool set small and clearly separated (owner tools like unlock_order never go to the live agent); every rule is enforced inside the tools, so a wrong guess hits a permission error, not a leak.
- Forced tool_choice is reserved for steps that must produce structured output (e.g. the handoff ticket in Domain 4).
- Meeting line: "The agent chooses its tools, but every tool checks the rules itself, so a wrong choice costs a retry, never a data leak."
- Exam link: TS 2.3 (tool_choice auto/any/forced; scoped tool sets)
- D2 S3 exam Q (owner tools added to the live agent behind a prompt): answered B correctly. Niel: a prompt-only guard means someone can try to talk the bot into reaching personal information.

## D-32 MCP servers: B (Neon's official MCP for database work + a small custom ShopDesk MCP server exposing only ShopDesk's own tools) — 2026-11-07
- Why (Niel): A (custom server for everything) is a waste of time. C (Neon only, query the database directly) goes past all the verification I built for a specific reason.
- Effect: testing from Claude uses the same tools as the live agent (same locks, trimmed fields, structured errors).
- Meeting line: "We use maintained servers for standard integrations and build our own only for logic that is ours; testing goes through the same rules customers hit."
- Exam link: TS 2.4 (community/official servers vs custom)

## D-33 ShopDesk MCP config: A (project .mcp.json, secret as ${SHOPDESK_DATABASE_URL}) — 2026-11-07
- Why (Niel): it's a project that may have to be shared. Personal config (B) only works short term and causes problems when going live or duplicating it. Pasting the real string (C) puts my keys in public.
- Meeting line: "The server config is shared in git; each person's credentials come from their own environment, so nothing secret is ever committed."
- Exam link: TS 2.4 (.mcp.json scoping + env var expansion)
- Built 2026-11-07: mcp/shopdesk-server.ts (verify_customer, list_orders over MCP, same rules as live agent) + .mcp.json with ${SHOPDESK_DATABASE_URL}. Smoke test over stdio: list before verify -> permission error; wrong details -> generic no_match; correct -> verified; list -> 2 orders, summary fields only. Storage still in-memory (env var used from the Neon session on).
- D2 S4 exam Q (Claude Code greps outdated policy instead of the MCP search_policy): answered B correctly. Niel also suggested deleting old policy versions; kept instead: old versions are evidence for 'what did the bot say on date X' (TS 5.6). Keep them marked superseded; tools answer from the current version only.
- D2 S5 (TS 2.5) practical on the real repo: 4/5. Grep found 3 callers of recordFailure( (a name-based search found 0); Glob found 3 test files; Grep located LIMITS at lock.ts:8, then Read only lines 8-14; Grep located the message, Edit changed one unique string; #5 'run the tests' is Bash (Niel said Read). Tests 26/26.
- D2 S5 exam Q (Edit fails: text not unique): answered C correctly. Note: Bash is not only for tests; sed is wrong here because it changes every occurrence, including the one that must stay.
- Domain 2 complete (TS 2.1-2.5): 5/5 exam questions correct.

## D-34 Database tables (approved plan) — 2026-11-07
- New, separate Neon project "shopdesk" (free plan, $0). Six tables, only for what is built: customers (D-02), orders (D-05), conversations with verified customer (D-02b), attempt_counters (D-03b, D-21), tickets (D-14b), staff_log (D-04, D-30). Products, order items and policies come later with get_order / search_policy.

## D-35 Region: C (database in Singapore + Vercel functions moved to Singapore) — 2026-11-07
- Why (Niel): test-run it. A (Singapore DB, US code) causes slow replies, especially while people are testing; B (US East everything) is a long-term problem for a Taiwan/Asia-focused product.
- Rule behind it: put the database next to the code that queries it (several queries per chat turn); then put both near the users.
- To verify at deploy time: whether the Vercel plan allows setting the function region to Singapore.
- Meeting line: "Database and server sit together in Singapore, next to our users, so a chat turn's many database calls stay fast."
- 2026-11-07: Neon project "shopdesk" (falling-bird-22823410, aws-ap-southeast-1 Singapore, created via Vercel Marketplace because the Neon org is Vercel-managed). Six D-34 tables + fictional data created.
- Store made async (a real database answers asynchronously): tools, MCP server and tests updated; behaviour unchanged (26/26). Claude's earlier "only store.ts changes" was wrong.
- Real-database check via the MCP server: verification persisted across server restarts. Found a bug the in-memory tests could not see: order dates shifted one day early (timezone conversion). Fixed (dates read as text); added lib/tools/store.neon.test.ts, which runs only when SHOPDESK_DATABASE_URL is set (skipped in normal runs/CI, $0). With the real database: 27/27.
- Lesson (TS 5.5-ish): tests on a fake store prove the logic, not the real storage; keep at least one integration test against the real thing.
- 2026-11-07 15:22 Taipei: database password reset (it had appeared in session tool output; never in files or git). Old password verified rejected. Deploy plan: connect the Neon store to the Vercel project in the Vercel dashboard so Vercel injects the connection string itself; the secret then never passes through chat or files.

## D-36 Chat turn structure: C (fixed code shell + adaptive Claude loop inside) — 2026-11-07
- Why (Niel): a fully fixed pipeline (A) breaks when people ask several questions at once; fully adaptive (B) depends on the LLM making the right choice every time. C removes the problems of both.
- Fixed shell (code, every turn): spend cap check (D-12) -> load conversation + verified flag (D-02b) -> [agent loop] -> save messages -> log.
- Adaptive inside: Claude chooses which tools, in which order, based on what each result shows (D-31 tool_choice auto).
- Meeting line: "Everything that must always happen is code around the conversation; only the conversation itself is left to the model."
- Exam link: TS 1.6 (fixed pipeline vs adaptive decomposition)
- D1 S1 exam Q (40-file audit missed cross-file leaks): answered B correctly. Niel's reasons: A and D suffer the lost-in-the-middle effect (D keeps missing the actual problem); C misses small mistakes that cause bigger ones later.

## D-37 Loop stop rule: B (continue on stop_reason "tool_use", stop on "end_turn"; safety cap 8 rounds as a backstop only) — 2026-11-07
- Why (Niel): A (stop when there's text) can stop before the loop is finished and send a possibly made-up answer; C (always 3 rounds) leaves detailed questions unanswered. B is mostly hard-coded and still has a stop for endless loops.
- Cap behaviour: hitting 8 rounds is an ERROR path: honest fallback message pointing to "Talk to a person" + staff-log entry. Any other stop_reason (e.g. max_tokens, refusal) takes the same path.
- Meeting line: "The model's own stop signal ends the loop; the round limit only exists to catch a broken loop, and it says so honestly when it fires."
- Exam link: TS 1.1 (stop_reason, tool results appended, anti-patterns)
- Built 2026-11-07: lib/agent/loop.ts + loop.test.ts (7 tests, scripted Claude, $0). Proves: text+tool_use doesn't stop the loop; tool results return with matching tool_use_id; tool errors reach Claude as is_error; unknown tool -> error result; cap 8 -> honest fallback + log; max_tokens -> fallback + log. Suite 33 passed, 1 skipped (DB integration test).
- D1 S2 exam Q (loop stops on 'any text'): answered B correctly. Niel's extra point on C: a fixed 3-round limit leaves no room for recovery steps such as retrying a temporarily unavailable API (D-30 'retry once' needs a round).

## D-38 Handoff ticket: C (structured; code fills the facts, Claude adds only a one-line "what the customer wants") — 2026-11-07
- Why (Niel): a transcript only (A) makes support read the whole chat to know what's happening; a Claude-written summary (B) can get a complaint detail wrong and cause real problems. C hard-codes what has actually been retrieved and done.
- Fields (code): verified customer or "not verified"; orders and tool results touched; handoff reason (lock / reaction / button); priority (urgent for reactions); link to transcript. Claude: one line, only when the model was involved (not for the button, D-09).
- Niel's addition: a short 60-day history of the customer's problems (e.g. repeated wrong-address deliveries, repeated refund requests), flags only, not a lot of information. How it is computed: D-38b.
- Meeting line: "Support gets a ticket they can act on in seconds: facts from the system, one line of intent, urgency up front."
- Exam link: TS 1.4 (structured handoff for humans without the transcript)

## D-38b 60-day history flags: B (code counts the customer's past tickets by type) — 2026-11-07
- Why (Niel): Claude reading past chats (A) can cause too many problems (a misread turns a normal customer into a "difficult" one); no history (C) costs support agents too much time.
- Rules: verified customers only (D-02b; unverified -> no history, to avoid leaking someone else's history); neutral counts ("2 x delivery problem"), never labels. New ticket types (e.g. delivery problem) are counted once the tool that creates them exists.
- Meeting line: "Support sees the customer's recent ticket counts, computed from records, not the model's opinion of them."
- Built 2026-11-07: lib/agent/handoff.ts + test (4 tests). Ticket = code facts (customer verified/not, orders mentioned, actions taken paired from tool calls/results, reason, recommended action, priority, transcript link) + one Claude line (null for the button). 60-day counts by type for verified customers only. tickets table extended (customer_id, priority, details jsonb, index) on Neon; count query checked read-only on the real database. verify_customer's lock ticket now uses the same structure. Suite 37 passed, 1 skipped.
- D1 S3 exam Q (gate checks 'called', not 'succeeded'): answered B correctly. Note on D: swapping get_order for list_orders doesn't help, because any tool behind the same broken gate leaks the same way; the gate's condition is the bug.

## D-39 Hooks: B (a "before tool" hook only for rules that span several tools; single-tool rules stay inside their tools) — 2026-11-07
- Why (Niel): no hooks (A) is foolish long term, especially with checks like email/order; repeating every check in a hook too (C) is overdoing it for now, though it may be needed later as the chatbot grows.
- First cross-tool rule (D-08): after report_reaction, every other tool is blocked in that conversation; only the handoff remains. New tools are covered automatically.
- Meeting line: "Rules that belong to one tool live in that tool; rules about the whole conversation live in one hook, so tools added later can't forget them."
- Exam link: TS 1.5 (PreToolUse interception for guaranteed compliance)
- Built 2026-11-07: lib/tools/report_reaction.ts (full description, urgent ticket via buildTicket), lib/agent/hooks.ts (beforeTool), loop wired: every tool call passes the hook; after a reaction, the turn's reply is the FIXED safety message even if the model wrote advice. Tests: hooks.test.ts (4). Suite 41 passed, 1 skipped.
- KNOWN GAP (to decide): the hook blocks TOOLS after a reaction, not TEXT. In a later turn the model could still write product advice without calling a tool. Option to decide next: after a reaction, code answers every later message itself ("a person will contact you") without calling Claude.

## D-39b After a reaction report: B (code answers every later message itself; Claude is not called) — 2026-11-07
- Why (Niel): Claude guided by the tool result (A) is 9/10, too little when wrong advice can cause problems; a second checker (C) can still let mistakes through (note: that checker would be a model, not code, so it is probabilistic too).
- Built: runTurn checks the conversation before any model call; after a reaction it returns a fixed reply ("a member of the team will contact you today... seek medical help if symptoms get worse"), $0, no advice possible. Closes the KNOWN GAP above. Test: Claude receives zero calls on the later message; still one ticket. Suite 41 passed, 1 skipped.
- Meeting line: "After a reaction report the AI is switched off for that conversation; only fixed, approved wording reaches the customer until a person takes over."
- D1 S4 exam Q (mixed timestamp/status formats from tools we can't change): answered C correctly (PostToolUse normalisation). Contrast with D-30: fix at the source when you own the tool and information would be lost; use an after-tool hook when the data is all there but in inconsistent formats and you can't change the tool.

## D-40 Weekly "what went wrong" investigation: C (coordinator picks subagents per chat, combines, chases gaps) — 2026-11-07
- Why (Niel): one agent over 30 transcripts (A) suffers lost-in-the-middle; the fixed full pipeline (B) is costly, though it could be an option at high volume if run overnight at lower cost; C may still have problems, but fewer.
- Note on "cheaper overnight": the saving comes from the Batch API (about half price, results within 24h, Domain 4.5), not from the time of day; overnight runs are where batching fits naturally.
- Offline only (never in the live chat, D-36). Built once real chats exist; designing it now, the subagent handoff format comes in TS 1.3.
- Meeting line: "The investigator spends effort where each failure needs it and keeps asking until the report has no gaps."
- Exam link: TS 1.2
- D1 S5 exam Q (investigator missed opened-product returns): answered C correctly. Reasoning: subagents did what they were assigned; synthesis can only combine what it receives; the coordinator's split was too narrow and it never checked for gaps.

## D-41 Investigator findings format: B (structured: claim, evidence, source, certain) — 2026-11-07
- Why (Niel): prose (A) depends on the right wording and won't give the best results; raw transcripts (C) fill the context window and the agent has to hope it pulls out the right information. B gives each agent precise information on what happened before and what needs to happen now.
- Also (Claude): A loses sources when summaries are summarised again; B keeps every claim linked to the exact chat and keeps conflicting findings side by side.
- Meeting line: "Agents pass each other findings with their sources attached, so every line of the final report can be traced back to a real conversation."
- Exam link: TS 1.3 (explicit context, structured content vs metadata), 5.6 (provenance)
- Built 2026-11-07: lib/investigate/findings.ts + test (3): subagentTask() writes goal, chats, constraints and prior findings (with sources) into the task; code rejects findings without a source; merging keeps conflicting findings side by side. Suite 44 passed, 1 skipped.
- D1 S6 exam Q (subagent ignored a constraint discussed with the coordinator): answered D correctly. Notes: B (fork) copies the whole discussion and its noise; forking is for exploring different approaches from one starting point, not for passing context. C's main flaw is 'if they need it': the subagent doesn't know the rule exists, so it won't go looking.

## D-42 Returning customer: C (fresh conversation, re-verify, then a code-made summary of recent contact; no old tool results) — 2026-11-07
- Why (Niel): resuming (A) means trusting old verification, which is scary; a completely fresh start (B) is a good idea but can irritate customers. C re-checks the customer and the order.
- Niel's limit: don't keep it longer than 48 hours. Read as: only contact from the last 48 hours is summarised (Niel to correct if he meant something else).
- Rules: the summary is added only AFTER verification as the same customer (a different person on the same browser sees nothing); it holds facts from records (tickets, their status, orders mentioned), never old tool results; current order data always comes from a fresh tool call.
- Current limit: chat messages aren't stored yet, so for now the summary covers recent tickets only.
- Meeting line: "Returning customers re-verify, then the agent gets a short factual note of the last 48 hours; anything current is looked up again, never remembered."
- Exam link: TS 1.7 (fresh start with structured summary vs resuming with stale tool results)
- Built 2026-11-07: lib/agent/returning.ts + test (4); verify_customer adds recent_contact only on success. Store: recentTicketsFor (SQL checked read-only on Neon). Proves: last-48h contact included after verification; older not carried; nothing shown before verification; a new chat is never verified because an old one was. Suite 48 passed, 1 skipped.
- Domain 1 build complete (TS 1.1-1.7).
- D1 S7 exam Q (resumed session answers from stale reads): answered B correctly. Niel: D can be costly but may be needed if there are many changes. That is the exam's own rule: resume + name the changed files when most context is still valid; start fresh with a structured summary when much has changed.
- DOMAIN 1 COMPLETE: 7/7 exam questions correct.
