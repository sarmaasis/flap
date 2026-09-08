# Agency schema migration plan

**Migration:** `migrations/0033_agency_production.sql`  
**Strategy:** additive first. No destructive rewrites of `user_id` ownership.

## Phase 1 — Backfill identity (already done in `0006`)

Existing users already have `workspace_members` owner rows (`workspace_id = users.id`).

## Phase 2 — Additive agency columns (`0033`)

| Object | Change | Backfill | Constraint |
|---|---|---|---|
| `workspace_member_domains` | New table | Empty (explicit grants) | PK workspace+user+domain |
| `clients` | New table | Empty | workspace-scoped |
| `domains.client_id` | Nullable | NULL | No FK (SQLite) |
| `workspace_members` status / invited_by / accepted_at / removed_at | Defaults | `status='active'` | None |
| `workspace_invites.token_hash` / `domain_ids` / `revoked_at` | Nullable / default `[]` | App hashes on new invites; accept still matches plaintext `token` | Index on hash |
| `api_keys.created_by_user_id` | Nullable | NULL (treat as workspace key) | None |
| `webhooks.created_by_user_id` | Nullable | NULL | None |
| `messages.scheduled_by_user_id` | Nullable | NULL = skip actor re-check (owner/legacy) | Index |

## Phase 3 — Compatibility

Code uses `COALESCE(status,'active')` and try/catch around new columns. Solo users unchanged: `workspace_id === user_id`.

## Phase 4 — Do not remove implicit owner id yet

Do not drop `user_id` on mail/domains. Compatibility adapter remains `workspaceId` bound as `user_id`.

## Staging rehearsal

```bash
npm run db:migrate:local
```

Verify:

```sql
SELECT name FROM sqlite_master WHERE name IN ('workspace_member_domains','clients');
PRAGMA table_info(messages);
PRAGMA table_info(workspace_invites);
```

## Rollback

See `docs/release-rollback-runbook.md`. Columns are additive — leave them if rolling back Worker code. New tables unused by old code.

## Irreversible

None in `0033`. Do not add unique constraints that fail on dirty data.
