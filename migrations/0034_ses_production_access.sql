-- Workspace outbound access + send status for SES production-access controls.
-- Defaults keep existing workspaces sendable (APPROVED / ACTIVE).

ALTER TABLE users ADD COLUMN outbound_access_status TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE users ADD COLUMN send_status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN reputation_warning_at INTEGER;

-- Idempotent SES event ingest when provider message id is present.
CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_event_idempotency
  ON delivery_event_log (provider_message_id, recipient_email, kind)
  WHERE provider_message_id IS NOT NULL AND provider_message_id != '';
