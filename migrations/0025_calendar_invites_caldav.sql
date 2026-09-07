-- Calendar invitations + CalDAV sync support
ALTER TABLE calendar_events ADD COLUMN organizer_email TEXT NOT NULL DEFAULT '';
ALTER TABLE calendar_events ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0;
ALTER TABLE calendar_events ADD COLUMN etag TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS calendar_attendees (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'REQ-PARTICIPANT',
  partstat TEXT NOT NULL DEFAULT 'NEEDS-ACTION',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_attendees_event_email
  ON calendar_attendees (event_id, email);

CREATE INDEX IF NOT EXISTS idx_calendar_attendees_event
  ON calendar_attendees (event_id);

CREATE TABLE IF NOT EXISTS calendar_sync (
  user_id TEXT PRIMARY KEY,
  sync_token TEXT NOT NULL,
  ctag TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_app_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'CalDAV',
  token_prefix TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_calendar_app_tokens_user
  ON calendar_app_tokens (user_id);
