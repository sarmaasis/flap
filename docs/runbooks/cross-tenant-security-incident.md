# Runbook: Cross-tenant security incident

**Symptom:** User reports seeing another workspace’s mail, attachments, keys, or presence.

1. Treat as P0. Disable suspected API tokens (`DELETE` keys for both workspaces if unclear).
2. Identify actor + target workspace ids from logs / `audit_log`.
3. Confirm membership: `SELECT * FROM workspace_members WHERE user_id = ?`.
4. Confirm grants: mailbox_members + workspace_member_domains.
5. If leak confirmed: revoke membership, rotate webhook secrets, notify both owners.
6. Do not restore from backup until grant lists are reviewed (see backup runbook).
7. Add a regression test in `shared/agency-*.test.ts` before closing.
