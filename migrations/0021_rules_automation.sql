-- Official rule templates, parse rules, message extras, prefs, IMAP stubs, newsletter.

ALTER TABLE messages ADD COLUMN snooze_pack TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN virus_status TEXT NOT NULL DEFAULT ''; -- clean | quarantine | pending | skipped
ALTER TABLE messages ADD COLUMN open_track INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN parsed_meta TEXT NOT NULL DEFAULT ''; -- JSON structured fields

ALTER TABLE user_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'system'; -- system | light | dark
ALTER TABLE user_settings ADD COLUMN ai_opt_in INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE user_settings ADD COLUMN hide_shortcut_sheet INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN plus_auto_label INTEGER NOT NULL DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS parse_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  domain_id TEXT,
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  field_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
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

INSERT OR IGNORE INTO rule_templates (id, slug, name, description, rules_json, official, created_at) VALUES
  ('rt_newsletters', 'archive-newsletters', 'Archive newsletters', 'File common newsletter patterns to Archive.', '[{"name":"Newsletters","match_field":"from","match_op":"contains","match_value":"newsletter","action":"archive"}]', 1, 0),
  ('rt_receipts', 'label-receipts', 'Label receipts', 'Tag receipt and invoice senders.', '[{"name":"Receipts","match_field":"subject","match_op":"contains","match_value":"receipt","action":"label","action_value":"receipts"}]', 1, 0),
  ('rt_vip', 'vip-investors', 'VIP investors to folder', 'Star and label investor-looking subjects.', '[{"name":"VIP","match_field":"subject","match_op":"contains","match_value":"term sheet","action":"star"}]', 1, 0),
  ('rt_sla', 'support-sla-tag', 'Support SLA tag', 'Label support@ style subjects for SLA.', '[{"name":"Support SLA","match_field":"subject","match_op":"contains","match_value":"support","action":"label","action_value":"sla"}]', 1, 0);
