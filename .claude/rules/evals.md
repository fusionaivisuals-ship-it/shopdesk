---
paths: ["evals/**"]
---
# Rules for evals/ (D-56)
- The eval judges the agent; keep them apart. Only `evals/target.ts` may import agent code.
- Never change agent code (`lib/`, `app/`) while working in `evals/`, and never edit a case so the current agent passes. A failing case is fixed in the agent.
- Expected answers are written in `evals/`, never imported from the agent.
- Don't copy eval questions into prompts or tool descriptions, and don't copy tool-description examples into cases.
