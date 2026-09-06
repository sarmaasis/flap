-- Booking pages + requests (CalDAV Partial). Newsletter table may already exist from 0021.
CREATE TABLE IF NOT EXISTS booking_pages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  mailbox_id TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_requests (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_blasts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  recipient_tag TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  capped_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
