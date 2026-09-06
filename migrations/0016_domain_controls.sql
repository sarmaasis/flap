-- Domain park/reputation/retention + deliverability events + public health badges.

ALTER TABLE domains ADD COLUMN parked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domains ADD COLUMN park_mode TEXT NOT NULL DEFAULT ''; -- receive_only | paused | ''
ALTER TABLE domains ADD COLUMN reputation_mode TEXT NOT NULL DEFAULT 'shared'; -- shared | isolated
ALTER TABLE domains ADD COLUMN retention_days INTEGER; -- null = default
ALTER TABLE domains ADD COLUMN legal_hold INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS deliverability_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- bounce | complaint | reject | delivery
  count INTEGER NOT NULL DEFAULT 1,
  day TEXT NOT NULL, -- YYYY-MM-DD UTC
  meta_json TEXT NOT NULL DEFAULT '',
  UNIQUE (domain_id, kind, day)
);
CREATE INDEX IF NOT EXISTS idx_deliv_user ON deliverability_events (user_id, day);

CREATE TABLE IF NOT EXISTS domain_health_public (
  domain_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  show_badge INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);
