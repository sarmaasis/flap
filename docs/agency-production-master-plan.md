# Flap — Agency / Studio Production Master Plan

**Product:** Flap (`useflap.online`)  
**Date:** 2026-09-09  
**Source spec:** `FLAP_AGENCY_PRODUCTION_READINESS_MASTER_PLAN.md`  
**Related:** `docs/rfc-agency-workspaces.md`, `docs/next-security-core-plan.md`, `docs/next-security-core-results.md`, `docs/audit-http-tenant-isolation.md`  
**Rule:** Agency/studio support is a primary production requirement. Do not treat `workspace_id === session.user.id` as the general authz model.

**Inspection note:** Status below is from repository inspection (not assumption). Solo-owner `user_id` storage remains the billing/data owner; membership is already a real table.

---

## Architecture snapshot (current)

| Concept | Current implementation |
|---|---|
| Workspace identity | Implicit: `workspace_id` = owner `users.id`. No `workspaces` table. Holding stub `workspaces_extra` is **not** wired into `resolveWorkspace`. |
| Membership | `workspace_members (workspace_id, user_id, role, created_at)` |
| Roles | `owner` / `admin` / `member` (no `read-only`) |
| Active workspace | Cookie `flap_ws` + `resolveWorkspace()` — preferred id must already be a membership |
| Mailbox grants | `mailbox_members` + `mailboxAccessClause` on mail routes |
| Domain grants | **Not implemented** (`GET /api/domain-iam` is a static stub) |
| Invites | `workspace_invites` with plaintext `token`, 14-day expiry, revoke, email match on accept |
| API keys / webhooks / contacts | Session `user.id` (solo-safe; team-member quirk) |
| Audit | `audit_log` + `writeAuditLog`; used sparsely; Team GET exists; no Settings UI |
| Presence | Workspace-scoped (`0032`); does not re-check mailbox grant |
| Scheduled send | `flushScheduled` re-checks domain/suppression/quota; **does not** re-check actor membership |

---

## P0-1 — Inspect current ownership / membership schema

| Field | Detail |
|---|---|
| **Current state** | Already implemented. Schema in `0001`/`0004`/`0006`; backfill owners in `0006`. |
| **Relevant files** | `migrations/0004_ops.sql`, `0006_teams_oauth.sql`, `worker/lib/team.ts` |
| **Current auth model** | Resources stored as `user_id = workspace owner id`. Members join via `workspace_members`. |
| **Required change** | Additive columns/tables only. Do not rewrite `user_id` ownership. |
| **Migration requirement** | None for this inspect item. Later: `0033_agency_production.sql`. |
| **Security risk** | Blind rewrite would break every route. |
| **Tests** | N/A (inventory). |
| **Acceptance criteria** | Plan documents real tables; no assumed missing membership. |
| **Dependencies** | None. |
| **Estimated complexity** | Done (inspect). |

---

## P0-2 — Workspace / member target architecture

| Field | Detail |
|---|---|
| **Current state** | Partial. Target documented in RFC; code still implicit-workspace. |
| **Relevant files** | `docs/rfc-agency-workspaces.md`, `worker/lib/team.ts` |
| **Current auth model** | `Authenticated user → membership → flap_ws → role → mailboxIds`. |
| **Required change** | Keep implicit workspace; add domain grants + central helpers; document identity vs workspace vs grants. |
| **Migration requirement** | Additive only. |
| **Security risk** | Medium if helpers drift from routes. |
| **Tests** | `shared/agency-authz.test.ts` |
| **Acceptance criteria** | Written architecture + helpers used by team/mail/send. |
| **Dependencies** | P0-1. |
| **Estimated complexity** | Medium. |

---

## P0-3 — Workspace membership model

| Field | Detail |
|---|---|
| **Current state** | Already implemented (`workspace_members` + owner backfill). Missing status / invited_by / accepted_at / removed_at. |
| **Relevant files** | `migrations/0006_teams_oauth.sql`, `worker/lib/team.ts` |
| **Current auth model** | PK `(workspace_id, user_id)`; role string. |
| **Required change** | Additive status columns; treat missing row as not a member. |
| **Migration requirement** | `ALTER` membership columns (nullable / defaults). |
| **Security risk** | Removed members with leftover grants (offboarding must delete both). |
| **Tests** | Membership resolve + remove. |
| **Acceptance criteria** | Owner membership auto-provisioned; foreign users have no row. |
| **Dependencies** | P0-2. |
| **Estimated complexity** | Low. |

---

## P0-4 — Active workspace resolution

| Field | Detail |
|---|---|
| **Current state** | Already implemented: `resolveWorkspace(db, userId, flap_ws)`. |
| **Relevant files** | `worker/lib/team.ts`, `worker/index.ts` `GET /api/me` |
| **Current auth model** | Preferred id ignored unless it is an existing membership. Defaults to self-owned workspace. |
| **Required change** | Keep cookie check; harness must resolve membership the same way (today harness forces `workspaceId === userId`). |
| **Migration requirement** | None. |
| **Security risk** | High if client-supplied workspace trusted. Current code does **not** trust unknown ids. |
| **Tests** | Harness: member of A cannot set workspace B via header/cookie. |
| **Acceptance criteria** | Arbitrary `workspace_id` / `flap_ws` never selects a non-membership. |
| **Dependencies** | P0-3. |
| **Estimated complexity** | Low (prod) / medium (harness parity). |

---

## P0-5 — Owner / Admin / Member roles

| Field | Detail |
|---|---|
| **Current state** | Partial. Roles exist. Admin = all mailboxes + team/settings. Member = grants only. No PATCH role. Admin can remove other admins. |
| **Relevant files** | `worker/lib/team.ts`, `worker/lib/workspace.ts` `/api/team*` |
| **Current auth model** | `canManageTeam` / `canManageSettings` = owner \|\| admin. |
| **Required change** | Enforce: only owner removes/changes admins; cannot invite `owner`; cannot PATCH self to admin; admin cannot billing/transfer. |
| **Migration requirement** | None. |
| **Security risk** | Role escalation via accept `ON CONFLICT DO UPDATE SET role` (can overwrite owner). |
| **Tests** | `shared/agency-role-escalation.test.ts` |
| **Acceptance criteria** | Owner protected; admin cannot do owner-only ops; member cannot escalate. |
| **Dependencies** | P0-3. |
| **Estimated complexity** | Medium. |

---

## P0-6 — Domain grants

| Field | Detail |
|---|---|
| **Current state** | Not implemented. Domain IAM stub only. |
| **Relevant files** | `worker/lib/domain-controls.ts`, `GET /api/domains` (empty + `read_only` for members) |
| **Current auth model** | All-or-nothing settings vs mail ACL. |
| **Required change** | Table `workspace_member_domains`; expand member `mailboxIds` to all mailboxes on granted domains; members may list granted domain names. |
| **Migration requirement** | New table in `0033`. |
| **Security risk** | High — without this, agencies over-grant via Admin or under-grant via per-mailbox only. |
| **Tests** | Domain-grant member can access domain A mail, not domain B. |
| **Acceptance criteria** | Server-side domain grant expands mailbox access; ungranted domains not enumerable as mailboxes. |
| **Dependencies** | P0-5, P0-7. |
| **Estimated complexity** | Medium. |

---

## P0-7 — Mailbox grants

| Field | Detail |
|---|---|
| **Current state** | Implemented. Grants scoped to workspace mailboxes; unioned with domain grants; Team UI grant/revoke. |
| **Relevant files** | `worker/lib/team.ts`, `shared/security-guards.ts`, Settings Team tab |
| **Current auth model** | `mailboxIds === null` owner/admin; else IN-list. Mail routes use `user_id = workspaceId` + clause. |
| **Required change** | Scope grants to workspace mailboxes; union domain grants; wire Team UI. |
| **Migration requirement** | None required (index already exists). |
| **Security risk** | Stop-ship if ungranted same-workspace mailbox readable. |
| **Tests** | `shared/agency-mailbox-permissions.test.ts` + harness. |
| **Acceptance criteria** | Mailbox X grant ≠ mailbox Y; grants do not leak across workspaces. |
| **Dependencies** | P0-3. |
| **Estimated complexity** | Medium. |

---

## P0-8 — Central authorization helpers

| Field | Detail |
|---|---|
| **Current state** | Partial: `resolveWorkspace`, `mailboxAccessClause`, `assertMailboxAccess`, `messageAuthzWhere`. No `requireWorkspaceRole` / domain helpers. |
| **Relevant files** | `worker/lib/team.ts`, `shared/security-guards.ts` |
| **Current auth model** | Scattered `if (!ctx.canManageTeam)` in routes. |
| **Required change** | `shared/agency-authz.ts` + team wrappers: role rank, invite token hash, grant union, scheduled-actor check. |
| **Migration requirement** | None. |
| **Security risk** | Drift if routes skip helpers. |
| **Tests** | Unit helpers + harness using same SQL. |
| **Acceptance criteria** | WHO / WHICH workspace / WHICH resource / WHICH permission answerable in one module. |
| **Dependencies** | P0-2. |
| **Estimated complexity** | Medium. |

---

## P0-9 — Contacts / API keys / webhooks → workspace scope

| Field | Detail |
|---|---|
| **Current state** | Partial / known quirk. Keys hashed + one-time token display. CRUD uses `user.id` not `ctx.workspaceId`. |
| **Relevant files** | `worker/lib/workspace.ts` `/api/contacts`, `/api/keys`, `/api/webhooks` |
| **Current auth model** | Solo owner: `user.id === workspaceId`. Team member acting in agency workspace sees **their own** empty keys, not workspace keys — and could create keys under **their** user id (personal, not agency). |
| **Required change** | Scope list/create/delete to `ctx.workspaceId`; require `canManageSettings` for keys/webhooks; contacts are **workspace-level** (shared address book). `created_by_user_id` additive. |
| **Migration requirement** | Additive `created_by_user_id` columns. |
| **Security risk** | Cross-workspace key/webhook IDOR; member-created orphan keys. |
| **Tests** | `shared/agency-api-key-webhook.test.ts` |
| **Acceptance criteria** | Member cannot CRUD keys/webhooks; workspace A token cannot list B; contacts shared inside workspace only. |
| **Dependencies** | P0-4. |
| **Estimated complexity** | Medium. |

---

## P0-10 — Route-by-route authorization migration

| Field | Detail |
|---|---|
| **Current state** | Partial. Mail routes already use workspace + mailbox ACL. Contacts/keys/webhooks/templates/signatures still `user.id`. Delivery events owner/admin only (members see nothing — safer than leak, weaker than scoped). |
| **Relevant files** | `worker/index.ts`, `worker/lib/workspace.ts`, `worker/lib/product-features.ts` |
| **Current auth model** | Mixed. |
| **Required change** | Keys/webhooks/contacts → workspace; delivery events scoped for members with domain grants; domains list granted names for members. Templates/signatures stay personal (`user.id`) — documented. |
| **Migration requirement** | None beyond P0-9. |
| **Security risk** | Residual personal-scoped surfaces if a member expects shared templates. |
| **Tests** | Extended HTTP harness. |
| **Acceptance criteria** | No mail/key/webhook/contact cross-workspace leak; ungranted mailbox deny. |
| **Dependencies** | P0-8, P0-9. |
| **Estimated complexity** | High. |

---

## P0-11 — Invitation security

| Field | Detail |
|---|---|
| **Current state** | Partial. Expiry, single-use status, revoke, email match, seat limits. Gaps: plaintext token in DB **and** `GET /api/team` for all members; accept `ON CONFLICT` overwrites role (owner downgrade / escalate); no inviter-still-authorized check; no token hash. |
| **Relevant files** | `worker/lib/team.ts` `createInvite` / `acceptInvite`, `workspace.ts` team routes |
| **Current auth model** | `canManageTeam` to create/revoke. Accept is authenticated + email match. |
| **Required change** | Hash tokens; hide raw token from non-managers; refuse role overwrite of owner; ignore role change if already a member; reject accept if inviter lost manage permission; cannot invite `owner`. |
| **Migration requirement** | `token_hash` column; backfill hash from existing token. |
| **Security risk** | Token leak + role overwrite = stop-ship. |
| **Tests** | `shared/agency-invitations.test.ts` |
| **Acceptance criteria** | Expired/reused/revoked/wrong-email/tampered-role/wrong-workspace fail closed. |
| **Dependencies** | P0-5. |
| **Estimated complexity** | Medium. |

---

## P0-12 — Member removal / offboarding

| Field | Detail |
|---|---|
| **Current state** | Implemented. `removeWorkspaceMember` clears membership, mailbox/domain grants, presence, pending invites they created, member-created API keys, cancels their scheduled mail. Route also revokes Clerk sessions via Admin API and posts Slack/Discord operator alert. |
| **Relevant files** | `worker/lib/workspace.ts` `DELETE /api/team/members/:userId` |
| **Current auth model** | `canManageTeam`; cannot remove `memberId === workspaceId`. |
| **Required change** | Central `removeWorkspaceMember()`: membership, mailbox grants, domain grants, presence, pending invites they created, API keys `created_by`, fail/cancel their scheduled messages. Audit event. Admin cannot remove admin unless actor is owner. |
| **Migration requirement** | `scheduled_by_user_id` on messages. |
| **Security risk** | **Stop-ship:** removed member still reads/sends. |
| **Tests** | `shared/agency-offboarding.test.ts` |
| **Acceptance criteria** | Immediate deny on mail/send/presence/keys after removal. History remains on workspace. |
| **Dependencies** | P0-7, P0-11, P0-15. |
| **Estimated complexity** | Medium. |

---

## P0-13 — Actual-handler IDOR tests

| Field | Detail |
|---|---|
| **Current state** | Harness uses production `resolveWorkspace` (domain+mailbox grants). Solo A vs B plus `shared/agency-http-isolation.test.ts` (ungranted, attachment, presence, delivery, export, offboard). Still not a full Worker+Clerk boot. |
| **Relevant files** | `shared/http-tenant-isolation*.ts`, `docs/audit-http-tenant-isolation.md` |
| **Current auth model** | Same SQL helpers as Worker `team.ts`. `X-Flap-Workspace` selects membership; unknown ids ignored. |
| **Required change** | Agency fixture (Owner/Admin/Member domain/mailbox/removed + Workspace B) + harness membership resolution + team routes. Full Wrangler+Clerk remains residual (CI cost). |
| **Migration requirement** | None. |
| **Security risk** | Drift vs production Worker. |
| **Tests** | Extend harness + `npm run check`. |
| **Acceptance criteria** | Cross-workspace and ungranted same-workspace cases 403/404, no secret body. |
| **Dependencies** | P0-8. |
| **Estimated complexity** | High. |

---

## P0-14 — Role escalation tests

| Field | Detail |
|---|---|
| **Current state** | Not implemented as a dedicated suite. |
| **Relevant files** | To add `shared/agency-role-escalation.test.ts` |
| **Current auth model** | No PATCH role route today (escalation via accept overwrite / invite role field). |
| **Required change** | Tests + PATCH role that cannot escalate. |
| **Migration requirement** | None. |
| **Security risk** | High. |
| **Tests** | Dedicated file in `npm run check`. |
| **Acceptance criteria** | Member cannot become admin/owner via API; admin cannot transfer ownership. |
| **Dependencies** | P0-5, P0-13. |
| **Estimated complexity** | Low. |

---

## P0-15 — Sender identity revalidation

| Field | Detail |
|---|---|
| **Current state** | Partial. `pickFromMailbox` + `resolveReplyFromAddress` + outbound domain policy. Scheduled flush does **not** re-check actor grants. No `scheduled_by_user_id`. |
| **Relevant files** | `worker/index.ts` send, `worker/lib/workspace.ts` `flushScheduled`, `shared/outbound-send-policy.ts` |
| **Current auth model** | Compose-time mailbox ACL; dispatch-time domain/suppression only. |
| **Required change** | Persist `scheduled_by_user_id`; at flush, re-resolve actor membership + mailbox/domain grant + domain ready; fail to drafts + audit if revoked. |
| **Migration requirement** | `messages.scheduled_by_user_id`. |
| **Security risk** | **Stop-ship:** scheduled send after revoke. |
| **Tests** | `shared/agency-send-policy.test.ts` |
| **Acceptance criteria** | Dispatch re-checks; revoked member mail is not sent. |
| **Dependencies** | P0-7, P0-12. |
| **Estimated complexity** | Medium. |

---

## P0-16 — Presence revocation / scoping

| Field | Detail |
|---|---|
| **Current state** | Partial. Workspace ownership of thread required (`0032`). No mailbox-grant check; presence rows not deleted on offboard. |
| **Relevant files** | `worker/lib/collaboration-extras.ts`, `migrations/0032_presence_workspace.sql` |
| **Current auth model** | Team plan + thread in workspace. |
| **Required change** | Require mailbox access on thread; delete presence on remove; deny after revoke. |
| **Migration requirement** | None. |
| **Security risk** | Presence leak / stale viewers. |
| **Tests** | `shared/agency-presence.test.ts` |
| **Acceptance criteria** | Foreign/ungranted/removed cannot subscribe or appear. |
| **Dependencies** | P0-7, P0-12. |
| **Estimated complexity** | Low. |

---

## P0-17 — Audit log

| Field | Detail |
|---|---|
| **Current state** | Partial. Table + GET `/api/audit-log` (Team plan). Team lifecycle not written. No UI. Members who can call GET see all workspace events if on Team plan (no role gate beyond plan). |
| **Relevant files** | `worker/lib/plan-guard.ts` `writeAuditLog`, `collaboration-extras.ts` |
| **Current auth model** | `user_id` column = workspace id. |
| **Required change** | Audit invite/accept/revoke/remove/role/grants/keys/webhooks/scheduled-fail; GET requires owner/admin. |
| **Migration requirement** | None. |
| **Security risk** | Member reading admin audit; missing offboard evidence. |
| **Tests** | `shared/agency-audit-log.test.ts` |
| **Acceptance criteria** | Required team events present; no message bodies; members denied. |
| **Dependencies** | P0-11, P0-12. |
| **Estimated complexity** | Low. |

---

## P0-18 — Staging migration rehearsal

| Field | Detail |
|---|---|
| **Current state** | Local apply used for `0030`–`0032`. No recorded agency `0033` rehearsal yet. |
| **Relevant files** | `docs/agency-schema-migration-plan.md` (to create), `npm run db:migrate:local` |
| **Current auth model** | N/A. |
| **Required change** | Additive `0033`; local apply; document staging SQL checks; no remote prod migrate from this wave. |
| **Migration requirement** | `0033_agency_production.sql`. |
| **Security risk** | Unique indexes / destructive changes — avoid. |
| **Tests** | Local migrate success. |
| **Acceptance criteria** | Migration additive, idempotent, rollback notes written. |
| **Dependencies** | All P0 schema items. |
| **Estimated complexity** | Low. |

---

## P1-19 — Team management UI

| Field | Detail |
|---|---|
| **Current state** | Implemented. Invite + post-join mailbox/domain grants, role PATCH (owner for admin), unshare revoke prompt, shared-inbox granted-member roster, first-setup copy. |
| **Relevant files** | `src/pages/settings/SettingsApp.tsx`, `src/lib/api.ts` |
| **Current auth model** | UI gated by `can_manage_team`. |
| **Required change** | Grant/revoke mailbox + domain after join; change role (owner-only for admin); copy clarifies shared vs granted. |
| **Migration requirement** | None. |
| **Security risk** | UI-only grants would be insufficient — APIs must enforce. |
| **Tests** | API tests; UI manual/browser. |
| **Acceptance criteria** | Owner/admin can grant and revoke without re-invite. |
| **Dependencies** | P0-5–P0-7. |
| **Estimated complexity** | Medium. |

---

## P1-20 — Domain / mailbox permission UI

| Field | Detail |
|---|---|
| **Current state** | Implemented. Per-member domain + mailbox grant editor after join. |
| **Relevant files** | Settings Team tab |
| **Current auth model** | Same as APIs. |
| **Required change** | Per-member domain + mailbox grant lists. |
| **Migration requirement** | Uses P0-6 table. |
| **Security risk** | Low if APIs correct. |
| **Tests** | API. |
| **Acceptance criteria** | Visible “this person will see” grants. |
| **Dependencies** | P1-19. |
| **Estimated complexity** | Medium. |

---

## P1-21 — Shared inbox UX

| Field | Detail |
|---|---|
| **Current state** | Implemented. Team UI lists granted members per shared mailbox; unshare can revoke grants. ACL remains grants, not the shared flag. |
| **Relevant files** | `SettingsApp.tsx`, `MailboxesAppPage.tsx`, `Inbox.tsx` |
| **Current auth model** | Shared flag ≠ ACL; grants are ACL. |
| **Required change** | Team UI lists who can access each mailbox; unshare does not silently keep grants (prompt + optional revoke-all). |
| **Migration requirement** | None. |
| **Security risk** | Confusion leading to over-share. |
| **Tests** | API revoke-all on unshare optional. |
| **Acceptance criteria** | Shared vs granted is visible. |
| **Dependencies** | P0-7. |
| **Estimated complexity** | Low. |

---

## P1-22 — Client grouping

| Field | Detail |
|---|---|
| **Current state** | Not implemented (`client_portals` stub is unrelated). |
| **Relevant files** | New table + Settings domains/team |
| **Current auth model** | Navigation/reporting only — **not** a security boundary. |
| **Required change** | `clients` + optional `domains.client_id`; owner/admin CRUD. |
| **Migration requirement** | `0033` clients table. |
| **Security risk** | Must not be used as authz substitute. |
| **Tests** | Cross-workspace client IDOR. |
| **Acceptance criteria** | Optional grouping; foreign client 404. |
| **Dependencies** | P0-4. |
| **Estimated complexity** | Medium. |

---

## P1-23 — Usage visibility

| Field | Detail |
|---|---|
| **Current state** | Partial billing `collectUsage` workspace totals. No per-domain/mailbox breakdown API/UI. |
| **Relevant files** | `worker/lib/billing.ts` |
| **Current auth model** | Owner billing routes use `user.id`. |
| **Required change** | Owner/admin `GET /api/agency/usage` counts (domains, mailboxes, sends, storage) by domain. No fabricated scores. |
| **Migration requirement** | None. |
| **Security risk** | Member must not see full workspace usage. |
| **Tests** | Role deny. |
| **Acceptance criteria** | Owner/admin see real counts only. |
| **Dependencies** | P0-5. |
| **Estimated complexity** | Low. |

---

## P1-24 / P1-25 — API key & webhook workspace UX

| Field | Detail |
|---|---|
| **Current state** | Developer settings exist; copy implies personal keys. |
| **Relevant files** | Settings developers tab |
| **Current auth model** | After P0-9, workspace-scoped + admin/owner. |
| **Required change** | Copy: workspace-scoped, one-time reveal, members cannot create. |
| **Migration requirement** | None. |
| **Security risk** | Low. |
| **Tests** | Existing create/list. |
| **Acceptance criteria** | UI matches server policy. |
| **Dependencies** | P0-9. |
| **Estimated complexity** | Low. |

---

## P1-26 — Audit log UI

| Field | Detail |
|---|---|
| **Current state** | Not implemented. |
| **Relevant files** | Settings Team / new Audit section |
| **Current auth model** | Owner/admin after P0-17. |
| **Required change** | List last 200 actions. |
| **Migration requirement** | None. |
| **Security risk** | Do not render raw secrets from meta. |
| **Tests** | API. |
| **Acceptance criteria** | Team actions visible to managers. |
| **Dependencies** | P0-17. |
| **Estimated complexity** | Low. |

---

## P1-27 — Deliverability scoped to granted resources

| Field | Detail |
|---|---|
| **Current state** | Owner/admin only (deny members). |
| **Relevant files** | `product-features.ts` |
| **Current auth model** | `canManageSettings`. |
| **Required change** | Members: events for granted `domain_id`s only (if any). Still deny suppressions mutate. |
| **Migration requirement** | None. |
| **Security risk** | Over-broad list. |
| **Tests** | Member sees only granted domain events. |
| **Acceptance criteria** | No foreign/ungranted delivery rows. |
| **Dependencies** | P0-6. |
| **Estimated complexity** | Low. |

---

## P1-28 — Gmail / Outlook interoperability

| Field | Detail |
|---|---|
| **Current state** | Not implemented as an automated live matrix. Reply-from unit matrix exists. |
| **Relevant files** | `shared/security-phase-b.test.ts`, `docs/mail-architecture.md` |
| **Current auth model** | N/A. |
| **Required change** | Document required live matrix + header checklist. **Cannot pass in CI without staging mailboxes.** Mark as remaining stop-ship. |
| **Migration requirement** | None. |
| **Security risk** | Shipping without live proof. |
| **Tests** | Checklist only this wave. |
| **Acceptance criteria** | Honest NO-GO until staging matrix run. |
| **Dependencies** | Human staging. |
| **Estimated complexity** | External. |

---

## P1-29 — Bounce / complaint tests

| Field | Detail |
|---|---|
| **Current state** | Partial. Phase B suppression tenancy + SNS tests. |
| **Relevant files** | `shared/security-phase-b.test.ts`, `0030` |
| **Current auth model** | Suppressions per `user_id` (workspace). |
| **Required change** | Agency attribution cases in tests (A bounce ≠ B). |
| **Migration requirement** | None. |
| **Security risk** | Wrong-workspace suppression. |
| **Tests** | Extend existing. |
| **Acceptance criteria** | No foreign suppression write. |
| **Dependencies** | P0-13. |
| **Estimated complexity** | Low. |

---

## P1-30 — Inbound chaos tests

| Field | Detail |
|---|---|
| **Current state** | Partial. Phase B claim lifecycle tests. |
| **Relevant files** | `shared/security-phase-b.test.ts` |
| **Current auth model** | N/A. |
| **Required change** | Keep; do not expand inbound engine this wave. |
| **Migration requirement** | None. |
| **Security risk** | Residual silent-loss edges. |
| **Tests** | Existing suite remains in `check`. |
| **Acceptance criteria** | Known terminal states still asserted. |
| **Dependencies** | None. |
| **Estimated complexity** | Already present. |

---

## P1-31 — Attachment security

| Field | Detail |
|---|---|
| **Current state** | Partial. IDOR download + sanitizer. No MIME-spoof / SVG inline suite beyond HTML sanitizer. |
| **Relevant files** | harness attachment route, `sanitize-email-html.ts` |
| **Current auth model** | Message authz join. |
| **Required change** | Agency ungranted/removed attachment cases in harness. |
| **Migration requirement** | None. |
| **Security risk** | Foreign bytes. |
| **Tests** | Harness. |
| **Acceptance criteria** | 404, no bytes. |
| **Dependencies** | P0-13. |
| **Estimated complexity** | Low. |

---

## P1-32 — Remote image verification

| Field | Detail |
|---|---|
| **Current state** | Already implemented (next-security wave): default block + Load images; user-specific (not workspace-wide). |
| **Relevant files** | `shared/sanitize-email-html.ts`, `MessageReader.tsx` |
| **Current auth model** | Per-user UI toggle. |
| **Required change** | Document: image-load preference is **user-specific**, not mailbox/workspace. |
| **Migration requirement** | None. |
| **Security risk** | One member Load images must not enable for all. |
| **Tests** | Existing sanitizer tests. |
| **Acceptance criteria** | Default blocked; preference not workspace-global. |
| **Dependencies** | None. |
| **Estimated complexity** | Done. |

---

## P1-33 / P1-34 — Observability & alerts

| Field | Detail |
|---|---|
| **Current state** | Operator alerts post to existing workspace Slack/Discord `notify_channels` (member_removed, scheduled_denied). No PagerDuty. Production on-call still residual unless a channel is configured. |
| **Relevant files** | Worker logs, `docs/runbooks/*` (to add) |
| **Current auth model** | N/A. |
| **Required change** | Document required signals/alerts; emit audit/deny counters where cheap. Do not invent a metrics SaaS. |
| **Migration requirement** | None. |
| **Security risk** | Missing alerts = operational stop-ship. |
| **Tests** | Doc review. |
| **Acceptance criteria** | Runbooks + honest “alerts not wired to PagerDuty” residual. |
| **Dependencies** | Ops account. |
| **Estimated complexity** | Docs. |

---

## P1-35 / P1-36 — Backups / restore / rollback

| Field | Detail |
|---|---|
| **Current state** | Local export/restore tests + rollback rehearsal script. CF D1 account snapshots unchanged. **No remote staging restore evidence.** |
| **Relevant files** | To add `docs/backup-restore-runbook.md`, `docs/release-rollback-runbook.md` |
| **Current auth model** | Restore must not resurrect removed members from stale dumps without review. |
| **Required change** | Runbooks + local schema rehearsal. **No staging restore drill evidence in this environment.** |
| **Migration requirement** | Document `0033` rollback (additive = leave columns). |
| **Security risk** | Restore reintroduces removed access. |
| **Tests** | Doc + migrate local. |
| **Acceptance criteria** | Honest: restore drill not executed on staging. |
| **Dependencies** | Staging access. |
| **Estimated complexity** | Docs. |

---

## P1-37 — Rate limits / abuse

| Field | Detail |
|---|---|
| **Current state** | Seats + pending invites + **25 invite creates / workspace / hour**. Send/storage caps unchanged. |
| **Relevant files** | `worker/lib/billing.ts`, `createInvite` seat projection |
| **Current auth model** | Workspace quotas. |
| **Required change** | Keep; document. Invite already counts pending toward seats. |
| **Migration requirement** | None. |
| **Security risk** | Agency send volume vs shared SES. |
| **Tests** | Existing billing tests if any. |
| **Acceptance criteria** | Documented; no new invented numeric plan limits. |
| **Dependencies** | Product owner for numbers. |
| **Estimated complexity** | Low. |

---

## P1-38 — Cost guardrails

| Field | Detail |
|---|---|
| **Current state** | Plan caps exist. No dedicated cost doc. |
| **Relevant files** | `docs/production-cost-guardrails.md` |
| **Current auth model** | Server-side `assertWithinLimit`. |
| **Required change** | Document SES/D1/R2/Worker cost levers. |
| **Migration requirement** | None. |
| **Security risk** | Runaway cost. |
| **Tests** | N/A. |
| **Acceptance criteria** | Doc exists; numbers not changed. |
| **Dependencies** | None. |
| **Estimated complexity** | Low. |

---

## P1-39 — CI release gate

| Field | Detail |
|---|---|
| **Current state** | Partial. `npm run check` = tsc + existing security/IDOR/SEO tests. |
| **Relevant files** | `package.json` |
| **Current auth model** | N/A. |
| **Required change** | Done: agency suites + HTTP isolation + backup + operator alerts + rollback rehearsal in `check`. |
| **Migration requirement** | None. |
| **Security risk** | Deploy with failing security tests. |
| **Tests** | `npm run check` must include them. |
| **Acceptance criteria** | Check fails if agency suites fail. |
| **Dependencies** | All test files. |
| **Estimated complexity** | Low. |

---

## P2-40 — Client / domain transfer RFC

| Field | Detail |
|---|---|
| **Current state** | Design notes in agency RFC §7; no implementation RFC. |
| **Relevant files** | `docs/rfc-domain-client-transfer.md` |
| **Current auth model** | N/A. |
| **Required change** | Write RFC only. **Do not implement transfer.** |
| **Migration requirement** | None. |
| **Security risk** | Casual transfer = secret copy / split-brain SES. |
| **Tests** | N/A. |
| **Acceptance criteria** | RFC lists assets that move vs stay. |
| **Dependencies** | Stable membership (P0). |
| **Estimated complexity** | Docs. |

---

## P2-41 — Transfer implementation

| Field | Detail |
|---|---|
| **Current state** | Not implemented. **Deferred — requires RFC approval.** |
| **Relevant files** | — |
| **Current auth model** | — |
| **Required change** | None this wave. |
| **Migration requirement** | None. |
| **Security risk** | High if done casually. |
| **Tests** | N/A. |
| **Acceptance criteria** | Explicitly deferred. |
| **Dependencies** | P2-40 approval. |
| **Estimated complexity** | Out of scope. |

---

## P2-42 — Optional finer permissions

| Field | Detail |
|---|---|
| **Current state** | Mailbox role `admin`/`member` stored but send/read not distinguished. RFC proposed `read-only`. |
| **Relevant files** | `mailbox_members.role` |
| **Current auth model** | Binary access. |
| **Required change** | **Defer** enterprise/read-only unless needed. Domain grant permission_level stored as `send` default. |
| **Migration requirement** | Optional column already in new table. |
| **Security risk** | Marketing a role without teeth. |
| **Tests** | N/A. |
| **Acceptance criteria** | Not marketed as read-only. |
| **Dependencies** | Customer demand. |
| **Estimated complexity** | Deferred. |

---

## Explicit non-goals (this wave)

AI, calendar/booking expansion, advanced newsletters, white-label, SSO/SAML/SCIM, enterprise RBAC, domain-transfer marketplace, `workspaces` table rewrite.

---

## Stop-ship mapping

See spec §51. This wave **must not** claim production-ready unless all security/reliability/ops gates pass with evidence. Live Gmail/Outlook, staging restore, and wired production alerts are expected residuals unless separately executed.

---

## Implementation order (this wave)

1. Plan + matrix + schema plan docs  
2. `0033` + `shared/agency-authz.ts` + `team.ts`  
3. Route fixes (keys, webhooks, contacts, domains, delivery, presence, flush)  
4. Agency HTTP fixtures + test suites + `npm run check`  
5. Team/audit/clients/usage UI  
6. Runbooks + results + status board update  
