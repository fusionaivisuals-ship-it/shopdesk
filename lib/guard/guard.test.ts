// Web gates (SECURITY.md G1-G5). $0, no network.
import { describe, it, expect } from "vitest";
import { checkOrigin, readJson, cleanText, clientIp, MAX_BODY_BYTES, MAX_CHARS } from "./request";
import { sign, unsign } from "./signed";
import { missingConfig } from "./config";
import { ipKey, overLimit } from "./limit";
import { memoryStore } from "../tools/store";
import { RATE } from "../rules/budget";

const req = (h: Record<string, string>, body = "") => new Request("https://shop.test/api/chat", { method: "POST", headers: h, body });

describe("G1 same-origin", () => {
  it("accepts our own page", () => expect(checkOrigin(req({ origin: "https://shop.test", host: "shop.test" }))).toBeNull());
  it("refuses another site", () => expect(checkOrigin(req({ origin: "https://evil.test", host: "shop.test" }))?.status).toBe(403));
  it("refuses a request with no Origin", () => expect(checkOrigin(req({ host: "shop.test" }))?.status).toBe(403));
  it("refuses a look-alike host", () => expect(checkOrigin(req({ origin: "https://shop.test.evil.test", host: "shop.test" }))?.status).toBe(403));
});

describe("G2 body", () => {
  it("refuses non-JSON (cross-site forms can't post JSON)", async () => {
    const r = await readJson(req({ "content-type": "text/plain" }, '{"text":"hi"}'));
    expect(r.ok).toBe(false);
  });
  it("refuses an oversized body before parsing", async () => {
    const r = await readJson(req({ "content-type": "application/json" }, JSON.stringify({ text: "x".repeat(MAX_BODY_BYTES) })));
    expect(r.ok === false && r.rejection.status).toBe(413);
  });
  it("parses a normal message", async () => {
    const r = await readJson(req({ "content-type": "application/json" }, '{"text":"hi"}'));
    expect(r.ok && r.body.text).toBe("hi");
  });
});

describe("G3 text", () => {
  it("removes hidden control and direction characters, keeps newlines", () => expect(cleanText("hi\u0000‮ there\nok")).toBe("hi there\nok"));
  it("refuses empty, non-string and over-long", () => {
    expect(cleanText("   ")).toBeNull();
    expect(cleanText({ role: "system" })).toBeNull();
    expect(cleanText("x".repeat(MAX_CHARS + 1))).toBeNull();
  });
});

describe("G4 signed cookies", () => {
  it("round-trips our own value", async () => expect(await unsign(await sign("abc", "s1-secret"), "s1-secret")).toBe("abc"));
  it("rejects an edited value", async () => {
    const v = await sign("abc", "s1-secret");
    expect(await unsign("abd" + v.slice(3), "s1-secret")).toBeNull();
  });
  it("rejects an unsigned or foreign-signed value", async () => {
    expect(await unsign("abc", "s1-secret")).toBeNull();
    expect(await unsign(await sign("abc", "other"), "s1-secret")).toBeNull();
  });
});

describe("G5 fail closed", () => {
  it("production with a missing secret is not configured", () => {
    expect(missingConfig({ NODE_ENV: "production", ANTHROPIC_API_KEY: "sk-xxxxxxxx", SHOPDESK_DATABASE_URL: "postgres://x/y" })).toEqual(["SHOPDESK_COOKIE_SECRET"]);
  });
  it("local preview needs nothing", () => expect(missingConfig({ NODE_ENV: "development" })).toEqual([]));
});

describe("G6 per-IP limits", () => {
  it("uses the first x-forwarded-for address", () => expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4"));
  it("stores a keyed hash, never the IP", async () => {
    const k = await ipKey("1.2.3.4", "s1-secret");
    expect(k).not.toContain("1.2.3.4");
    expect(k).toBe(await ipKey("1.2.3.4", "s1-secret"));
    expect(k).not.toBe(await ipKey("1.2.3.5", "s1-secret"));
  });
  it("the 7th message in a minute is refused even with fresh cookies; another IP is fine", async () => {
    const store = memoryStore();
    const now = 1_000_000;
    const results = [];
    for (let i = 0; i < RATE.chatPerMinute + 1; i++) results.push(await overLimit(store, ["chatMinute"], "ipA", now));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.at(-1)).toBe(true);
    expect(await overLimit(store, ["chatMinute"], "ipB", now)).toBe(false);
    expect(await overLimit(store, ["chatMinute"], "ipA", now + 60_000)).toBe(false); // next minute
  });
});
