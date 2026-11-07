// Integration test: runs ONLY when SHOPDESK_DATABASE_URL is set; skipped otherwise ($0, no network).
// Exists because the in-memory tests could not catch a real-database bug (dates shifted one day, 2026-11-07).
import { describe, it, expect } from "vitest";
import { neonStore } from "./store";

const url = process.env.SHOPDESK_DATABASE_URL;
describe.skipIf(!url)("neonStore against the real database", () => {
  it("returns order dates exactly as stored (no timezone shift)", async () => {
    const orders = await neonStore(url!).listOrdersFor("cus_1");
    expect(orders.map((o) => [o.number, o.placedAt])).toEqual([
      ["GC-1042", "2026-10-20"],
      ["GC-1043", "2026-11-01"],
    ]);
  });
});
