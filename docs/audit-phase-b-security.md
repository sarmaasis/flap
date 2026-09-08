# Phase B — Security / reliability audit

**Scope:** Cross-tenant authz, sender identity, domain verification, inbound retry, webhooks, HTML XSS, secrets, suppressions, attachment auth.  
**Source:** `FLAP_CURSOR_PRODUCT_AUDIT.md` §§4, 24–26, 35 P0 security, §36 Phase B.  
**Date:** 2026-09-09 (updated: draft/RSVP ACL, global domains, native SNS verify)

---

## Summary

Critical cross-tenant and webhook holes were found and fixed. Core `/api/mail/:id` read/mutate/attachment paths were already solid (`requireUser` + workspace + mailbox ACL). Suppressions are workspace-scoped (`migrations/0030_suppressions_tenancy_inbound.sql`). Domain names are globally unique (`migrations/0031_global_unique_domains.sql`). Draft update and calendar RSVP enforce mailbox ACL. SES event webhooks verify native SNS signatures (WebCrypto) in addition to Flap HMAC when the body is an SNS envelope.

---

## Findings

### 1. Cross-tenant scheduled flush

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | `flushScheduled` selected all due `folder='scheduled'` rows with no `user_id` filter; called from `GET /api/counts` and `POST /api/mail/flush-outbox` |
| **Relevant files** | `worker/lib/workspace.ts` |
| **Risk** | Any signed-in user could force-deliver other tenants’ undo-send / scheduled mail and observe foreign message ids in `failed` |
| **Recommendation** | User routes must pass `userId`; only cron may flush globally |
| **Fixed** | `flushScheduled(env, { userId })`; counts + flush-outbox scoped to `ctx.workspaceId`; cron unchanged |

### 2. SES events webhook unsigned Notifications + SubscribeURL SSRF

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | `/api/inbound/ses/events` accepted `Type: "Notification"` even when HMAC invalid; `SubscriptionConfirmation` fetched `SubscribeURL` before auth |
| **Relevant files** | `worker/lib/inbound-webhook.ts`, `shared/security-guards.ts` |
| **Risk** | Unauthenticated suppression poison (platform-wide); open SSRF via forged SubscribeURL |
| **Recommendation** | Require valid HMAC (or explicit `SES_INBOUND_ALLOW_UNSIGNED`); allowlist SNS hosts only |
| **Fixed** | Signature required unless allow-unsigned; SubscribeURL host must match `sns.*.amazonaws.com` over HTTPS; verification runs before confirmation fetch |

### 3. Inbound idempotency false-success (message loss)

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Claim inserted as `processing` → D1 failure → claim stuck → provider retry returned `duplicate` + HTTP 200 → mail never stored |
| **Relevant files** | `worker/email.ts`, `worker/lib/inbound-webhook.ts`, `shared/security-guards.ts` |
| **Risk** | Silent inbound disappearance after SMTP/Lambda accept |
| **Recommendation** | Never ACK duplicate unless outcome is terminal `stored`/`duplicate`; reclaim stale processing; return 503 for in-progress/store failure |
| **Fixed** | Stale reclaim (5m); `in_progress` / `store_failed` → 503; mark `stored` immediately after message INSERT; attachment failures no longer fail ingest |

### 4. Domain sending authority without verification (API / scheduled)

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | UI compose checked `domainIsSendingReady` + suppressions; `/api/v1/send` and `flushScheduled` → `dispatchStoredMessage` did not; domain lookup by name alone |
| **Relevant files** | `worker/lib/workspace.ts`, `shared/ses-dns.ts` |
| **Risk** | Send from unverified domain via API/schedule; cross-tenant domain-name collision picking wrong provider row |
| **Recommendation** | Gate all outbound paths in `dispatchStoredMessage`; scope domain by `user_id` |
| **Fixed** | Readiness + suppression checks + owner-scoped domain lookup inside `dispatchStoredMessage` |

### 5. Soft bounce permanent suppression

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Transient SES bounces wrote `expires_at: NULL` |
| **Relevant files** | `worker/lib/inbound-webhook.ts`, `shared/security-guards.ts` |
| **Risk** | Transient failures permanently block recipients |
| **Fixed** | Soft bounces expire after 72h |

### 6. Label delete cross-tenant `message_labels` wipe

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | `DELETE FROM message_labels WHERE label_id = ?` ran before ownership check on `labels` |
| **Relevant files** | `worker/lib/product-features.ts` |
| **Risk** | Integrity IDOR if label id leaked/guessed |
| **Fixed** | Delete owned label first; then wipe joins |

### 7. Reply-from identity fallback to external address

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | `replyFromAddress` returned raw `to_addr` when mailbox missing from client list → Compose replaced with first sendable mailbox (wrong domain) |
| **Relevant files** | `src/pages/Inbox.tsx`, `shared/security-guards.ts` |
| **Risk** | Reply from Product B to Product A’s customer |
| **Fixed** | `resolveReplyFromAddress` only returns owned mailbox addresses |

### 8. Team mailbox ACL gaps (undo-send, open-track, quarantine)

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Routes checked `user_id = workspaceId` but not `mailboxAccessClause` |
| **Relevant files** | `worker/lib/product-features.ts`, `worker/lib/studio-channels.ts` |
| **Risk** | Restricted team members mutate/list messages outside their mailbox grants |
| **Fixed** | Added `mailboxAccessClause` |

### 9. Domain control routes missing `canManageSettings`

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Park / reputation / badge / retention / pre-mx / auth-upgrades only checked workspace ownership |
| **Relevant files** | `worker/lib/domain-controls.ts` |
| **Risk** | Intra-workspace privilege escalation for members |
| **Fixed** | Require `canManageSettings` |

### 10. SES HMAC replay without timestamp

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Empty `X-Flap-Timestamp` skipped freshness check when secret set |
| **Relevant files** | `worker/lib/mail-provider.ts` |
| **Risk** | Unlimited replay of captured signed bodies |
| **Fixed** | Timestamp required + 15-minute skew when secret configured |

### 11. MessageReader HTML XSS

| Field | Detail |
|---|---|
| **Status** | FIXED (defense in depth) |
| **Evidence** | Empty `sandbox=""` blocks scripts/same-origin; plain text React-escaped; previously no HTML strip |
| **Relevant files** | `src/components/MessageReader.tsx`, `shared/sanitize-email-html.ts` |
| **Risk** | Stored XSS into Flap origin if sandbox ever loosened |
| **Fixed** | `sanitizeEmailHtml` wraps **isomorphic-dompurify** (DOMPurify) with email-safe forbid tags/attrs; CSP meta in `srcDoc`; `referrerPolicy="no-referrer"`; iframe `sandbox` kept |

### 12. Attachment download auth

| Field | Detail |
|---|---|
| **Status** | ALREADY OK |
| **Evidence** | `GET /api/mail/:id/attachments/:attId` uses `requireUser` + JOIN messages + mailbox ACL; client uses Bearer via `authHeaders()`, not bare `<a href>` |
| **Relevant files** | `worker/index.ts`, `src/lib/api.ts`, `src/components/MessageReader.tsx` |
| **Risk** | None material for unauthenticated download |

### 13. Browser secrets

| Field | Detail |
|---|---|
| **Status** | ALREADY OK |
| **Evidence** | Only `VITE_CLERK_PUBLISHABLE_KEY` / `/api/public-config` publishable fields; AWS/SES/webhook secrets Worker-only |
| **Relevant files** | `src/lib/clerk.tsx`, `worker/index.ts`, `.dev.vars.example` |

### 14. Suppression list tenancy

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Table was global by email; list APIs previously joined heuristically |
| **Relevant files** | `migrations/0030_suppressions_tenancy_inbound.sql`, `worker/lib/suppressions.ts`, `worker/lib/inbound-webhook.ts`, `worker/lib/product-features.ts` |
| **Risk** | Cross-tenant suppression poison / leak |
| **Fixed** | `user_id` column + unique `(user_id, email)`; writers require attributable owner; send checks are workspace-scoped; unattributed rows never block sends |

### 15. Core mail message IDOR

| Field | Detail |
|---|---|
| **Status** | ALREADY OK |
| **Evidence** | List/get/thread/move/flags/delete/attachments use workspace + `mailboxAccessClause` |
| **Relevant files** | `worker/index.ts`, `worker/lib/team.ts`, `shared/security-guards.ts` (`messageAuthzWhere`) |

### 16. Draft update / calendar RSVP mailbox ACL

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | `POST /api/mail/send` with `body.id` selected drafts by `user_id` only; `POST /api/calendar/rsvp` loaded messages by `user_id` only — restricted members could update/RSVP outside mailbox grants |
| **Relevant files** | `worker/index.ts`, `worker/lib/studio-channels.ts` |
| **Risk** | Intra-workspace mailbox IDOR on draft autosave/send and calendar RSVP |
| **Fixed** | Both paths use `mailboxAccessClause` on SELECT (and draft UPDATE) |

### 17. Global unique domain names

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Schema was `UNIQUE (user_id, name)` — two workspaces could claim the same DNS name |
| **Relevant files** | `migrations/0031_global_unique_domains.sql`, `worker/index.ts` (`POST /api/domains`) |
| **Risk** | Ambiguous inbound routing / send authority collision |
| **Fixed** | Unique index on `lower(name)`; pre-insert claim check returns 409 before SES provision |

### 18. Native AWS SNS signature verification

| Field | Detail |
|---|---|
| **Status** | FIXED |
| **Evidence** | Events path relied on Flap HMAC (or allow-unsigned); direct SNS → HTTPS had no SigningCertURL/Signature check |
| **Relevant files** | `shared/security-guards.ts`, `worker/lib/sns-verify.ts`, `worker/lib/inbound-webhook.ts` |
| **Risk** | Forged SNS envelopes if HMAC secret missing / allow-unsigned enabled |
| **Fixed** | When body is an SNS envelope: allowlist `SigningCertURL`, fetch PEM, extract SPKI (no new npm deps), verify RSA-PKCS1 v1/v2 via WebCrypto — **in addition to** Flap HMAC. Cert PEM cached ~1h in isolate memory. |

---

## What was fixed (this phase)

1. Workspace-scoped scheduled flush on user routes  
2. SES events signature enforcement + SNS SubscribeURL allowlist  
3. Inbound claim lifecycle (stale reclaim, 503 retry, early `stored`)  
4. Sending readiness + suppressions in all `dispatchStoredMessage` paths  
5. Owner-scoped domain lookup on send  
6. Soft-bounce 72h expiry  
7. Label delete ownership order  
8. Deterministic reply-from helper  
9. Mailbox ACL on undo-send / open-track / quarantine  
10. `canManageSettings` on domain control mutations  
11. SES timestamp required for HMAC replay protection  
12. MessageReader CSP + no-referrer + `sanitizeEmailHtml`  
13. Workspace-scoped suppressions (`0030` migration + send/list writers)  
14. Draft update + calendar RSVP mailbox ACL  
15. Global unique domain names (`0031` migration + claim check)  
16. Native SNS SigningCertURL + Signature verify (WebCrypto)  

---

## Remaining work (non-blocking / P1)

| Item | Why deferred |
|---|---|
| Full X.509 chain / Amazon CA trust pin beyond host allowlist | Host allowlist + RSA verify is the AWS-recommended practical path for Workers; pinning Amazon’s intermediate would need a cert bundle update process |
| Thread presence workspace scoping | Medium; collaboration feature |
| Remote-image / tracking UX policy | Sanitizer+sandbox+CSP cover XSS; product policy later |
| Integration tests against D1 miniflare | Unit tests cover pure guards + SNS crypto fixture; full route tests need harness |

---

## Tests added

| File | Covers |
|---|---|
| `shared/security-guards.ts` | Pure helpers (reply-from, SNS URL/cert, canonical string, SPKI extract, claim freshness, mailbox ACL SQL) |
| `shared/security-phase-b.test.ts` | Reply-from, sending readiness, SNS URL/cert allowlist, soft-bounce TTL, inbound claim, **native SNS SignatureVersion 2 verify + tamper reject** |
| `shared/security-authz.test.ts` | Mailbox ACL contract, draft/RSVP authz WHERE, global domain uniqueness rule, reply-from, readiness, HTML sanitizer, suppression tenancy |
| `shared/sanitize-email-html.ts` | XSS strip helper — **DOMPurify** via `isomorphic-dompurify` (not hand-rolled) |

Wired into `npm run check`.

### Commands run

```bash
npx tsx shared/security-phase-b.test.ts
npx tsx shared/security-authz.test.ts
npx tsc --noEmit -p tsconfig.app.json
npx tsc --noEmit -p tsconfig.worker.json
# (plus existing calculator / ses-dns / seo tests via npm run check)
```

---

## Files changed (Phase B security focus)

- `docs/audit-phase-b-security.md` (this file)
- `shared/security-guards.ts`
- `shared/security-phase-b.test.ts`
- `shared/security-authz.test.ts`
- `shared/sanitize-email-html.ts`
- `migrations/0030_suppressions_tenancy_inbound.sql`
- `migrations/0031_global_unique_domains.sql`
- `worker/email.ts`
- `worker/lib/inbound-webhook.ts`
- `worker/lib/sns-verify.ts`
- `worker/lib/mail-provider.ts`
- `worker/lib/workspace.ts`
- `worker/lib/suppressions.ts`
- `worker/lib/product-features.ts`
- `worker/lib/domain-controls.ts`
- `worker/lib/studio-channels.ts`
- `worker/index.ts`
- `src/pages/Inbox.tsx`
- `src/components/MessageReader.tsx`
- `package.json`
