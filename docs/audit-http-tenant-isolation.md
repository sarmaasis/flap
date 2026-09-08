# HTTP Tenant Isolation / IDOR Audit

**Date:** 2026-09-09  
**Harness:** `shared/http-tenant-isolation-harness.ts` + `shared/http-tenant-isolation.test.ts`  
**Runner:** `npx tsx shared/http-tenant-isolation.test.ts` (also wired into `npm run check`)

## Approach

Two complete solo tenants (User A / User B) are seeded into an in-memory D1 shim (`node:sqlite`). A Hono app mirrors production authz SQL for critical routes (`user_id = workspaceId` + `mailboxAccessClause` patterns from `shared/security-guards.ts`). Requests authenticate via test-only header `X-Flap-Test-User-Id` (never enabled on the production Worker).

This is an HTTP/API-layer IDOR harness: real `app.request()` status/body checks, not route-name unit stubs alone.

## Endpoints covered

| Surface | Methods | Expected cross-tenant |
|---------|---------|------------------------|
| Message | GET, DELETE, POST move | 404 |
| Thread | GET | 404 |
| Attachment download | GET | 404 (no bytes) |
| Draft / scheduled | GET / undo-send | 404 |
| Open track | POST | 404 |
| Calendar RSVP | POST | 404 |
| Mailbox | GET | 404 |
| Domain | GET | 404 |
| Suppressions | GET list scoped; DELETE foreign | list A-only; DELETE 404 |
| Delivery events | GET | A-only rows |
| Quarantine | GET | no B items |
| Contacts | GET / DELETE | no B; DELETE 404 |
| API keys | GET / DELETE | no B; DELETE 404 |
| Webhooks | GET / DELETE | no B; DELETE 404 |
| Newsletters | GET | 404 |
| Presence | POST | 404 (workspace-scoped) |
| Send-as foreign mailbox/from | POST check | 404 / 403 |

## Failures found during this wave

| Issue | Severity | Fix |
|-------|----------|-----|
| Thread presence keyed only by `thread_key` (no workspace) | P0 | Migration `0032_presence_workspace.sql` + ownership check + workspace filter in `collaboration-extras.ts` |
| Remote images loaded on open (tracking) | P0 | Default block in sanitizer + MessageReader “Load images” + tighter iframe CSP |
| Newsletter blast could send without domain readiness | P0 | `evaluateOutboundDomainPolicy` gate in `newsletters.ts` |

No cross-tenant message/attachment content leak was observed against the mirrored authz SQL for solo owners (matches Phase B route contracts).

## Residual gaps

1. Harness mirrors production SQL; it does not boot the full Worker with Clerk/ASSETS/Durable Objects. Drift risk if a route stops using `messageAuthzWhere` / workspace binds — keep contracts + harness in sync.
2. Contacts / API keys / webhooks are scoped to session `user.id` (solo-owner safe; team member acting in another workspace is a known model quirk — see agency RFC).
3. Amazon CA pinning beyond SNS host allowlist remains deferred (intentional).
4. Full live Wrangler `unstable_dev` + real Clerk JWT suite not added (CI cost); local D1 HTTP harness is the ship gate for B-R4.

## Acceptance

- Cross-tenant reads return 403/404 without secret body content.
- Mutations do not alter the other tenant’s rows.
- Attachment download does not return foreign bytes.
- Sending via another tenant’s mailbox/address is denied.
