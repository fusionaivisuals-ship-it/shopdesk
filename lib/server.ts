// Server-side wiring for the website (D-49): one store per server process, the Claude client,
// and the signed cookies. Business rules stay in lib/rules (CLAUDE.md); web gates in lib/guard.
import { randomUUID } from "node:crypto";
import { memoryStore, neonStore, type Store } from "./tools/store";
import { anthropicClaude } from "./agent/claude";
import type { Claude } from "./agent/loop";
import { sign, unsign } from "./guard/signed";
import { cookieSecret, missingConfig } from "./guard/config";

const url = process.env.SHOPDESK_DATABASE_URL;
// Real database when set (D-33). The in-memory store is for local preview only: in production
// missingConfig() refuses to run without the database (G5), so limits can't silently reset.
export const store: Store = url ? neonStore(url) : memoryStore();

export function claudeClient(): Claude | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? anthropicClaude(key, process.env.SHOPDESK_MODEL || undefined) : null;
}

export function notConfigured(): Response | null {
  const missing = missingConfig();
  // Names of missing settings go to the server log only, never to the visitor.
  if (missing.length) {
    console.error("shopdesk: missing config", missing);
    return Response.json({ error: "Chat is not available right now." }, { status: 503 });
  }
  return null;
}

// Visitor = browser cookie (D-22 Q6), kept a year. Conversation = ends with the browser session.
// G4: both are SIGNED by the server and httpOnly. A visitor can't read them from page scripts,
// can't invent one, and can't pick someone else's conversation to land in a verified chat.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export async function ids(cookieHeader: string | null) {
  const secret = cookieSecret();
  const valid = async (name: string) => {
    const v = await unsign(readCookie(cookieHeader, name), secret);
    return v && UUID.test(v) ? v : null;
  };
  const visitorId = (await valid("sd_vid")) ?? randomUUID();
  const conversationId = (await valid("sd_cid")) ?? randomUUID();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const setCookies = [
    `sd_vid=${await sign(visitorId, secret)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure}`,
    `sd_cid=${await sign(conversationId, secret)}; Path=/; HttpOnly; SameSite=Strict${secure}`,
  ];
  return { visitorId, conversationId, setCookies };
}
