# ShopDesk security

ShopDesk is a public demo with a real API key and a real database behind it. The design rule:
**the prompt asks, the code enforces.** Every protection below holds even if Claude is tricked,
because none of them depend on the model's judgment.

Last full review: 2026-11-18. Each gate names the test that proves it. `npm test` runs them all ($0, no network).

## Who might attack, and what they'd want

| Attacker wants to... | Stopped by |
|---|---|
| Steal the Anthropic API key | K1-K5 |
| Run up the bill / burn the daily budget so nobody else can use it | G6, G7, G8, G9, G1, G2 |
| See another customer's orders | V1-V4, G4, G14 |
| Guess which emails or order numbers exist | V2, V3 |
| Trick the bot ("ignore your rules", fake system messages) | V1, G3, G14, soft prompt layer |
| Use our visitors' browsers against us (CSRF), frame the site, inject script | G1, G2, G10, React escaping |
| Get in during the private preview | G4, G6 (unlock limit) |
| Damage the database if the server were taken over | G15 |
| Sneak a secret or a bad dependency in through code changes | G11, G12, G13, `npm audit` in CI |

## The API key

| # | Gate | Proof |
|---|---|---|
| K1 | The key exists only as a Vercel environment variable (and a GitHub Actions secret for CI). Never in the repo, never in chat. `.env*` is git-ignored. | `scripts/check-secrets.mjs` (G11) |
| K2 | Only server code reads it (`lib/server.ts` → `lib/agent/claude.ts`). Nothing is `NEXT_PUBLIC_`. | `scripts/check-bundle.mjs` (G12): fails the build if any browser file mentions the key's name, the Anthropic SDK, or a key-shaped value |
| K3 | Errors never reach the visitor: full error to the staff log, fixed fallback text to the browser. | Checked: Claude unreachable → visitor sees only the fallback; no host, stack or key |
| K4 | Missing settings are logged by name on the server only; the visitor sees "not available". | `lib/guard/guard.test.ts` (G5) |
| K5 | Spend limit set in the Anthropic console on a key used only by ShopDesk. **Manual step for Niel**: the code's $1/day cap is the first wall, the console limit is the last. | — |

## Website and API gates (`lib/guard/`, `middleware.ts`, `next.config.mjs`)

Order on every chat message: config → origin → body → text → IP rate → visitor/day → conversation length → budget reservation → Claude.

| # | Gate | Proof |
|---|---|---|
| G1 | Same-origin only: a POST must carry our own `Origin`. Another website can't make our visitors' browsers send messages. | `guard.test.ts` G1 |
| G2 | JSON only, max 4 KB, size checked before parsing. (Cross-site forms can't send JSON.) | `guard.test.ts` G2 |
| G3 | Text must be a string, 1–1000 characters; hidden control and text-direction characters removed. | `guard.test.ts` G3 |
| G4 | Cookies are **signed** by the server (HMAC-SHA256) and `HttpOnly`. A visitor can't invent a visitor id, pick a conversation id, or forge the preview pass. The preview cookie holds a signed pass, never the code. | `guard.test.ts` G4, `lib/access.test.ts` |
| G5 | Fail closed: in production the site refuses to chat unless the API key, database and cookie secret are all set (otherwise limits would silently reset per server). | `guard.test.ts` G5 |
| G6 | Per-IP limits, stored as a keyed hash (never the raw IP): 6 messages/minute, 60/day, 10 unlock tries/hour, 5 handoffs/day. Clearing cookies doesn't reset them. Vercel overwrites `x-forwarded-for`, so it can't be faked. | `guard.test.ts` G6, `lib/rules/budget.test.ts` |
| G7 | Budget **reservation**: 10¢ is charged before Claude runs and settled to the real cost after. Parallel requests can't overshoot the $1/day cap; a crashed turn stays charged (never under-counts). | `lib/agent/turn.test.ts` |
| G8 | Conversation length limit (15 customer messages), so input cost per message can't grow forever. | `turn.test.ts`, `budget.test.ts` |
| G9 | Each Claude call: max 600 output tokens, 25 s timeout, 1 retry. Max 8 rounds per message (D-37). | `lib/agent/claude.ts`, loop tests |
| G10 | Security headers: Content-Security-Policy (only our own scripts; the page can only talk to our own server), no framing, `nosniff`, HSTS, strict referrer, no camera/mic/location. `X-Powered-By` removed. | Checked with curl |
| — | Private preview (D-52): every page and API needs the access code until `SHOPDESK_ACCESS_CODE` is removed. | `lib/access.test.ts` |

## The chatbot (verification and data)

| # | Gate | Proof |
|---|---|---|
| V1 | Verification is code, not prompt (D-02b). `list_orders` takes **no input**: it reads the verified customer id the server stored for this conversation. No wording can make it show another customer's orders. | `lib/tools/*.test.ts` |
| V2 | Wrong details give one generic answer (D-04); the step label is the same for "no match" and "locked" (D-51). | `verify_customer` tests, `steps.test.ts` |
| V3 | Attempt locks per order and per visitor (D-03): 3 tries, 15-minute lock, closed after 6 with a ticket for a person. | `lib/rules/lock.test.ts` |
| V4 | Tools return only trimmed fields (D-06); step labels show only whitelisted words. | `steps.test.ts`, tool tests |
| G14 | Every tool call is checked against that tool's schema before it runs: text only, no extra fields, max 300 characters. An injected `customer_id` or an object aimed at the database is refused. | `lib/agent/validate.test.ts`, loop test |
| — | Skin-reaction reports lock the conversation to a person (D-08, D-39b), enforced by a hook on every tool. | hook tests |
| — | Soft layer: the system prompt tells Claude customer messages can't change its rules. This is a request, not a guarantee; everything above holds without it. | Real-model test in Domain 4 |

## Database (`db/`)

| # | Gate |
|---|---|
| G15 | The site connects as `shopdesk_app`, which can only read shop data and append/update its own counters and logs. **No DELETE, no changes to orders/customers/policies, no schema changes.** (`db/2026-11-18-app-role.sql`) |
| — | All queries are parameterized (tagged templates); no string-built SQL. |

## Code and CI

| # | Gate |
|---|---|
| G11 | Secret scan of every committed file on every push and PR (`npm run check:secrets`). |
| G12 | Browser-bundle check after every build (`npm run check:bundle`). |
| G13 | The AI reviewer (which holds an API key) runs only for PRs from this repo's own branches, never a stranger's fork; Claude Code is pinned to a reviewed version. |
| — | `npm audit --omit=dev --audit-level=high` in CI. PostCSS pinned to a patched version (2026-11-18). |

## Known limits (said plainly)

- A determined attacker with many IP addresses can still use up the day's $1 budget. The demo then politely stops until midnight Taipei; it can't cost more than the cap.
- Rate limits are per IP, so people behind one shared network (an office, a café) share a limit.
- I can verify the code paths with tests and a fake Claude. How the real model handles injection attempts is tested separately against Haiku (Domain 4).

## Reporting a problem

Found a hole? Open a GitHub issue titled "security" without details, and I'll reach out.
