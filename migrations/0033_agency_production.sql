-- Agency / studio production: additive grants, clients, invite hashes, scheduled actor.

CREATE TABLE IF NOT EXISTS workspace_member_domains (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  permission_level TEXT NOT NULL DEFAULT 'send',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id, domain_id)
);
CREATE INDEX IF NOT EXISTS idx_wmd_user ON workspace_member_domains (user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_wmd_domain ON workspace_member_domains (domain_id);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients (workspace_id, created_at DESC);

ALTER TABLE domains ADD COLUMN client_id TEXT;

ALTER TABLE workspace_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE workspace_members ADD COLUMN invited_by TEXT;
ALTER TABLE workspace_members ADD COLUMN accepted_at INTEGER;
ALTER TABLE workspace_members ADD COLUMN removed_at INTEGER;

ALTER TABLE workspace_invites ADD COLUMN token_hash TEXT;
ALTER TABLE workspace_invites ADD COLUMN domain_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE workspace_invites ADD COLUMN revoked_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token_hash ON workspace_invites (token_hash);

ALTER TABLE api_keys ADD COLUMN created_by_user_id TEXT;
ALTER TABLE webhooks ADD COLUMN created_by_user_id TEXT;

ALTER TABLE messages ADD COLUMN scheduled_by_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_scheduled_by ON messages (scheduled_by_user_id, folder);
