-- Collaboration workflow states + per-recipient delivery event log.

ALTER TABLE messages ADD COLUMN workflow_status TEXT NOT NULL DEFAULT ''; -- '' | done | follow_up

CREATE TABLE IF NOT EXISTS delivery_event_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  domain_id TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  kind TEXT NOT NULL, -- bounce | soft_bounce | complaint | delivery
  provider TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_delivery_event_log_created ON delivery_event_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_event_log_kind ON delivery_event_log (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_event_log_user ON delivery_event_log (user_id, created_at DESC);
