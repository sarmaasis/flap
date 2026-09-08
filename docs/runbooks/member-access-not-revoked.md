# Runbook: Member access not revoked

**Stop-ship if a removed member can still read or send.**

1. `DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?`
2. `DELETE FROM mailbox_members WHERE user_id = ? AND mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = ?)`
3. `DELETE FROM workspace_member_domains WHERE workspace_id = ? AND user_id = ?`
4. `DELETE FROM thread_presence WHERE workspace_id = ? AND user_id = ?`
5. Cancel scheduled: `UPDATE messages SET folder='drafts', scheduled_at=NULL WHERE user_id=? AND scheduled_by_user_id=? AND folder='scheduled'`
6. `DELETE FROM api_keys WHERE user_id=? AND created_by_user_id=?`
7. Settings remove calls Clerk Admin `sessions.revokeSession` for the member’s `clerk_user_id` when Clerk is configured. If they still have a tab open, confirm sessions are gone in the Clerk Dashboard.
8. Workspace-wide Slack/Discord notify channels receive a `member_removed` operator alert when configured.
9. Write `team.member_removed` via Settings remove if not already audited.
