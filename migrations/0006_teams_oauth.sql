-- Real multi-seat workspaces + OAuth accounts

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Every existing account owns their workspace
INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at)
SELECT id, id, 'owner', created_at FROM users;

-- Functional invites (token + expiry + mailbox grants)
ALTER TABLE workspace_invites ADD COLUMN token TEXT;
ALTER TABLE workspace_invites ADD COLUMN workspace_id TEXT;
ALTER TABLE workspace_invites ADD COLUMN expires_at INTEGER;
ALTER TABLE workspace_invites ADD COLUMN mailbox_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE workspace_invites ADD COLUMN accepted_by TEXT;
ALTER TABLE workspace_invites ADD COLUMN accepted_at INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);

-- Shared mailbox flag (support@ / hello@ team inboxes)
ALTER TABLE mailboxes ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mailbox_members_user ON mailbox_members(user_id);

-- OAuth (Google primary; GitHub optional)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  redirect_to TEXT NOT NULL DEFAULT '/app',
  invite_token TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
