-- Customer-domain mail on Amazon SES (all plans). System mail stays on Cloudflare.
-- Extends 0012 provider columns with SES readiness timestamps and inbound idempotency.

ALTER TABLE domains ADD COLUMN provider_region TEXT;
ALTER TABLE domains ADD COLUMN ses_identity_arn TEXT;
ALTER TABLE domains ADD COLUMN identity_verified_at INTEGER;
ALTER TABLE domains ADD COLUMN mx_verified_at INTEGER;
ALTER TABLE domains ADD COLUMN inbound_rule_ready_at INTEGER;
ALTER TABLE domains ADD COLUMN receiving_ready_at INTEGER;
ALTER TABLE domains ADD COLUMN sending_ready_at INTEGER;
ALTER TABLE domains ADD COLUMN last_provider_check_at INTEGER;
ALTER TABLE domains ADD COLUMN last_provider_error TEXT;
ALTER TABLE domains ADD COLUMN migration_from TEXT;
ALTER TABLE domains ADD COLUMN migration_state TEXT;

-- At-least-once SES/S3/queue delivery: dedupe by provider message id (+ optional RFC Message-ID).
CREATE TABLE IF NOT EXISTS inbound_idempotency (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  rfc_message_id TEXT,
  domain_id TEXT,
  mailbox_id TEXT,
  outcome TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_idempotency_provider_msg
  ON inbound_idempotency (provider, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_idempotency_created ON inbound_idempotency (created_at);

-- Bounce / complaint suppression for outbound SES.
CREATE TABLE IF NOT EXISTS mail_suppressions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT,
  provider_message_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_suppressions_email ON mail_suppressions (email);
CREATE INDEX IF NOT EXISTS idx_mail_suppressions_created ON mail_suppressions (created_at);

-- Optional provider message id on outbound rows (sent folder).
ALTER TABLE messages ADD COLUMN provider_message_id TEXT;
