# evals: the judge, kept apart from the agent (D-55, D-56)

The agent answers customers. The eval judges the agent. A judge that shares code, keys or answers
with the one being judged can't be trusted, so they are kept apart, and `tests/separation.test.ts`
fails the build if they touch.

| Rule | How it's enforced |
|---|---|
| The agent never sees the eval. Nothing in `lib/`, `app/`, `mcp/` or `scripts/` imports from `evals/`. | separation test 1 |
| The eval reaches the agent through one door only: `target.ts` (send a message, read the transcript and tickets). | separation test 2 |
| The eval owns its expected answers (e.g. the safety message). They are written here, not imported, so a changed agent message is caught, not silently accepted. | `cases.ts` |
| The eval measures cost itself, from raw model usage, with its own price table. | `run.ts` meter |
| No teaching to the test: no 6-word run of any eval question may appear in the agent's prompt or tool descriptions. | separation test 3 |
| Separate key: `ANTHROPIC_EVAL_API_KEY`, its own spend limit. The runner refuses to start if the site's key, database or cookie secret is present. | `run.ts` |
| Separate data: every case runs on a fresh in-memory copy of the fictional shop. The real database is never touched. | `target.ts` |
| Separate workflow: `.github/workflows/eval.yml`, manual only. | GitHub Actions |
| Fixing a failing case means fixing the AGENT, never editing the case to match a new answer. A grader can only be changed for a grader bug, logged in DECISIONS.md with the run that showed it. | review criterion 5 |

Step 2 (later): a Claude grader for what code can't judge. It gets only the customer messages, the
replies and the written criteria. Never the agent's system prompt, tools or reasoning. Its own key.
