// Lock rule tests: cases 1-15 approved 2026-11-04 (D-03, D-03b, D-21)
import { describe, it, expect } from "vitest";
import { emptyCounter, gate, recordFailure, recordSuccess, unlockBySupport } from "./lock";

const MIN = 60_000, DAY = 24 * 60 * MIN;
const T0 = Date.UTC(2026, 10, 4, 9, 0);

// helper: n wrong attempts, one minute apart, starting at t
function fail(n: number, order: any, visitor: any, t: number) {
  let last: any;
  for (let i = 0; i < n; i++) {
    last = recordFailure(order, visitor, t + i * MIN);
    order = last.order; visitor = last.visitor;
  }
  return last;
}

describe("lock rule", () => {
  it("1. 1st wrong attempt -> 2 tries left", () => {
    const r = fail(1, emptyCounter(), emptyCounter(), T0);
    expect(r.status).toEqual({ kind: "open", attemptsLeft: 2 });
  });

  it("2. 2nd wrong attempt -> 1 try left", () => {
    const r = fail(2, emptyCounter(), emptyCounter(), T0);
    expect(r.status).toEqual({ kind: "open", attemptsLeft: 1 });
  });

  it("3. 3rd wrong attempt -> locked for 15 min", () => {
    const r = fail(3, emptyCounter(), emptyCounter(), T0);
    expect(r.status).toEqual({ kind: "locked", unlockAt: T0 + 2 * MIN + 15 * MIN });
  });

  it("4. during the lock, even correct details are not checked", () => {
    const r = fail(3, emptyCounter(), emptyCounter(), T0);
    expect(gate(r.order, r.visitor, T0 + 5 * MIN).kind).toBe("locked");
  });

  it("5. after 15 min, 4th wrong attempt -> 2 tries left (second round)", () => {
    const r1 = fail(3, emptyCounter(), emptyCounter(), T0);
    const r2 = recordFailure(r1.order, r1.visitor, T0 + 20 * MIN);
    expect(r2.status).toEqual({ kind: "open", attemptsLeft: 2 });
  });

  it("6. 6th wrong attempt -> person only + exactly one ticket", () => {
    const r1 = fail(3, emptyCounter(), emptyCounter(), T0);
    const r2 = fail(3, r1.order, r1.visitor, T0 + 20 * MIN);
    expect(r2.status.kind).toBe("person_only");
    expect(r2.events).toEqual(["create_ticket"]);
  });

  it("7. while person only: blocked, no new attempt or ticket can be recorded", () => {
    const r1 = fail(3, emptyCounter(), emptyCounter(), T0);
    const r2 = fail(3, r1.order, r1.visitor, T0 + 20 * MIN);
    expect(gate(r2.order, r2.visitor, T0 + DAY).kind).toBe("person_only");
    expect(() => recordFailure(r2.order, r2.visitor, T0 + DAY)).toThrow();
  });

  it("8. support person unlocks -> order counter back to 0", () => {
    const r1 = fail(3, emptyCounter(), emptyCounter(), T0);
    const r2 = fail(3, r1.order, r1.visitor, T0 + 20 * MIN);
    const order = unlockBySupport(r2.order, T0 + DAY);
    expect(gate(order, emptyCounter(), T0 + DAY)).toEqual({ kind: "open", attemptsLeft: 3 });
  });

  it("9. nobody unlocks -> auto-unlocks after 7 days", () => {
    const r1 = fail(3, emptyCounter(), emptyCounter(), T0);
    const r2 = fail(3, r1.order, r1.visitor, T0 + 20 * MIN);
    const sixth = T0 + 22 * MIN;
    expect(gate(r2.order, emptyCounter(), sixth + 7 * DAY - MIN).kind).toBe("person_only");
    expect(gate(r2.order, emptyCounter(), sixth + 7 * DAY)).toEqual({ kind: "open", attemptsLeft: 3 });
  });

  it("10. 2 wrong then correct -> order reset, visitor still at 2", () => {
    const r = fail(2, emptyCounter(), emptyCounter(), T0);
    const s = recordSuccess(r.order, r.visitor, T0 + 3 * MIN);
    expect(gate(s.order, emptyCounter(), T0 + 4 * MIN)).toEqual({ kind: "open", attemptsLeft: 3 });
    expect(gate(null, s.visitor, T0 + 4 * MIN)).toEqual({ kind: "open", attemptsLeft: 1 });
  });

  it("11. order locked, new browser with correct details -> blocked", () => {
    const r = fail(3, emptyCounter(), emptyCounter(), T0);
    expect(gate(r.order, emptyCounter(), T0 + 5 * MIN).kind).toBe("locked");
  });

  it("12. visitor locked, tries a different order -> blocked", () => {
    const r = fail(3, emptyCounter(), emptyCounter(), T0);
    expect(gate(emptyCounter(), r.visitor, T0 + 5 * MIN).kind).toBe("locked");
  });

  it("13. a failure older than one month no longer counts", () => {
    const r = fail(2, emptyCounter(), emptyCounter(), T0);
    expect(gate(r.order, r.visitor, T0 + 31 * DAY)).toEqual({ kind: "open", attemptsLeft: 3 });
  });

  it("14. non-existent order -> counts against visitor only, no order lock", () => {
    const r = recordFailure(null, emptyCounter(), T0);
    expect(r.order).toBeNull();
    expect(gate(null, r.visitor, T0 + MIN)).toEqual({ kind: "open", attemptsLeft: 2 });
  });

  it("15. repeated fail-fail-success is stopped by the visitor lock (D-22)", () => {
    const r1 = fail(2, emptyCounter(), emptyCounter(), T0);
    const s1 = recordSuccess(r1.order, r1.visitor, T0 + 3 * MIN);
    const r2 = recordFailure(emptyCounter(), s1.visitor, T0 + DAY); // visitor's 3rd failure, another order
    expect(r2.status.kind).toBe("locked");
  });
});
