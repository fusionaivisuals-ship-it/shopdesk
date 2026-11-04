# ShopDesk

A read-only AI support agent for a fictional skincare shop (Glow & Co): answers policy questions and looks up orders for verified customers. English only.

Design decisions and their reasons are in `DECISIONS.md` (D-01, D-02 ...). Read the relevant entry before changing anything it covers; don't load the whole file by default.

## Rules for building ShopDesk
- Business rules (verification, attempt locks, return eligibility) are code in `lib/rules/`. Never implement them as instructions in the agent's prompt.
- Run the tests before saying a task is finished.

## Review criteria (used while building AND by the CI review bot, D-23/D-24)
Flag a change only if it:
1. puts a business rule (verification, locks, eligibility) in a prompt instead of `lib/rules/` (D-02b, D-07);
2. makes a tool return fields outside the D-06 list, or verification detail beyond the generic result (D-04);
3. changes code in `lib/rules/` without a matching test change (D-16);
4. adds a secret (API key, password) to a committed file.
Ignore style and naming.
