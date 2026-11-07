// Investigator handoff format (D-40, D-41). Subagents start with an EMPTY context (TS 1.3),
// so everything they need is written into their task by code, and everything they return
// keeps its source attached.

export type Source = { conversationId: string; messageIndex: number | null; tool: string | null; at: string | null };
export type Finding = { claim: string; evidence: string; source: Source; certain: boolean };

// Checked by CODE before a finding is accepted: no source, no finding.
export function validFinding(f: any): f is Finding {
  return (
    typeof f?.claim === "string" && f.claim.trim().length > 0 &&
    typeof f?.evidence === "string" && f.evidence.trim().length > 0 &&
    typeof f?.source?.conversationId === "string" && f.source.conversationId.length > 0 &&
    typeof f?.certain === "boolean"
  );
}

// Merging keeps EVERY finding, including ones that disagree; conflicts are for the
// synthesis to state, never to silently drop.
export function mergeFindings(...lists: Finding[][]): { accepted: Finding[]; rejected: unknown[] } {
  const accepted: Finding[] = [];
  const rejected: unknown[] = [];
  for (const list of lists) for (const f of list) (validFinding(f) ? accepted : rejected).push(f);
  return { accepted, rejected };
}

// The full task a subagent receives. Goal + quality criteria, not a step-by-step recipe.
export function subagentTask(args: {
  role: string;
  goal: string;
  conversationIds: string[];
  constraints: string[];   // e.g. "the lock rule changed on 2026-11-05: 3 tries, 15-min lock"
  priorFindings: Finding[]; // what other subagents already found, with sources
}): string {
  return [
    `You are the ${args.role} for ShopDesk's weekly investigation. You have no other context: everything you need is below.`,
    ``,
    `GOAL: ${args.goal}`,
    `CONVERSATIONS TO EXAMINE: ${args.conversationIds.join(", ")}`,
    ``,
    `KNOWN CONSTRAINTS (treat as true):`,
    ...args.constraints.map((c) => `- ${c}`),
    ``,
    `FINDINGS ALREADY MADE BY OTHER AGENTS (do not repeat them; say if you find evidence against one):`,
    args.priorFindings.length ? JSON.stringify(args.priorFindings) : "(none yet)",
    ``,
    `QUALITY CRITERIA: a finding counts only if it quotes evidence and names the conversation it came from.`,
    `If you are not sure, set certain=false rather than leaving it out.`,
    ``,
    `RETURN: a JSON array of findings: {claim, evidence, source: {conversationId, messageIndex, tool, at}, certain}.`,
  ].join("\n");
}
