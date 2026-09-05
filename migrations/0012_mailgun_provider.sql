-- DNS-agnostic mail (ses): store provider DNS snapshot per domain.
ALTER TABLE domains ADD COLUMN mail_provider TEXT NOT NULL DEFAULT 'ses';
ALTER TABLE domains ADD COLUMN provider_state TEXT;
ALTER TABLE domains ADD COLUMN provider_dns_json TEXT;
