-- Workspace-scoped thread presence (prevents cross-tenant presence inference via guessable thread keys).

ALTER TABLE thread_presence ADD COLUMN workspace_id TEXT NOT NULL DEFAULT '';

-- Best-effort backfill: presence rows whose thread_key matches a message id or thread_id.
UPDATE thread_presence
SET workspace_id = COALESCE(
  (
    SELECT m.user_id FROM messages m
    WHERE m.id = thread_presence.thread_key OR m.thread_id = thread_presence.thread_key
    LIMIT 1
  ),
  ''
)
WHERE workspace_id = '';

CREATE INDEX IF NOT EXISTS idx_thread_presence_workspace
  ON thread_presence (workspace_id, thread_key, last_seen_at DESC);
