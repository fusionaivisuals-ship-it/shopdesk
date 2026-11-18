import { describe, it, expect } from "vitest";
import { allowed, passFor } from "./access";

const S = "test-secret-123";
describe("private test gate (D-52, G4)", async () => {
  const pass = await passFor("glow-7", S);
  it("no code set -> public", async () => expect(await allowed(undefined, undefined, "/", S)).toBe(true));
  it("code set, no cookie -> blocked", async () => expect(await allowed("glow-7", undefined, "/api/chat", S)).toBe(false));
  it("the raw code as a cookie is NOT a pass", async () => expect(await allowed("glow-7", "glow-7", "/", S)).toBe(false));
  it("the signed pass -> allowed", async () => expect(await allowed("glow-7", pass, "/api/chat", S)).toBe(true));
  it("changing the code invalidates old passes", async () => expect(await allowed("glow-8", pass, "/", S)).toBe(false));
  it("a pass made with another secret is rejected", async () => expect(await allowed("glow-7", await passFor("glow-7", "other"), "/", S)).toBe(false));
  it("unlock page is always reachable", async () => expect(await allowed("glow-7", undefined, "/unlock", S)).toBe(true));
});
