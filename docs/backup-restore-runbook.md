# Backup / restore runbook

## What exists today

| Store | Reality |
|---|---|
| D1 | Cloudflare account-managed snapshots / PITR if enabled on the D1 database. **No customer self-serve restore UI.** |
| R2 attachments | Object keys referenced from `attachments.r2_key`. Restore DB without R2 = missing files. |
| Membership / grants | `workspace_members`, `mailbox_members`, `workspace_member_domains` |
| Audit | `audit_log` |

## Staging restore drill (required before GO)

This wave **did not execute** a remote staging restore. Before production-ready:

1. Snapshot staging D1.
2. Insert a test member, grant a mailbox, then remove the member.
3. Restore snapshot **or** a logical dump.
4. Confirm the removed member is **not** re-granted unless the snapshot predates removal.
5. Re-apply `0033` if the snapshot predates it.
6. Record date, operator, and outcome here.

**Last drill:** not run (no staging restore evidence in this environment).

## Restore must not resurrect access accidentally

After restore, run:

```sql
SELECT user_id FROM workspace_members WHERE workspace_id = ?;
SELECT user_id, mailbox_id FROM mailbox_members
  WHERE mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = ?);
```

Compare to the intended roster. If a removed employee reappears, delete membership + grants + `thread_presence` + `api_keys.created_by_user_id` before opening the workspace to users.

## Automated local tests

`npx tsx shared/agency-backup-restore.test.ts` (wired into `npm run check`) proves:

- granted-member export omits ungranted and foreign mail;
- restore writes contacts onto the **actor’s workspace**, not a foreign one;
- restore does not rewrite `workspace_members`.

## Export vs restore

Settings JSON / mbox export is **not** a full workspace restore (no membership, keys, or webhooks). Messages/mailboxes/contacts/aliases are workspace + mailbox-ACL scoped; templates/signatures/filters stay personal.
