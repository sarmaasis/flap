# Next Security / Core Wave — Implementation Plan

**Source brief:** `FLAP_NEXT_IMPLEMENTATION_SECURITY_AND_CORE.md`  
**Repo:** `/Users/sarmaasis/Work/projects/flap`  
**Date:** 2026-09-09  
**Rule:** Do not expand AI, calendar, newsletter, white-label, SSO, enterprise RBAC, or domain-transfer in this wave.

---

## §2 — P0 HTTP tenant-isolation / IDOR integration harness

| Field | Detail |
|-------|--------|
| **Status** | Not started (B-R4 deferred from Phase B) |
| **Current implementation** | Unit contracts in `shared/security-authz.test.ts` / `shared/security-guards.ts`; route SQL uses `user_id = workspaceId` + `mailboxAccessClause`. No live HTTP/D1 harness. |
| **Evidence** | `docs/audit-phase-b-security.md` B-R4; `worker/index.ts` mail routes; `worker/lib/team.ts` |
| **Risk** | Cross-tenant email access is a critical security failure; unit contracts can drift from real routes. |
| **Implementation needed** | Two-tenant seed + HTTP harness (`app.request` / D1 shim) covering messages, threads, attachments, drafts, mailboxes, domains, suppressions, delivery events, quarantine, undo-send, open-track, calendar RSVP, contacts, newsletters, API tokens, webhooks. Wire into `npm run check`. Document in `docs/audit-http-tenant-isolation.md`. |
| **Tests needed** | `shared/http-tenant-isolation.test.ts` — User A cannot read/mutate User B resources (403/404, no content leak, no mutation). |
| **Acceptance** | Cross-tenant access never returns resource content; never mutates; never downloads foreign attachments; never sends from foreign mailbox/domain. |

---

## §3 — P0 HTML email sanitization

| Field | Detail |
|-------|--------|
| **Status** | Partially done — isomorphic-dompurify in place |
| **Current implementation** | `shared/sanitize-email-html.ts` + MessageReader sandbox/CSP/`referrerPolicy` |
| **Evidence** | `shared/sanitize-email-html.ts`; `src/components/MessageReader.tsx`; some vectors in `shared/security-authz.test.ts` |
| **Risk** | Residual XSS if fixtures incomplete or sandbox loosened later |
| **Implementation needed** | Expand hostile fixtures (script, onerror, SVG, javascript:, iframe/srcdoc, object/embed, form, meta refresh, data:, CSS urls, namespace tricks). Do **not** reintroduce a custom parser. |
| **Tests needed** | Hostile fixture suite asserting no executable remnants |
| **Acceptance** | Malicious fixtures cannot execute JS, navigate parent, or access auth state |

---

## §4 — P0 Remote image / tracking privacy

| Field | Detail |
|-------|--------|
| **Status** | Deferred — remote images allowed by CSP |
| **Current implementation** | MessageReader CSP `img-src data: https: http:` — opening mail can fetch third-party URLs |
| **Evidence** | `src/components/MessageReader.tsx` `emailSrcDoc` |
| **Risk** | Tracking pixels fire on open without consent |
| **Implementation needed** | Default block remote images; **Load images** UX; strip/rewrite remote `<img>` / CSS backgrounds until user opts in; keep sandbox+CSP defense in depth |
| **Tests needed** | Unit: blocked HTML has no remote http(s) img/src/url; UI state toggles allow path |
| **Acceptance** | Opening email without interaction must not make arbitrary third-party remote image requests |

---

## §5 — P0 Thread presence / realtime workspace scoping

| Field | Detail |
|-------|--------|
| **Status** | Partial — InboxHub DO is workspace-scoped; presence table is not |
| **Current implementation** | `GET /api/events/ws` → DO `idFromName(workspaceId)`; `POST /api/presence/:threadKey` keys only `thread_key` + `user_id` |
| **Evidence** | `worker/inbox-hub.ts`; `worker/lib/collaboration-extras.ts`; `migrations/0019_collaboration.sql` |
| **Risk** | Guessable thread keys leak viewers across workspaces |
| **Implementation needed** | Scope presence by `workspace_id`; deny subscribe when thread not in workspace; test User A → Thread B denied |
| **Tests needed** | Presence IDOR case in HTTP harness + unit |
| **Acceptance** | No cross-workspace presence inference |

---

## §6 — P0 Validate migrations 0030 / 0031

| Field | Detail |
|-------|--------|
| **Status** | Migrations authored; need local apply/audit + remote deploy notes |
| **Current implementation** | `migrations/0030_suppressions_tenancy_inbound.sql`, `migrations/0031_global_unique_domains.sql` |
| **Evidence** | Migration files; Phase B docs |
| **Risk** | Unique domain index fails on duplicates; suppressions mis-attributed; prod apply without staging |
| **Implementation needed** | Local migrate + duplicate audit queries; document Flap vs SES suppression; staging/prod steps (no forced remote prod migrate) |
| **Tests needed** | Migration apply succeeds locally; uniqueness / tenancy assertions in harness |
| **Acceptance** | Staging-ready validation documented; local apply clean |

---

## §7 — P0 Inbound durability / message-loss prevention

| Field | Detail |
|-------|--------|
| **Status** | Partially fixed in Phase B (claim lifecycle, 503, early stored) |
| **Current implementation** | `inbound_ingest_log`, stale reclaim, terminal duplicate rules |
| **Evidence** | `worker/email.ts`, `worker/lib/inbound-webhook.ts`, `shared/security-guards.ts` |
| **Risk** | Silent loss under edge failures still possible if untested |
| **Implementation needed** | Expand lifecycle tests for fetch/MIME/mailbox/DB/crash/duplicate/OOO/oversized/removed-mailbox scenarios; ensure known terminal states |
| **Tests needed** | Expand `shared/security-phase-b.test.ts` / new inbound durability tests |
| **Acceptance** | No silent “SES accepted, Flap lost forever”; retries idempotent |

---

## §8 — P0 Outbound sending safety

| Field | Detail |
|-------|--------|
| **Status** | Mostly centralized in `dispatchStoredMessage` |
| **Current implementation** | Readiness, owner-scoped domain, suppressions, suspension inside `dispatchStoredMessage`; compose UI also checks readiness |
| **Evidence** | `worker/lib/workspace.ts` `dispatchStoredMessage`; callers: send, flushScheduled, `/api/v1/send` |
| **Risk** | Drift if new send paths bypass; policy checks scattered |
| **Implementation needed** | Extract explicit `assertOutboundSendPolicy` (or equivalent) used by all dispatch paths; audit newsletter/automation for bypass |
| **Tests needed** | Policy unit tests + harness send-as-foreign-domain denial |
| **Acceptance** | Every outbound path applies same authz/readiness/suppression/quota gates |

---

## §9 — P0 SNS / webhook verification review

| Field | Detail |
|-------|--------|
| **Status** | Implemented (HMAC + native SNS verify); needs review doc + test expansion |
| **Current implementation** | `worker/lib/sns-verify.ts`, Flap HMAC timestamp, SubscribeURL allowlist |
| **Evidence** | `shared/security-phase-b.test.ts`, `docs/audit-phase-b-security.md` |
| **Risk** | Replay, forged cert URL, unknown event types |
| **Implementation needed** | Document trust model; expand tests (HTTPS-only, hosts, skew, unknown types, SubscribeURL) |
| **Tests needed** | Additional SNS/HMAC fixtures |
| **Acceptance** | Trust model documented; verification tests expanded |

---

## §10 — P1 Deliverability diagnostics

| Field | Detail |
|-------|--------|
| **Status** | Partial — Delivery tab + events API exist |
| **Current implementation** | Settings Delivery; `/api/delivery-events`; domain `last_inbound_*` |
| **Evidence** | `src/pages/settings/SettingsApp.tsx`; `worker/lib/product-features.ts` |
| **Risk** | Founders cannot debug bounce/inbound failures |
| **Implementation needed** | Clearer per-message timeline labels + per-domain health (MX/SPF/DKIM/DMARC guidance, last inbound/outbound, bounce warnings). No invented reputation scores. |
| **Tests needed** | Light API shape / UI copy checks where practical |
| **Acceptance** | Users can see queued→delivered/bounced timeline and domain health signals |

---

## §11 — P1 Domain onboarding reliability

| Field | Detail |
|-------|--------|
| **Status** | Existing DNS setup UI |
| **Current implementation** | Domain settings with records; readiness flags |
| **Evidence** | Settings domain flows; `shared/ses-dns.ts` |
| **Risk** | MX/SPF/DKIM mistakes block activation |
| **Implementation needed** | Per-record Type/Name/Value/Status/Copy/Why/Common mistake; “Connect your domain” language |
| **Tests needed** | Copy/structure smoke where practical |
| **Acceptance** | Founders can self-serve common DNS mistakes |

---

## §12 — P1 Real send/receive verification

| Field | Detail |
|-------|--------|
| **Status** | Partial readiness flags |
| **Current implementation** | `sending_ready_at` / `receiving_ready_at` separately |
| **Evidence** | Domain readiness helpers |
| **Risk** | “Healthy” claimed when only one direction works |
| **Implementation needed** | Guided test: send from Flap + receive external; show Outbound ready / Inbound ready separately |
| **Tests needed** | Readiness display logic tests |
| **Acceptance** | Domain not fully healthy unless both directions ready |

---

## §13 — P1 Migration workflow polish

| Field | Detail |
|-------|--------|
| **Status** | `/migrate` page exists |
| **Current implementation** | Narrative + export; no IMAP engine |
| **Evidence** | `src/pages/MigratePage.tsx`; analytics `migration_page_view` |
| **Risk** | Overbuilding IMAP before demand |
| **Implementation needed** | Checklist, rollback notes, founder-assisted CTA; track `migration_started` / `migration_completed` / `migration_help_requested` |
| **Tests needed** | Analytics allowlist |
| **Acceptance** | Practical migration path without IMAP engine |

---

## §14 — P1 Activation analytics

| Field | Detail |
|-------|--------|
| **Status** | Partial funnel events exist |
| **Current implementation** | `domain_added`, `second_domain_added`, `first_email_*`, `dns_verified`, etc. |
| **Evidence** | `worker/lib/activation.ts`, `worker/lib/analytics.ts` |
| **Risk** | Funnel incomplete / renamed inconsistently |
| **Implementation needed** | Ensure signup_completed, domain_add_started, domain_verified, first_outbound_sent, first_inbound_received, second_domain_added; retention by domain count buckets |
| **Tests needed** | Allowlist + emit path assertions |
| **Acceptance** | Funnel measurable end-to-end |

---

## §15 — P1 Inbox identity clarity

| Field | Detail |
|-------|--------|
| **Status** | Partial — domain color/name props exist |
| **Current implementation** | MessageReader gets `domainName`; list rows use from/to |
| **Evidence** | `src/pages/Inbox.tsx`, `MessageReader.tsx` |
| **Risk** | Wrong-product reply confusion |
| **Implementation needed** | Explicit “Sent to:” / `[domain]` list prefix / reply From confirmation — not color alone |
| **Tests needed** | N/A or light render assertions |
| **Acceptance** | Receiving identity explicit in list, reader, reply |

---

## §16 — P1 Sender identity edge cases

| Field | Detail |
|-------|--------|
| **Status** | Core `resolveReplyFromAddress` fixed |
| **Current implementation** | Owned-mailbox-only reply-from |
| **Evidence** | `shared/security-guards.ts`, authz tests |
| **Risk** | Alias/CC/forward/draft override edge cases |
| **Implementation needed** | Expand deterministic reply-from tests for alias, multi-To, CC, reply-all, forward, rename, removed alias, manual override non-persistence, scheduled/draft |
| **Tests needed** | Expanded unit matrix |
| **Acceptance** | No silent wrong-domain From |

---

## §17 — P1 Abuse and quota controls

| Field | Detail |
|-------|--------|
| **Status** | Plan limits + send room exist |
| **Current implementation** | `assertWithinLimit`, `assertSendRoom`, bounce suppressions |
| **Evidence** | `worker/lib/billing.ts` |
| **Risk** | One abusive tenant damages shared SES reputation |
| **Implementation needed** | Audit/document quotas, burst, API/newsletter limits, bounce/complaint thresholds, suspension; tighten gaps if found |
| **Tests needed** | Document + regression where code changes |
| **Acceptance** | Review documented; material gaps fixed |

---

## §18 — P1 Backup / recovery / deletion

| Field | Detail |
|-------|--------|
| **Status** | Needs documentation vs reality |
| **Current implementation** | Trash folder, domain delete, export paths vary |
| **Evidence** | Security/privacy pages; workspace delete flows |
| **Risk** | Marketing claims diverge from behavior |
| **Implementation needed** | Document D1/R2 backup, trash retention, account/domain/attachment deletion, export/restore; align Security page |
| **Tests needed** | Doc accuracy review |
| **Acceptance** | Security/privacy match reality |

---

## §19 — P1 Security headers / session hardening

| Field | Detail |
|-------|--------|
| **Status** | Headers largely present on Worker |
| **Current implementation** | CSP, HSTS, X-CTO, Referrer-Policy, frame-ancestors; Clerk sessions |
| **Evidence** | `worker/index.ts` middleware |
| **Risk** | Auth callback / email iframe regressions if headers changed blindly |
| **Implementation needed** | Audit cookie flags / CSRF / session expiry; document; fix only safe gaps |
| **Tests needed** | Header presence smoke in harness if practical |
| **Acceptance** | Production responses meet baseline without breaking Clerk/email |

---

## §20 — P1 API token and webhook security

| Field | Detail |
|-------|--------|
| **Status** | Exists; keys/webhooks scoped to `user.id` |
| **Current implementation** | Hashed API keys; webhook signing paths |
| **Evidence** | `worker/lib/workspace.ts` keys/webhooks |
| **Risk** | Cross-workspace if session user ≠ workspace; weak rotation/replay |
| **Implementation needed** | Audit hash/reveal/revocation/scopes/rate limits; ensure Workspace A tokens cannot access B; IDOR cases in harness |
| **Tests needed** | HTTP IDOR for keys/webhooks |
| **Acceptance** | Tokens/webhooks workspace-isolated |

---

## §21 — P2 Shared inbox (narrow Owner+Member only)

| Field | Detail |
|-------|--------|
| **Status** | RFC only — implement only if P0/P1 solid and time remains |
| **Current implementation** | Team invites + mailbox grants exist in schema |
| **Evidence** | `docs/rfc-agency-workspaces.md`; `worker/lib/team.ts` |
| **Risk** | Broad RBAC before isolation proven |
| **Implementation needed** | Narrow Owner+Member mailbox grant path only; every authz path must honor grants |
| **Tests needed** | Member denied foreign mailbox in harness |
| **Acceptance** | Safe shared mailbox access without enterprise RBAC |

---

## Priority order (execution)

1. HTTP IDOR harness → 2. Sanitizer fixtures → 3. Remote images → 4. Presence scoping → 5. Migrations 0030/0031 → 6. Inbound durability → 7. Outbound policy → 8. SNS review → then P1 9–19 → optional P2.

## Out of scope (this wave)

AI, calendar expansion, booking, advanced newsletter, white-label, SSO, enterprise RBAC, domain transfer, mass SEO, cosmetic redesign.
