// D-56: the agent and the eval are kept apart, and this test fails the build if they touch.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CASES } from "../evals/cases";

const walk = (d: string): string[] =>
  existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : [];
const code = (f: string) => /\.(ts|tsx|mjs|js)$/.test(f);
const AGENT_SIDE = [...walk("lib"), ...walk("app"), ...walk("mcp"), ...walk("scripts"), "middleware.ts", "next.config.mjs"].filter(code);
const imports = (f: string) => [...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

describe("agent <-> eval separation (D-56)", () => {
  it("no agent, site, MCP or script file imports anything from evals/", () => {
    const bad = AGENT_SIDE.filter((f) => imports(f).some((p) => p.includes("evals")));
    expect(bad).toEqual([]);
  });

  it("inside evals/, only target.ts may import agent code", () => {
    const bad = walk("evals").filter(code).filter((f) => !f.endsWith("target.ts"))
      .filter((f) => imports(f).some((p) => p.startsWith("..")));
    expect(bad).toEqual([]);
  });

  it("the agent's prompt and tool descriptions don't contain eval questions (no teaching to the test)", () => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9@\- ]+/g, " ").replace(/\s+/g, " ").trim();
    const agentText = norm(AGENT_SIDE.map((f) => readFileSync(f, "utf8")).join(" "));
    const overlaps: string[] = [];
    for (const c of CASES) for (const t of c.turns) {
      const w = norm(t).split(" ");
      for (let i = 0; i + 6 <= w.length; i++) {
        const run = w.slice(i, i + 6).join(" ");
        if (agentText.includes(run)) { overlaps.push(`${c.id}: "${run}"`); break; }
      }
    }
    expect(overlaps).toEqual([]);
  });
});
