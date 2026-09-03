ALTER TABLE messages ADD COLUMN cc_addr TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN bcc_addr TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN snooze_until INTEGER;
ALTER TABLE messages ADD COLUMN scheduled_at INTEGER;
ALTER TABLE messages ADD COLUMN snippet TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN in_reply_to TEXT;

ALTER TABLE mailboxes ADD COLUMN display_name TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_messages_starred ON messages(user_id, starred, date_ms DESC);
CREATE INDEX IF NOT EXISTS idx_messages_snooze ON messages(user_id, snooze_until);
CREATE INDEX IF NOT EXISTS idx_messages_scheduled ON messages(user_id, folder, scheduled_at);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  last_used_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS signatures (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  html_body TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signatures_user ON signatures(user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS filters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  match_from TEXT NOT NULL DEFAULT '',
  match_to TEXT NOT NULL DEFAULT '',
  match_subject TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_filters_user ON filters(user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS blocked_senders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (user_id, address)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  vacation_enabled INTEGER NOT NULL DEFAULT 0,
  vacation_body TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vacation_replies (
  user_id TEXT NOT NULL,
  address TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, address)
);
