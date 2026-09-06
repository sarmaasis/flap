-- Disposable addresses, Slack/Discord notify channels, push + digests.

CREATE TABLE IF NOT EXISTS disposable_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (domain_id, local_part)
);
CREATE INDEX IF NOT EXISTS idx_disposable_user ON disposable_addresses (user_id);

CREATE TABLE IF NOT EXISTS notify_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- slack | discord
  webhook_url TEXT NOT NULL,
  domain_id TEXT,
  mailbox_id TEXT,
  muted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notify_user ON notify_channels (user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_digests (
  user_id TEXT NOT NULL PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  weekday INTEGER NOT NULL DEFAULT 1,
  last_sent_at INTEGER
);
