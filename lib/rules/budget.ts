// Spend cap rules (D-12, D-44). Pure code: no database, no AI.

export const BUDGET = {
  dailyCents: 100,            // $1.00 per Taipei day (D-12)
  visitorMessagesPerDay: 20,  // per browser cookie (D-44 starting value)
  // Haiku prices in US cents per million tokens. SETTINGS, NOT VERIFIED from this session:
  // check Anthropic's pricing page and update. The console monthly limit is the backstop.
  inputCentsPerMTok: 100,     // $1.00 / MTok
  outputCentsPerMTok: 500,    // $5.00 / MTok
  // SECURITY.md G6-G8 (2026-11-18): limits a cookie can't dodge, and a cost ceiling per message.
  reserveCentsPerTurn: 10,    // charged BEFORE Claude runs, settled after: parallel requests can't overshoot the cap
  maxOutputTokens: 600,       // per model call
  customerMessagesPerConversation: 15, // then "start a new chat": history (= input cost) can't grow forever
};

// Per client IP (stored as a keyed hash). Clearing cookies doesn't reset these.
export const RATE = {
  chatPerMinute: 6,
  chatPerDay: 60,
  unlockPerHour: 10,
  handoffPerDay: 5,
};

export type RateRule = { limit: number; windowMs: number };
export const RATE_RULES = {
  chatMinute: { limit: RATE.chatPerMinute, windowMs: 60_000 },
  chatDay: { limit: RATE.chatPerDay, windowMs: 86_400_000 },
  unlockHour: { limit: RATE.unlockPerHour, windowMs: 3_600_000 },
  handoffDay: { limit: RATE.handoffPerDay, windowMs: 86_400_000 },
} satisfies Record<string, RateRule>;

// Fixed windows: every request in the same minute (or hour, day) shares one counter.
export function windowStart(now: number, windowMs: number): number {
  return now - (now % windowMs);
}

// count = this request's number in the window, already including itself.
export function overRate(count: number, rule: RateRule): boolean {
  return count > rule.limit;
}

export const SLOW_DOWN = "You're sending messages quickly. Please wait a minute and try again.";
export const CONVERSATION_FULL =
  "This chat has reached its length limit for the demo. Refresh the page to start a new one, or use the \"Talk to a person\" button.";

// Customer messages are the plain-text user messages (tool results are user messages too, but arrays).
export function conversationFull(history: { role: string; content: unknown }[]): boolean {
  const customer = history.filter((m) => m.role === "user" && typeof m.content === "string").length;
  return customer >= BUDGET.customerMessagesPerConversation;
}

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
// The reservation must still fit under the cap, so the last cents of the day can't be overspent.
export function checkBudget(spentTodayCents: number, visitorMessagesToday: number): BudgetCheck {
  if (spentTodayCents + BUDGET.reserveCentsPerTurn > BUDGET.dailyCents) return { ok: false, reason: "daily_cap", message: OVER_DAILY };
  if (visitorMessagesToday >= BUDGET.visitorMessagesPerDay) return { ok: false, reason: "visitor_limit", message: OVER_VISITOR };
  return { ok: true };
}
