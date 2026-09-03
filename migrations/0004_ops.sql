-- Threading + labels
ALTER TABLE messages ADD COLUMN rfc_message_id TEXT;
ALTER TABLE messages ADD COLUMN references_header TEXT;
ALTER TABLE messages ADD COLUMN thread_id TEXT;
ALTER TABLE messages ADD COLUMN label TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(user_id, thread_id, date_ms ASC);
CREATE INDEX IF NOT EXISTS idx_messages_rfc_id ON messages(user_id, rfc_message_id);

-- Filter extensions: forward, label, catch-all match
ALTER TABLE filters ADD COLUMN forward_to TEXT NOT NULL DEFAULT '';
ALTER TABLE filters ADD COLUMN label TEXT NOT NULL DEFAULT '';
ALTER TABLE filters ADD COLUMN is_catch_all INTEGER NOT NULL DEFAULT 0;

-- Domain catch-all → mailbox
ALTER TABLE domains ADD COLUMN catch_all_mailbox_id TEXT;

-- Alias + disposable addresses (route to an owned mailbox)
CREATE TABLE IF NOT EXISTS aliases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  address TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  disposable INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  UNIQUE (domain_id, local_part)
);

CREATE INDEX IF NOT EXISTS idx_aliases_user ON aliases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aliases_address ON aliases(address);

-- Developer webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT 'mail.received',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  last_triggered_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id, created_at DESC);

-- Multi-user scaffold (UI stubbed; invites stay deferred until shared inboxes ship)
CREATE TABLE IF NOT EXISTS workspace_invites (
  id TEXT PRIMARY KEY,
  invited_by TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'deferred',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mailbox_members (
  mailbox_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (mailbox_id, user_id),
  FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Browser notification preference
ALTER TABLE user_settings ADD COLUMN notify_browser INTEGER NOT NULL DEFAULT 0;
