// Server-side wiring for the website (D-49): one store per server process, the Claude client,
// and the two cookies. Nothing here is a business rule; those stay in lib/rules (CLAUDE.md).
import { randomUUID } from "node:crypto";
import { memoryStore, neonStore, type Store } from "./tools/store";
import { anthropicClaude } from "./agent/claude";
import type { Claude } from "./agent/loop";

const url = process.env.SHOPDESK_DATABASE_URL;
// Real database when set (D-33); otherwise in-memory test data (local preview only, lost on restart).
export const store: Store = url ? neonStore(url) : memoryStore();

export function claudeClient(): Claude | null {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? anthropicClaude(key, process.env.SHOPDESK_MODEL || undefined) : null;
}

// Visitor = browser cookie (D-22 Q6), kept a year. Conversation = server-issued, ends with the browser
// session. Both httpOnly: page scripts can't read them, and a visitor can't pick someone else's
// conversation id, so they can't land in a conversation another person verified.
const ID = /^[0-9a-f-]{36}$/;
export function ids(cookieHeader: string | null) {
  const jar = Object.fromEntries((cookieHeader ?? "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2));
  const visitorId = ID.test(jar.sd_vid ?? "") ? jar.sd_vid : randomUUID();
  const conversationId = ID.test(jar.sd_cid ?? "") ? jar.sd_cid : randomUUID();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const setCookies = [
    `sd_vid=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`,
    `sd_cid=${conversationId}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  ];
  return { visitorId, conversationId, setCookies };
}
