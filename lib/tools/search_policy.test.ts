// search_policy + read_policy tests (D-10, D-11, D-43, 5.6). Fictional data only, no Claude API calls.
import { describe, it, expect } from "vitest";
import { searchPolicy } from "./search_policy";
import { readPolicy } from "./read_policy";
import { memoryStore } from "./store";

const ctx = { conversationId: "conv_1", visitorId: "vis_1", now: Date.UTC(2026, 10, 8) };

describe("search_policy / read_policy", () => {
  it("'Do you ship to Japan?' finds the shipping section, with version and link", async () => {
    const r: any = await searchPolicy({ query: "Do you ship to Japan?" }, ctx, memoryStore());
    expect(r.found).toBe(true);
    expect(r.results[0]).toMatchObject({ section: "shipping", version: 1, url: "/policies/shipping#v1" });
  });

  it("different words, same section: 'can you send it abroad' -> shipping", async () => {
    const r: any = await searchPolicy({ query: "can you send it abroad" }, ctx, memoryStore());
    expect(r.results[0].section).toBe("shipping");
  });

  it("returns: only the CURRENT version (v2, 30 days) is ever returned; v1 (14 days) never", async () => {
    const r: any = await searchPolicy({ query: "return opened product" }, ctx, memoryStore());
    expect(r.results[0]).toMatchObject({ section: "returns", version: 2 });
    const full: any = await readPolicy({ section: "returns" }, ctx, memoryStore());
    expect(full.text).toContain("30 days");
    expect(full.text).not.toContain("14 days");
    expect(full.url).toBe("/policies/returns#v2");
  });

  it("not covered -> found:false + honest next step, and logged as a policy gap (D-11 trial count)", async () => {
    const store = memoryStore();
    const r: any = await searchPolicy({ query: "do you have a loyalty points programme" }, ctx, store);
    expect(r).toMatchObject({ found: false });
    expect(r.next_step).toContain("Talk to a person");
    expect(store.logs).toContainEqual(expect.objectContaining({ event: "policy_gap" }));
  });

  it("database down -> transient error, NOT 'not covered' (D-43)", async () => {
    const store = memoryStore({ down: true });
    const r: any = await searchPolicy({ query: "ship to Japan" }, ctx, store);
    expect(r).toMatchObject({ isError: true, category: "transient", retryable: true });
    expect(r).not.toHaveProperty("found");
    expect(store.logs).not.toContainEqual(expect.objectContaining({ event: "policy_gap" })); // outage is not a policy gap
  });

  it("read_policy with an unknown id -> validation error pointing to search_policy", async () => {
    const r: any = await readPolicy({ section: "loyalty" }, ctx, memoryStore());
    expect(r).toMatchObject({ isError: true, category: "validation" });
    expect(r.next_step).toContain("search_policy");
  });
});
