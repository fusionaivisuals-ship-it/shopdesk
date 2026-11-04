---
paths: ["**/*.test.ts"]
---
# Rules for unit tests (D-16)

- Use only the fictional Glow & Co data in `data/`.
- Never call the real Claude API in unit tests. Use a recorded or fake response so tests cost $0 and give the same result every run.
