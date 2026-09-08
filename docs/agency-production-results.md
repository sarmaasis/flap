# Agency / studio production results

**Date:** 2026-09-09  
**Plan:** `docs/agency-production-master-plan.md`  
**Also:** `docs/agency-authorization-matrix.md`, `docs/agency-schema-migration-plan.md`

## Production-ready: **NO**

In-repo P0 authorization plus leftover offboard/session, operator notify, backup tests, rollback rehearsal, and agency HTTP isolation are implemented. The spec’s 10/10 bar is **not** met: live Gmail/Outlook, remote staging restore, and a dedicated production on-call pipeline (PagerDuty or equivalent) have **no evidence** in this environment.

## Architecture implemented

- Workspace remains implicit (`workspace_id` = owner `users.id`).
- Roles: Owner / Admin / Member (no read-only, no SSO).
- Active workspace: `resolveWorkspace` + `flap_ws`; unknown ids ignored.
- Domain grants: `workspace_member_domains` unioned with `mailbox_members` (workspace-scoped).
- Contacts: **workspace-level**. Templates/signatures stay personal.
- API keys / webhooks: `ctx.workspaceId` + owner/admin only; `created_by_user_id`.
- Scheduled send: `scheduled_by_user_id` re-checked at `flushScheduled`.
- Export: messages/mailboxes/contacts/aliases use workspace + mailbox ACL; templates/signatures/filters stay personal.
- Offboard: Clerk Admin session revoke when `clerk_user_id` is linked.
- Operator alerts: existing Slack/Discord `notify_channels` (workspace-wide).
- Client groups: optional, **not** an ACL.

## Schema migrations

| Migration | Status |
|---|---|
| `0033_agency_production.sql` | Applied **locally** (prior wave). No new migration this wave. |
| `0030`–`0032` | Prior wave; not re-applied remotely. |

**Backward compatibility:** solo users unchanged. Invite accept still matches plaintext `token` or `token_hash`.

## Completed this wave (leftovers + remaining P1/P2 in-repo)

- Clerk session revoke on member remove (`revokeClerkSessionsForFlapUser`)
- Slack/Discord operator alerts on remove + scheduled deny
- Domain grant/revoke tests + agency HTTP isolation (ungranted mail/attachment/presence/send/delivery/export/offboard)
- HTTP harness uses production `resolveWorkspace` (not a solo-only stub)
- Workspace-scoped export/restore helpers + automated tests
- Local rollback rehearsal script
- Invite hourly abuse cap (25/workspace)
- Notify-channel CRUD owner/admin only
- Team UI: granted-member roster + first-setup copy
- Transfer remains **RFC only**

## Deferred / residual stop-ship

- Live Flap↔Gmail / Flap↔Outlook agency matrix
- Staging D1 restore drill (remote)
- PagerDuty / staff on-call (Slack/Discord channels are opt-in per workspace)
- Remote apply of `0033`
- Full Worker+Clerk boot suite
- Invite **email** delivery (link copy remains)
- Domain transfer implementation, read-only RBAC, SSO, AI/calendar/advanced newsletters

## Tests run

```text
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.worker.json
npx tsx shared/agency-authz.test.ts
npx tsx shared/agency-role-escalation.test.ts
npx tsx shared/agency-invitations.test.ts
npx tsx shared/agency-offboarding.test.ts
npx tsx shared/agency-mailbox-permissions.test.ts
npx tsx shared/agency-send-policy.test.ts
npx tsx shared/agency-presence.test.ts
npx tsx shared/agency-api-key-webhook.test.ts
npx tsx shared/agency-audit-log.test.ts
npx tsx shared/agency-http-isolation.test.ts
npx tsx shared/agency-backup-restore.test.ts
npx tsx shared/agency-operator-alerts.test.ts
npx tsx shared/http-tenant-isolation.test.ts
npx tsx scripts/agency-rollback-rehearsal.ts
```

**Outcomes:** all of the above **passed**. Settings Team roster was not browser-verified (Clerk login not available in this pass).

## Gmail/Outlook matrix

**Not run.** Remaining stop-ship.

## Restore / rollback / alerts

- Customer JSON restore tests: **pass** (not a full D1 snapshot)
- Staging restore drill: **not executed**
- Rollback: local rehearsal **pass**; remote unused
- Alerts: Slack/Discord `notify_channels` wired; **not** a production PagerDuty proof

## GO / NO-GO

**NO-GO** for “10/10 production-ready for agency/studio use.”  
**GO for continuing staging:** apply `0033` remotely, configure a workspace Slack/Discord ops channel, run live mail + D1 restore checklist.

## Key files

- `worker/lib/clerk.ts`, `worker/lib/workspace-notify.ts`, `worker/lib/workspace-backup.ts`
- `worker/lib/team.ts`, `worker/lib/workspace.ts`, `worker/lib/notify-channels.ts`
- `shared/http-tenant-isolation-harness.ts`, `shared/agency-*.test.ts`, `scripts/agency-rollback-rehearsal.ts`
- `src/pages/settings/SettingsApp.tsx`
- `migrations/0033_agency_production.sql` (unchanged this wave)
