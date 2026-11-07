import { describe, it, expect } from "vitest";
import { canHandOff, recordHandoff } from "./handoff";

describe("handoff limit (D-53)", () => {
  it("first click in a conversation makes a ticket", () => {
    expect(canHandOff(null)).toBe(true);
    expect(canHandOff({ failures: [], resetAt: 0 })).toBe(true);
  });
  it("second click in the same conversation does not", () => {
    const c = recordHandoff(null, 1000);
    expect(c.failures).toEqual([1000]);
    expect(canHandOff(c)).toBe(false);
  });
});
