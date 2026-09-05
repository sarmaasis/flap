-- Product features: labels, domain color/mute, assignment, notes, undo-send prefs.

ALTER TABLE domains ADD COLUMN color TEXT NOT NULL DEFAULT '';
ALTER TABLE domains ADD COLUMN muted_until INTEGER;

ALTER TABLE messages ADD COLUMN assignee_user_id TEXT;
ALTER TABLE messages ADD COLUMN plus_tag TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS labels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#1c6e5c',
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_labels_user ON labels (user_id);

CREATE TABLE IF NOT EXISTS message_labels (
  message_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, label_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_labels_label ON message_labels (label_id);

CREATE TABLE IF NOT EXISTS message_notes (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_message_notes_message ON message_notes (message_id, created_at);

ALTER TABLE user_settings ADD COLUMN undo_send_seconds INTEGER NOT NULL DEFAULT 10;
