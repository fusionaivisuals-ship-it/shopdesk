// D-53: the "Talk to a person" button makes at most ONE ticket per conversation.
// Reuses the lock Counter shape (failures = handoff timestamps) so no new table is needed.
import type { Counter } from "./lock";

export const HANDOFF_LIMIT = { perConversation: 1 };

export function canHandOff(c: Counter | null): boolean {
  return (c?.failures.length ?? 0) < HANDOFF_LIMIT.perConversation;
}

export function recordHandoff(c: Counter | null, now: number): Counter {
  return { failures: [...(c?.failures ?? []), now], resetAt: c?.resetAt ?? 0 };
}
