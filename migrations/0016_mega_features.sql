-- Mega P0/P1/P2 schema: saved views, disposables, notifies, presence, forms, AI, audit, park, etc.

ALTER TABLE domains ADD COLUMN parked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE domains ADD COLUMN park_mode TEXT NOT NULL DEFAULT ''; -- receive_only | paused | ''
ALTER TABLE domains ADD COLUMN reputation_mode TEXT NOT NULL DEFAULT 'shared'; -- shared | isolated
ALTER TABLE domains ADD COLUMN retention_days INTEGER; -- null = default
ALTER TABLE domains ADD COLUMN legal_hold INTEGER NOT NULL DEFAULT 0;

ALTER TABLE messages ADD COLUMN snooze_pack TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN virus_status TEXT NOT NULL DEFAULT ''; -- clean | quarantine | pending | skipped
ALTER TABLE messages ADD COLUMN open_track INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN parsed_meta TEXT NOT NULL DEFAULT ''; -- JSON structured fields

ALTER TABLE user_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'; -- system | light | dark
ALTER TABLE user_settings ADD COLUMN ai_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE user_settings ADD COLUMN hide_shortcut_sheet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN plus_auto_label INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS saved_views (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query_json TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views (user_id);

CREATE TABLE IF NOT EXISTS disposable_addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  local_part TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (domain_id, local_part)
);
CREATE INDEX IF NOT EXISTS idx_disposable_user ON disposable_addresses (user_id);

CREATE TABLE IF NOT EXISTS notify_channels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- slack | discord
  webhook_url TEXT NOT NULL,
  domain_id TEXT,
  mailbox_id TEXT,
  muted INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notify_user ON notify_channels (user_id);

CREATE TABLE IF NOT EXISTS thread_presence (
  thread_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (thread_key, user_id)
);

CREATE TABLE IF NOT EXISTS contact_forms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  honeypot_field TEXT NOT NULL DEFAULT 'company_website',
  created_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rule_templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  official INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rule_template_installs (
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  installed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, template_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  meta_json TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deliverability_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- bounce | complaint | reject | delivery
  count INTEGER NOT NULL DEFAULT 1,
  day TEXT NOT NULL, -- YYYY-MM-DD UTC
  meta_json TEXT NOT NULL DEFAULT '',
  UNIQUE (domain_id, kind, day)
);
CREATE INDEX IF NOT EXISTS idx_deliv_user ON deliverability_events (user_id, day);

CREATE TABLE IF NOT EXISTS domain_health_public (
  domain_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  show_badge INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS imap_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  UNIQUE (mailbox_id)
);

CREATE TABLE IF NOT EXISTS client_portals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  mailbox_ids_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS va_invites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  mailbox_ids_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  accepted_at INTEGER
);

CREATE TABLE IF NOT EXISTS workspaces_extra (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS parse_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT,
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  field_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_blasts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  recipient_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  capped_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  sent_at INTEGER
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_custom_hosts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hostname TEXT NOT NULL UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS compose_templates_seed (
  id TEXT PRIMARY KEY,
  domain_id TEXT,
  user_id TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_digests (
  user_id TEXT NOT NULL PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  weekday INTEGER NOT NULL DEFAULT 1,
  last_sent_at INTEGER
);

CREATE TABLE IF NOT EXISTS embed_widgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

-- Seed official rule templates
INSERT OR IGNORE INTO rule_templates (id, slug, name, description, rules_json, official, created_at) VALUES
  ('rt_newsletters', 'archive-newsletters', 'Archive newsletters', 'File common newsletter patterns to Archive.', '[{"name":"Newsletters","match_field":"from","match_op":"contains","match_value":"newsletter","action":"archive"}]', 1, 0),
  ('rt_receipts', 'label-receipts', 'Label receipts', 'Tag receipt and invoice senders.', '[{"name":"Receipts","match_field":"subject","match_op":"contains","match_value":"receipt","action":"label","action_value":"receipts"}]', 1, 0),
  ('rt_vip', 'vip-investors', 'VIP investors to folder', 'Star and label investor-looking subjects.', '[{"name":"VIP","match_field":"subject","match_op":"contains","match_value":"term sheet","action":"star"}]', 1, 0),
  ('rt_sla', 'support-sla-tag', 'Support SLA tag', 'Label support@ style subjects for SLA.', '[{"name":"Support SLA","match_field":"subject","match_op":"contains","match_value":"support","action":"label","action_value":"sla"}]', 1, 0);
