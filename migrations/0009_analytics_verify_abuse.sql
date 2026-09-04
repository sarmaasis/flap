-- Growth brief close-out: first-party analytics, email verify tokens, payment identity for referral abuse

-- ─── analytics_events ───────────────────────────────────────────────────────
-- Privacy-light first-party funnel store. No third-party SDK.
-- Schema:
--   id           TEXT PK
--   event        TEXT   event name (landing_view, signup_completed, …)
--   user_id      TEXT   nullable; set when session known or server-emitted
--   session_id   TEXT   optional client-generated anonymous session key
--   props_json   TEXT   small JSON object (strings/numbers/bools only; no PII dumps)
--   path         TEXT   optional page path
--   created_at   INTEGER unix ms
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  props_json TEXT NOT NULL DEFAULT '{}',
  path TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event ON analytics_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id, created_at DESC);

-- ─── email verification ─────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN email_verify_token TEXT;
ALTER TABLE users ADD COLUMN email_verify_sent_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users(email_verify_token);

-- ─── billing / referral abuse fingerprints ──────────────────────────────────
-- Dodo subscription webhooks expose customer_id, not card fingerprints.
-- We store dodo_customer_id (+ optional payment_method_id if present) and block
-- referral rewards when referrer and referee share the same payment identity.
ALTER TABLE users ADD COLUMN dodo_customer_id TEXT;
ALTER TABLE users ADD COLUMN payment_fingerprint TEXT;

CREATE INDEX IF NOT EXISTS idx_users_dodo_customer ON users(dodo_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_payment_fp ON users(payment_fingerprint);

-- Audit why a referral was blocked (status can be 'blocked')
ALTER TABLE referrals ADD COLUMN block_reason TEXT;
