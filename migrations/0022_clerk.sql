-- Map Clerk identities onto Flap product users without rewriting workspace ids.
-- Existing users keep users.id; clerk_user_id is linked on first successful Clerk session
-- (by clerk id, else by email). Better Auth tables (user/session/account/verification)
-- are no longer written; leave them in place so production data is not dropped recklessly.

ALTER TABLE users ADD COLUMN clerk_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id
  ON users(clerk_user_id)
  WHERE clerk_user_id IS NOT NULL;
