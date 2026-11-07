import { describe, it, expect } from "vitest";
import { allowed } from "./access";

describe("private test gate (D-52)", () => {
  it("no code set -> public", () => expect(allowed(undefined, undefined, "/")).toBe(true));
  it("code set, no cookie -> blocked", () => expect(allowed("glow-7", undefined, "/api/chat")).toBe(false));
  it("wrong cookie -> blocked", () => expect(allowed("glow-7", "glow-8", "/")).toBe(false));
  it("right cookie -> allowed", () => expect(allowed("glow-7", "glow-7", "/api/chat")).toBe(true));
  it("unlock page is always reachable", () => expect(allowed("glow-7", undefined, "/unlock")).toBe(true));
});
