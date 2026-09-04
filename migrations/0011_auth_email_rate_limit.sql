-- Auth outbound email rate limits (magic-link + verification).
-- Counters are append-only; queries filter by created_at windows.
-- See worker/lib/auth-email-rate-limit.ts for exact limits.

CREATE TABLE IF NOT EXISTS auth_email_rate_log (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_email_rate_email
  ON auth_email_rate_log(kind, email_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_auth_email_rate_ip
  ON auth_email_rate_log(kind, ip_hash, created_at);
