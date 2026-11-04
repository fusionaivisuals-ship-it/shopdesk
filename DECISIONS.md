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
