-- Workspace-scoped suppressions + durable inbound failure breadcrumbs.
-- Product rule: suppressions are per workspace (user_id = workspace owner), not SES-account-global.
-- Send checks and Settings list/delete only see the current workspace's rows.

ALTER TABLE mail_suppressions ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

-- Backfill from the outbound message that produced the bounce/complaint.
UPDATE mail_suppressions
SET user_id = COALESCE(
  (
    SELECT m.user_id
    FROM messages m
    WHERE m.provider_message_id IS NOT NULL
      AND m.provider_message_id != ''
      AND m.provider_message_id = mail_suppressions.provider_message_id
    LIMIT 1
  ),
  ''
)
WHERE user_id = ''
  AND provider_message_id IS NOT NULL
  AND provider_message_id != '';

-- Fallback: last attributed delivery event for the same recipient email.
UPDATE mail_suppressions
SET user_id = COALESCE(
  (
    SELECT d.user_id
    FROM delivery_event_log d
    WHERE d.user_id IS NOT NULL
      AND d.user_id != ''
      AND lower(d.recipient_email) = lower(mail_suppressions.email)
    ORDER BY d.created_at DESC
    LIMIT 1
  ),
  user_id
)
WHERE user_id = '';

-- Deduplicate before unique (user_id, email) — keep newest row.
DELETE FROM mail_suppressions
WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM mail_suppressions GROUP BY user_id, lower(email)
);

DROP INDEX IF EXISTS idx_mail_suppressions_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_suppressions_user_email
  ON mail_suppressions (user_id, email);
CREATE INDEX IF NOT EXISTS idx_mail_suppressions_user
  ON mail_suppressions (user_id, created_at DESC);

-- Last ingest failure visible in Settings → Deliverability (operator “what happened?”).
ALTER TABLE domains ADD COLUMN last_inbound_error TEXT;
ALTER TABLE domains ADD COLUMN last_inbound_error_at INTEGER;
ALTER TABLE domains ADD COLUMN last_inbound_provider_message_id TEXT;

-- Append-only ingest outcomes for support lookup by provider message id (does not block SES retry).
CREATE TABLE IF NOT EXISTS inbound_ingest_log (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  domain_id TEXT NOT NULL DEFAULT '',
  mailbox_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbound_ingest_log_provider_msg
  ON inbound_ingest_log (provider, provider_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_ingest_log_domain
  ON inbound_ingest_log (domain_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_ingest_log_user
  ON inbound_ingest_log (user_id, created_at DESC);
