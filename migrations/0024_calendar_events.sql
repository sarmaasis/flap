-- Native calendar events (Flap-hosted). CalDAV sync remains separate.
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL DEFAULT '',
  uid TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL,
  ends_at INTEGER NOT NULL,
  all_day INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_range
  ON calendar_events (user_id, starts_at, ends_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_user_uid
  ON calendar_events (user_id, uid);
