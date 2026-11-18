// G5 Fail closed: in production the site refuses to chat unless every secret is set.
// Without the database, limits and the spend cap would reset on every server instance.
export const REQUIRED_IN_PRODUCTION = ["ANTHROPIC_API_KEY", "SHOPDESK_DATABASE_URL", "SHOPDESK_COOKIE_SECRET"] as const;

export function missingConfig(env: Record<string, string | undefined> = process.env): string[] {
  if (env.NODE_ENV !== "production") return [];
  return REQUIRED_IN_PRODUCTION.filter((k) => !env[k] || env[k]!.length < 8);
}

// Local preview only: a fixed dev secret. Production never uses it (missingConfig blocks first).
export function cookieSecret(env: Record<string, string | undefined> = process.env): string {
  return env.SHOPDESK_COOKIE_SECRET || "dev-only-not-a-secret";
}
