-- SECURITY.md G6: per-IP rate limits. Additive only (new table, nothing dropped or changed).
CREATE TABLE IF NOT EXISTS rate_hits (
  key          text        NOT NULL,  -- e.g. "chatMinute:<keyed hash of IP>" (never the raw IP)
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL,
  PRIMARY KEY (key, window_start)
);
-- Old windows are useless after a day; a cleanup can delete rows older than 2 days.
CREATE INDEX IF NOT EXISTS rate_hits_window ON rate_hits (window_start);
