# ShopDesk

A read-only AI support agent for a fictional skincare shop (Glow & Co): answers policy questions and looks up orders for verified customers. English only.

Design decisions and their reasons are in `DECISIONS.md` (D-01, D-02 ...). Read the relevant entry before changing anything it covers; don't load the whole file by default.

## Rules for building ShopDesk
- Business rules (verification, attempt locks, return eligibility) are code in `lib/rules/`. Never implement them as instructions in the agent's prompt.
- Run the tests before saying a task is finished.
