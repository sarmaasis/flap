-- Newsletter audience store (MVP). Blasts with status 'queued' are processed by cron.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', -- active | pending | unsubscribed
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, email),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_user
  ON newsletter_subscribers (user_id, status, created_at DESC);
