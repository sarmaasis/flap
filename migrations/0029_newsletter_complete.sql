-- End-to-end newsletters: sender identity, schedule, opt-in/unsub tokens, mailing address, delivery log.

ALTER TABLE newsletter_blasts ADD COLUMN mailbox_id TEXT NOT NULL DEFAULT '';
ALTER TABLE newsletter_blasts ADD COLUMN scheduled_at INTEGER;
ALTER TABLE newsletter_blasts ADD COLUMN from_name TEXT NOT NULL DEFAULT '';

ALTER TABLE newsletter_subscribers ADD COLUMN confirm_token TEXT NOT NULL DEFAULT '';
ALTER TABLE newsletter_subscribers ADD COLUMN unsub_token TEXT NOT NULL DEFAULT '';
ALTER TABLE newsletter_subscribers ADD COLUMN confirmed_at INTEGER;
ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribed_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_confirm
  ON newsletter_subscribers (confirm_token);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_unsub
  ON newsletter_subscribers (unsub_token);

CREATE TABLE IF NOT EXISTS newsletter_settings (
  user_id TEXT PRIMARY KEY,
  from_name TEXT NOT NULL DEFAULT '',
  physical_address TEXT NOT NULL DEFAULT '',
  mailbox_id TEXT NOT NULL DEFAULT '',
  public_slug TEXT NOT NULL DEFAULT '',
  double_opt_in INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_settings_slug
  ON newsletter_settings (public_slug);

CREATE TABLE IF NOT EXISTS newsletter_send_events (
  id TEXT PRIMARY KEY,
  blast_id TEXT NOT NULL,
  subscriber_id TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_send_events_blast
  ON newsletter_send_events (blast_id, created_at DESC);
