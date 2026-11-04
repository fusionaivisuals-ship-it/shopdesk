// Attempt lock for customer verification. Implements D-03, D-03b, D-21.
// Pure functions: no database, no AI. Storage is added in Domain 2.
// The same rule applies to an ORDER counter and a VISITOR (browser cookie) counter.

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export const LIMITS = {
  firstRound: 3,          // wrong tries before the first lock
  total: 6,               // wrong tries before "person only"
  lockMinutes: 15,
  autoUnlockDays: 7,      // "person only" lifts by itself after this (Q4)
  failureExpiryDays: 30   // failures older than this don't count (Q3)
};

export type Counter = {
  failures: number[];   // timestamps of wrong attempts since the last reset
  resetAt: number;      // failures before this time are ignored
};

export type Status =
  | { kind: "open"; attemptsLeft: number }
  | { kind: "locked"; unlockAt: number }
  | { kind: "person_only"; autoUnlockAt: number };

export type Event = "create_ticket";

export function emptyCounter(): Counter {
  return { failures: [], resetAt: 0 };
}

// Failures that still count at time `now`.
function active(c: Counter, now: number): number[] {
  return c.failures.filter(
    (t) => t >= c.resetAt && now - t < LIMITS.failureExpiryDays * DAY
  );
}

// Clear a "person only" counter whose 7 days have passed.
function normalise(c: Counter, now: number): Counter {
  const f = active(c, now);
  if (f.length >= LIMITS.total && now >= f[LIMITS.total - 1] + LIMITS.autoUnlockDays * DAY) {
    return { ...c, failures: [], resetAt: now };
  }
  return c;
}

export function statusOf(c: Counter, now: number): Status {
  const f = active(normalise(c, now), now);
  if (f.length >= LIMITS.total) {
    return { kind: "person_only", autoUnlockAt: f[LIMITS.total - 1] + LIMITS.autoUnlockDays * DAY };
  }
  if (f.length >= LIMITS.firstRound) {
    const unlockAt = f[LIMITS.firstRound - 1] + LIMITS.lockMinutes * MIN;
    if (now < unlockAt) return { kind: "locked", unlockAt };
    return { kind: "open", attemptsLeft: LIMITS.total - f.length };
  }
  return { kind: "open", attemptsLeft: LIMITS.firstRound - f.length };
}

const severity = { open: 0, locked: 1, person_only: 2 } as const;

// Either lock blocks (Q2): return the most restrictive status of order and visitor.
// order is null when the order number doesn't exist (Q5).
export function gate(order: Counter | null, visitor: Counter, now: number): Status {
  const v = statusOf(visitor, now);
  if (!order) return v;
  const o = statusOf(order, now);
  if (severity[o.kind] !== severity[v.kind]) return severity[o.kind] > severity[v.kind] ? o : v;
  if (o.kind === "open" && v.kind === "open") {
    return { kind: "open", attemptsLeft: Math.min(o.attemptsLeft, v.attemptsLeft) };
  }
  return o;
}

export function recordFailure(order: Counter | null, visitor: Counter, now: number) {
  if (gate(order, visitor, now).kind !== "open") {
    throw new Error("recordFailure called while blocked: check gate() first");
  }
  const v = normalise(visitor, now);
  const newVisitor = { ...v, failures: [...v.failures, now] };
  let newOrder: Counter | null = null;
  const events: Event[] = [];
  if (order) {
    const o = normalise(order, now);
    newOrder = { ...o, failures: [...o.failures, now] };
    // One ticket per locked order, created only on the transition to "person only".
    if (active(newOrder, now).length === LIMITS.total) events.push("create_ticket");
  }
  return { order: newOrder, visitor: newVisitor, status: gate(newOrder, newVisitor, now), events };
}

// Success resets that ORDER only; the visitor keeps counting (Q1).
// No "suspicious pattern" note: repeated fail-fail-success is stopped by the visitor lock (D-22).
export function recordSuccess(order: Counter, visitor: Counter, now: number) {
  return { order: { ...order, failures: [], resetAt: now }, visitor };
}

// Support person unlocks early from the tickets page (Q4).
export function unlockBySupport(c: Counter, now: number): Counter {
  return { ...c, failures: [], resetAt: now };
}
