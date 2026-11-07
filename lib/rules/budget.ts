// Spend cap rules (D-12, D-44). Pure code: no database, no AI.

export const BUDGET = {
  dailyCents: 100,            // $1.00 per Taipei day (D-12)
  visitorMessagesPerDay: 20,  // per browser cookie (D-44 starting value)
  // Haiku prices in US cents per million tokens. SETTINGS, NOT VERIFIED from this session:
  // check Anthropic's pricing page and update. The console monthly limit is the backstop.
  inputCentsPerMTok: 100,     // $1.00 / MTok
  outputCentsPerMTok: 500,    // $5.00 / MTok
};

export type Usage = { input_tokens: number; output_tokens: number };

export function costCents(u: Usage): number {
  return (u.input_tokens * BUDGET.inputCentsPerMTok + u.output_tokens * BUDGET.outputCentsPerMTok) / 1_000_000;
}

// The Taipei calendar day for a timestamp (UTC+8, no daylight saving).
export function taipeiDay(now: number): string {
  return new Date(now + 8 * 60 * 60_000).toISOString().slice(0, 10);
}

export const OVER_DAILY =
  "The ShopDesk demo has reached today's usage limit. Please try again tomorrow, or use the \"Talk to a person\" button.";
export const OVER_VISITOR =
  "You've reached today's message limit for this demo. Please come back tomorrow, or use the \"Talk to a person\" button.";

export type BudgetCheck = { ok: true } | { ok: false; reason: "daily_cap" | "visitor_limit"; message: string };

// Checked BEFORE Claude is called. Total cap first: it protects everyone.
export function checkBudget(spentTodayCents: number, visitorMessagesToday: number): BudgetCheck {
  if (spentTodayCents >= BUDGET.dailyCents) return { ok: false, reason: "daily_cap", message: OVER_DAILY };
  if (visitorMessagesToday >= BUDGET.visitorMessagesPerDay) return { ok: false, reason: "visitor_limit", message: OVER_VISITOR };
  return { ok: true };
}
