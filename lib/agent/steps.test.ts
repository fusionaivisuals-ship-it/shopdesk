// D-51: a step label shows only whitelisted words, whatever extra a tool result carries.
import { describe, it, expect } from "vitest";
import { stepLabel } from "./steps";

const SECRETS = { email: "mei.lin@example.com", address: "12 Fake Lane", phone: "0900-000-000", detail: "email_mismatch", note: "internal" };
const leaks = (label: string) => Object.values(SECRETS).some((s) => label.includes(s));

describe("stepLabel", () => {
  it("verify success says only Verified", () => {
    const s = stepLabel("verify_customer", { ok: true, next_step: "x", recent_contact: "asked about returns", ...SECRETS });
    expect(s).toEqual({ tool: "verify_customer", label: "Verified", ok: true });
  });

  it("verify no-match and locked look the same (D-04)", () => {
    const noMatch = stepLabel("verify_customer", { ok: false, reason: "no_match", attempts_left: 2, next_step: "x", ...SECRETS });
    const locked = stepLabel("verify_customer", { ok: false, locked: true, unlock_in_minutes: 15, next_step: "x" });
    expect(noMatch).toEqual(locked);
    expect(noMatch.label).toBe("Couldn't confirm");
    expect(noMatch.label).not.toMatch(/\d/); // no attempts left, no minutes
  });

  it("one order shows number + status only", () => {
    const s = stepLabel("list_orders", { orders: [{ number: "GC-1043", status: "shipped", placed: "2026-11-01", ...SECRETS }] });
    expect(s.label).toBe("GC-1043 shipped");
    expect(leaks(s.label)).toBe(false);
  });

  it("an order field that isn't a plain word never reaches the label", () => {
    const s = stepLabel("list_orders", { orders: [{ number: "GC-1043", status: "shipped to 12 Fake Lane" }] });
    expect(s.label).toBe("1 order");
  });

  it("several orders show a count", () => {
    expect(stepLabel("list_orders", { orders: [{ number: "GC-1", status: "shipped" }, { number: "GC-2", status: "delivered" }] }).label).toBe("2 orders");
  });

  it("policy search shows title and version, not the snippet", () => {
    const s = stepLabel("search_policy", { found: true, results: [{ section: "shipping", title: "Shipping", version: 1, snippet: "We ship to Japan", url: "u" }] });
    expect(s.label).toBe("Shipping, v1");
  });

  it("policy gap is said plainly", () => {
    expect(stepLabel("search_policy", { found: false, next_step: "x" }).label).toBe("Not in our policies");
  });

  it("read_policy shows title and version, not the text", () => {
    const s = stepLabel("read_policy", { section: "returns", title: "Returns", version: 2, text: "Opened items ...", url: "u" });
    expect(s.label).toBe("Returns, v2");
  });

  it("reaction report never shows what the customer described", () => {
    const s = stepLabel("report_reaction", { ok: true, next_step: "x", what_happened: "rash on face" });
    expect(s.label).toBe("Passed to our team");
  });

  it("any tool error gives a fixed generic line", () => {
    const err = { isError: true, category: "transient", retryable: true, next_step: "db timeout at host xyz" };
    expect(stepLabel("list_orders", err)).toEqual({ tool: "list_orders", label: "Couldn't load orders", ok: false });
    expect(stepLabel("search_policy", err).label).toBe("Couldn't load policies");
  });

  it("unknown tool is Skipped", () => {
    expect(stepLabel("delete_everything", { ok: true }).label).toBe("Skipped");
  });
});
