# Next Security / Core Wave — Results

**Date:** 2026-09-09  
**Plan:** `docs/next-security-core-plan.md`  
**Brief:** `FLAP_NEXT_IMPLEMENTATION_SECURITY_AND_CORE.md`

---

## Completed

### P0
1. **HTTP tenant-isolation / IDOR harness** — `shared/http-tenant-isolation-harness.ts`, `shared/http-tenant-isolation.test.ts`, wired into `npm run check`; doc `docs/audit-http-tenant-isolation.md`.
2. **HTML sanitizer hostile fixtures** — expanded in `shared/security-authz.test.ts`; still **isomorphic-dompurify** only; CSS `javascript:` urls scrubbed post-DOMPurify.
3. **Remote image privacy** — default block + MessageReader **Load images**; CSP `img-src` tightened until opt-in; `sanitizeEmailHtml({ allowRemoteImages })`.
4. **Thread presence workspace scoping** — migration `0032_presence_workspace.sql`; ownership check + `workspace_id` filter in `collaboration-extras.ts`; covered in IDOR harness.
5. **Migrations 0030 / 0031 validation** — local apply confirmed (0030 already present; 0031 + 0032 applied). Local duplicate audit: no `lower(name)` collisions; zero empty-`user_id` suppressions. Remote deploy steps documented below (not forced).
6. **Inbound durability tests** — claim lifecycle / terminal outcomes expanded in `shared/security-phase-b.test.ts`.
7. **Outbound send policy** — `shared/outbound-send-policy.ts` + `dispatchStoredMessage`; newsletter blasts gated on domain readiness.
8. **SNS / webhook review** — trust model `docs/sns-webhook-trust-model.md`; allowlist/envelope/skew tests expanded.

### P1 (shipped this wave)
9. **Deliverability diagnostics** — Delivery tab shows Outbound/Inbound ready separately; human-readable event statuses.
10. **DNS onboarding** — “Connect your domain”; Why + Common mistake columns on DNS table.
11. **Send/receive verification UX** — Outbound ready ✓ / Inbound ready ✓ called out; domain not “fully healthy” unless both.
12. **Migration workflow** — `/migrate` help CTA + `migration_started` / `migration_help_requested` analytics (no IMAP engine).
13. **Activation analytics** — allowlist + emit aliases: `domain_verified`, `first_outbound_sent`, `first_inbound_received`; migration events.
14. **Inbox identity** — “Sent to:” in reader; `[domain]` list chip (not color alone).
15. **Sender-identity edge tests** — alias / multi-To / removed alias / mailbox_id precedence in phase-b tests.
16. **Abuse/quota review** — documented below (existing plan limits + send room + suppressions; no new hard thresholds invented).
17. **Backup/deletion review** — Security page already matches export/mbox/cancel window; residual notes below.
18. **Security headers** — already present on Worker (CSP/HSTS/X-CTO/Referrer/frame); no blind changes.
19. **API token/webhook IDOR** — covered in HTTP harness (list/delete cross-tenant denied).

---

## Deferred

| Item | Why |
|------|-----|
| **P2 shared inbox (Owner+Member mailbox grants UI expansion)** | P0/P1 solid; existing `mailbox_members` ACL already enforced on mail paths. Broad agency RBAC / VA portals intentionally out of scope. |
| Full Wrangler `unstable_dev` + live Clerk JWT suite | Harness uses Hono `app.request` + in-memory D1 with production authz SQL; Clerk live suite deferred for CI cost. |
| Amazon CA pin beyond SNS host allowlist | Documented as intentional non-goal. |
| IMAP / Takeout automated import | Explicitly out of scope; migrate page remains assisted. |
| Per-domain bounce auto-suspend thresholds | Review only; no new automatic suspension policy shipped without product sign-off. |
| Contacts/keys/webhooks → `workspaceId` for team members | Solo-owner safe (`user.id === workspace`); team-member quirk tracked for agency wave. |

---

## Security issues found

1. Presence not workspace-scoped → **fixed** (0032 + route).
2. Remote images auto-loaded → **fixed** (default block + UX).
3. Newsletter sends could bypass domain readiness → **fixed**.
4. DOMPurify left `javascript:` in CSS `url()` → **fixed** (post-scrub).

No cross-tenant message/attachment content leak found against mirrored authz SQL for solo owners.

---

## Reliability issues found

- Local migrations 0031/0032 apply cleanly; no domain duplicates in local D1.
- Inbound claim lifecycle already fixed in Phase B; tests expanded to lock behavior.

---

## Migrations changed

| Migration | Action |
|-----------|--------|
| `0030_suppressions_tenancy_inbound.sql` | Validated (already applied locally) |
| `0031_global_unique_domains.sql` | Applied locally this wave |
| `0032_presence_workspace.sql` | **New** — `workspace_id` on `thread_presence` |

---

## Tests added / updated

- `shared/http-tenant-isolation.test.ts` (**new**, in `npm run check`)
- `shared/security-authz.test.ts` — hostile fixtures, remote-image policy, outbound policy
- `shared/security-phase-b.test.ts` — SNS edges, inbound outcomes, reply-from matrix
- `shared/outbound-send-policy.ts` — pure policy helper

**Command run:** `npm run check` (pass)  
Also: `npm run db:migrate:local`; local D1 audits for domain duplicates / empty suppression owners.

---

## Routes covered by IDOR harness

Messages, threads, attachments, drafts, undo-send, open-track, RSVP, mailboxes, domains, suppressions, delivery events, quarantine, contacts, API keys, webhooks, newsletters, presence, send-as foreign mailbox/from.  
See `docs/audit-http-tenant-isolation.md`.

---

## Remaining risks

- Harness mirrors route SQL; full Worker+Clerk boot still residual.
- Team-member contacts/keys/webhooks scoped to session user id.
- SES account-level suppressions can still block sends Flap workspace lists as “not suppressed” — product rule unchanged; document honesty required.
- Production remote migrate of 0031/0032 not executed in this wave.

---

## Abuse / quota review (P1 §17)

Existing controls: plan limits (`assertWithinLimit`), outbound send room (`assertSendRoom`), storage room, workspace-scoped suppressions, domain suspension/FAILED state, verified sending readiness, newsletter monthly caps + hard blast cap (500).  
**Gap (deferred):** automated bounce/complaint rate → account suspend; per-domain burst limits distinct from plan sends. Do not invent reputation scores.

---

## Backup / deletion review (P1 §18)

| Concern | Actual behavior |
|---------|-----------------|
| D1 | Cloudflare D1 managed backups / point-in-time per CF account settings — not a customer self-serve restore UI |
| R2 attachments | Stored under ATTACHMENTS; deleted with message cascades where FK applies; orphan risk if manual DB edits |
| Trash | Folder move; permanent delete from trash |
| Export | Settings JSON + .mbox |
| Account cancel | Paid export window (Security page) |
| Domain removal | Deletes domain-scoped mailboxes/mail with provider cleanup paths |

Security page copy remains accurate enough; no fabricated “enterprise backup SLA”.

---

## Production deployment steps

1. Review this results doc + `docs/audit-http-tenant-isolation.md` + `docs/sns-webhook-trust-model.md`.
2. Run `npm run check` on the release commit.
3. **Staging:** `wrangler d1 migrations apply flap --remote` against staging DB (after duplicate audit):
   ```sql
   SELECT lower(name), COUNT(*) FROM domains GROUP BY lower(name) HAVING COUNT(*) > 1;
   SELECT COUNT(*) FROM mail_suppressions WHERE user_id = '' OR user_id IS NULL;
   ```
4. Staging smoke: two accounts, cross-tenant IDOR spot-check; send/receive; reply-from; Load images; presence on Team plan.
5. **Production:** apply migrations `0030` (if pending), `0031`, `0032` only after staging OK — do **not** skip staging.
6. Deploy Worker + assets; post-deploy smoke (login, open mail, send, inbound webhook health).

## Rollback plan

- Code rollback: redeploy previous Worker/assets artifact.
- Migrations: SQLite/D1 has no automatic down. `0032` column is additive (`workspace_id` default `''`) — safe to leave. `0031` unique index — drop index only if emergency and after resolving ownership; do not reintroduce duplicates casually. `0030` suppressions `user_id` is required for tenancy — do not roll back without a restore plan.

---

## Flap vs SES suppressions (product honesty)

- **Flap workspace suppressions:** per `user_id`; unattributed bounce/complaint does **not** create a row or block Flap sends.
- **SES/account-level:** AWS may still reject recipients Flap does not list. UI must not claim “sendable everywhere” solely because Flap’s list is empty.
