// G14: Claude's tool input is checked against the tool's own schema BEFORE the tool runs.
// A prompt-injected call with odd types, extra fields or a huge string gets a validation error
// back (Claude can correct itself); it never reaches the database code.
export const MAX_FIELD_CHARS = 300;

type Schema = { properties?: Record<string, { type?: string }>; required?: readonly string[] };

export function checkInput(schema: Schema, input: unknown): { ok: true; input: Record<string, string> } | { ok: false; problem: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, problem: "input must be an object" };
  const props = schema.properties ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!(k in props)) return { ok: false, problem: `unknown field ${k.slice(0, 40)}` };
    if (typeof v !== "string") return { ok: false, problem: `${k} must be text` };
    if (v.length > MAX_FIELD_CHARS) return { ok: false, problem: `${k} is too long` };
    out[k] = v;
  }
  for (const r of schema.required ?? []) if (!(r in out)) return { ok: false, problem: `${r} is required` };
  return { ok: true, input: out };
}
