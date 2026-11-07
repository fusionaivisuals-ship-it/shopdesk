// The fixed shell around every customer message (D-36). Code, in this order, every time:
//   1. budget check (D-44)  2. load conversation  3. Claude's loop (adaptive)  4. save  5. spend + log
// Nothing in this file is decided by the model.
import type { Store } from "../tools/store";
import { runTurn, type Claude, type Message } from "./loop";
import type { Step } from "./steps";
import { checkBudget, costCents, taipeiDay } from "../rules/budget";

export const SYSTEM_PROMPT = `You are the support assistant for Glow & Co, a skincare shop. You help with Glow & Co orders and policies only (D-13).
Use the tools to look things up; never answer policy or order questions from general knowledge.
If something isn't covered, say so honestly and point to the "Talk to a person" button, which is always on screen (D-09).
Be brief and friendly. Never give medical advice.`;

export type MessageResult = {
  reply: string;
  status: "answered" | "over_daily_cap" | "over_visitor_limit";
};

export async function handleMessage(args: {
  claude: Claude;
  store: Store;
  conversationId: string;
  visitorId: string;
  text: string;
  now: number;
  onStep?: (step: Step) => void | Promise<void>; // D-50
}): Promise<MessageResult> {
  const { store, conversationId, visitorId, now } = args;
  const day = taipeiDay(now);

  // 1. Budget, BEFORE any model call: if over, Claude is never called and nothing is spent.
  const budget = checkBudget(await store.getSpent(day), await store.getVisitorMessages(visitorId, day));
  if (!budget.ok) {
    await store.log({ event: "budget_block", reason: budget.reason, visitorId, day });
    return { reply: budget.message, status: budget.reason === "daily_cap" ? "over_daily_cap" : "over_visitor_limit" };
  }
  await store.addVisitorMessage(visitorId, day);

  // 2. Load the conversation from the database (not from the model's memory).
  const history = (await store.loadMessages(conversationId)) as Message[];
  const userMsg: Message = { role: "user", content: args.text };

  // 3. The adaptive part: Claude's loop with the tools (D-37).
  const turn = await runTurn({
    claude: args.claude,
    system: SYSTEM_PROMPT,
    history: [...history, userMsg],
    ctx: { conversationId, visitorId, now },
    store,
    onStep: args.onStep,
  });

  // 4. Save everything new this turn (user message, tool calls, tool results, reply).
  await store.appendMessages(conversationId, history.length, turn.messages.slice(history.length));

  // 5. Spend + log.
  const cents = costCents(turn.usage);
  await store.addSpent(day, cents);
  await store.log({ event: "turn", conversationId, rounds: turn.rounds, endedBy: turn.endedBy, cents, usage: turn.usage });

  return { reply: turn.reply, status: "answered" };
}
