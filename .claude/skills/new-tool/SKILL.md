---
name: new-tool
description: Add one new ShopDesk tool (file, trimmed output, description, test, decision link). Use only when creating a new tool, not when editing an existing one.
argument-hint: <tool-name>
allowed-tools: Read, Write, Edit, Glob, Grep
---
# Add a new ShopDesk tool: $ARGUMENTS

If no tool name was given, ask for it before doing anything.

1. Create `lib/tools/$ARGUMENTS.ts`. Read one existing tool first and follow its structure.
2. Return only the fields the customer's question needs (D-06). Never full records, addresses, phone numbers, payment details or internal notes.
3. Write the tool description: what it does, when to use it, when NOT to use it and which sibling tool to use instead.
4. Write `lib/tools/$ARGUMENTS.test.ts` next to it (D-16), using only fictional data from `data/`, no real Claude API calls.
5. Name the DECISIONS.md entry this tool implements (e.g. D-05) in a comment at the top of the file.

Finish by listing the files you created and saying: "The test has not been run yet; run it before calling this finished." You cannot run commands in this skill.
