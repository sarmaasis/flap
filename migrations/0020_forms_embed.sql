-- Public contact forms and embed widgets.

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

CREATE TABLE IF NOT EXISTS embed_widgets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mailbox_id TEXT NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);
