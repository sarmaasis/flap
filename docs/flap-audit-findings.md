# Flap product audit findings

**Phase:** A — Inventory  
**Repo:** `/Users/sarmaasis/Work/projects/flap`  
**Source brief:** `FLAP_CURSOR_PRODUCT_AUDIT.md` (§§1–35, §36 Phase A, §37)  
**Date:** 2026-09-09  
**Sibling phase docs:**
- **Merged:** `docs/rfc-agency-workspaces.md` (Phase E, 2026-09-09) — agency/P2 model, current team gaps, transfer design, phased P2-E1…E5.
- **Merged:** `docs/audit-phase-b-security.md` (Phase B) — security/reliability fixes + residual risks.
- **Merged:** `docs/audit-phase-c-positioning.md` (Phase C, 2026-09-08) — homepage thesis, migrate/why-not-SES, trust, conversion events; post-completion note for later `/demo` `/changelog` `second_domain_added`.
- **Merged:** `docs/audit-phase-d-seo.md` (Phase D, 2026-09-09, reconciled) — seven core SEO landings + aliases; mxroute/mailhow deferred; **human `/vs/*` claim review required before publish**.

**Status legend:**  
`ALREADY IMPLEMENTED + WELL EXPOSED` | `ALREADY IMPLEMENTED + POORLY EXPOSED` | `PARTIALLY IMPLEMENTED` | `NOT IMPLEMENTED` | `NOT APPLICABLE`

---

# Executive Summary

Flap already has a strong multi-domain mail core (SES inbound/outbound, unified inbox, reply-from lock, domain filters, DNS wizard, plans, docs/legal/security routes, SEO tooling). **Phase B** closed critical cross-tenant/webhook/inbound/XSS holes (see `docs/audit-phase-b-security.md`); leftovers B-R1…B-R3 (SNS WebCrypto verify, draft/RSVP ACL, global unique domains via `0031`) are **Done**; **B-R4** D1 HTTP IDOR harness remains deferred. **Phase C** recentered marketing on the multi-domain wedge; `/migrate`, `/why-not-amazon-ses`, expanded `/security`, and conversion events shipped. **Later P1** added `/demo`, `/changelog`, and `second_domain_added`. **Phase D** shipped seven core SEO landings + aliases (pillar multi-domain, founders, SaaS products, venture studios, manage/send how-tos, Workspace education); deferred unverified `/flap-vs-mxroute` / `/flap-vs-mailhow`. Remaining gaps are mostly **human `/vs/*` claim review before publish**, **agency P2 builds**, **deferred Phase B items** (B-R4 D1 harness, Amazon CA pin, thread-presence scoping, remote-image UX policy), and intentional omissions (no fabricated social proof; no automated IMAP import).

Competitive wedge (“one inbox for every product you build” + automatic correct sender) is now centered on the homepage; product reply-from behavior was already correct (Phase B hardened deterministic reply-from).

---

## Critical issues

1. **Homepage category ambiguity (P0 positioning)** — **Resolved in Phase C.** Hero = “One inbox for every product you build”; adjacent tools demoted; §38 acceptance claimed met. Residual: human copy sign-off.
2. **Suppressions / bounce attribution cross-tenant leakage (security)** — Inventory scoped API; **Phase B** added `user_id` via `migrations/0030_suppressions_tenancy_inbound.sql`. Residual product rule: unattributed bounce/complaint does not create suppression (confirm vs SES-account-global intent).
3. **HTML email XSS defense-in-depth** — **Mitigated in later P0** — `shared/sanitize-email-html.ts` + MessageReader CSP/`referrerPolicy`; keep sandbox. Residual: no full browser XSS corpus in CI.
4. **Inbound failure visibility** — **Minimal fix shipped** — `inbound_ingest_log` + domain `last_inbound_*`; Settings Deliverability shows last inbound error. Full dead-letter UX still optional.
5. **Automated identity/authz tests** — **Unit contract suite shipped** (`shared/security-authz.test.ts`, `shared/security-phase-b.test.ts`); **B-R4 deferred:** full D1 HTTP IDOR route harness still open.

---

## Existing strengths

- Real multi-domain webmail on Amazon SES with readiness states (`identity` / `mx` / `receiving` / `sending`).
- Reply compose **locks From** to inbound mailbox with visible override (`Compose.tsx` `identityLocked`).
- Domain rail + unread + “via {domain}” chips in inbox/reader.
- DNS wizard with copyable records, DMARC suggestion, Check setup, propagation polling.
- Trust surface routes exist: `/security`, `/privacy`, `/terms`, `/docs*`, `/status`, `/about` (founder Ashish Sharma).
- Pricing/plans centralized in `shared/plans.ts`; Workspace cost calculator at `/tools/google-workspace-cost-calculator`.
- SEO infrastructure: sitemap, robots, registry validation, hubs (`/for/*`, `/vs/*`), guides, tools, blog; **Phase D** core intent landings + aliases + validators.
- First-party analytics funnel events for signup → domain → first mail.
- Team model: workspace roles (`owner`/`admin`/`member`) + mailbox grants; invites; shared mailboxes on Pro/Team (see Phase E RFC — no `read-only` role yet; domain IAM stub only).
- Export: JSON backup + `.mbox`; cancel export window documented.
- Transactional API (`POST /api/v1/send`), webhooks, newsletters, calendar/bookings adjacent products exist.

---

## Conversion gaps

| Gap | Notes |
|-----|--------|
| Hero CTA | **Phase C fixed** — “Connect your first domain” + thesis hero |
| Signature workflow demo | **Shipped** — `/demo` (front-end only); homepage also has static reply-from mock |
| FAQ incomplete vs audit §30 | **Phase C rewritten** to §30 objections |
| Migration story | **Phase C** public `/migrate` (honest; no auto IMAP import) |
| Proof metrics | `CREDIBILITY` qualitative only (correct — no fabricated stats) |
| Public changelog | **Shipped** — `/changelog` |
| Second-domain activation event | **Shipped** — `second_domain_added` |

---

## Product gaps

| Item | Status |
|------|--------|
| Automatic reply-from (product) | `ALREADY IMPLEMENTED + WELL EXPOSED` (works; Phase C homepage signature section) |
| Domain context in inbox | `ALREADY IMPLEMENTED + WELL EXPOSED` (rail + via chips; marketing mock domain-labeled in Phase C) |
| Domain onboarding | `PARTIALLY IMPLEMENTED` (strong wizard; Phase C marketing explains 4 steps; SES-facing copy residual in Settings) |
| Migration page/flow | `ALREADY IMPLEMENTED + WELL EXPOSED` public `/migrate`; import still narrative/stub (no IMAP) |
| Public demo | `ALREADY IMPLEMENTED + WELL EXPOSED` (`/demo`) |
| Pricing differentiation | `PARTIALLY IMPLEMENTED` (Phase C upgrade-path copy; identical 50 domains unchanged) |
| Workspace calculator | `ALREADY IMPLEMENTED + WELL EXPOSED` |
| Why-not-SES page | `ALREADY IMPLEMENTED + WELL EXPOSED` (`/why-not-amazon-ses`) |
| Multi-seat workspace + invites | `ALREADY IMPLEMENTED + WELL EXPOSED` (Settings Team tab; Pro/Team seats) |
| Shared mailbox flag | `ALREADY IMPLEMENTED + POORLY EXPOSED` (flag vs grants unclear; unshare does not revoke members) |
| Mailbox-level grants | `PARTIALLY IMPLEMENTED` (API + invite path; weak Settings UI; no read-only enforcement) |
| Domain-level permissions | `NOT IMPLEMENTED` (`GET /api/domain-iam` stub only — Phase E) |
| Read-only workspace role | `NOT IMPLEMENTED` |
| Client/domain grouping | `NOT IMPLEMENTED` |
| Domain ownership transfer | `NOT IMPLEMENTED` (RFC §7 designs flow; SES cutover is hard) |
| Agency landing | `PARTIALLY IMPLEMENTED` (`/for/agencies` strengthened; `/email-for-agencies` → 301 alias) |
| Agency client portals / VA / holding workspaces | `PARTIALLY IMPLEMENTED` (API stubs; not productized — do not market) |

---

## Security gaps

| Item | Status | Notes |
|------|--------|-------|
| Mailbox/message authz (core mail) | `ALREADY IMPLEMENTED + WELL EXPOSED` | List/get/thread/move/flags/delete/attachments + Phase B ACL on undo-send / open-track / quarantine |
| Draft update / calendar RSVP ACL | `ALREADY IMPLEMENTED + WELL EXPOSED` | **B-R2 Done** — `mailboxAccessClause` parity on those routes |
| Domain ownership before send | `ALREADY IMPLEMENTED + WELL EXPOSED` | Readiness + owner-scoped lookup in all `dispatchStoredMessage` paths (Phase B) |
| Global unique domain names | `ALREADY IMPLEMENTED + WELL EXPOSED` | **B-R3 Done** — migration `0031_global_unique_domains.sql` + claim check |
| Suppressions API tenancy | `ALREADY IMPLEMENTED + WELL EXPOSED` | Schema `user_id` + unique `(user_id, email)`; unattributed events never block sends |
| Newsletter bounce unsubscribe tenancy | `ALREADY IMPLEMENTED + WELL EXPOSED` | Scoped by outbound owner |
| HTML sanitization | `ALREADY IMPLEMENTED + WELL EXPOSED` | `sanitizeEmailHtml` + sandbox + CSP + `referrerPolicy` |
| Webhook signatures (Flap HMAC) | `ALREADY IMPLEMENTED + WELL EXPOSED` | Required unless `SES_INBOUND_ALLOW_UNSIGNED`; timestamp + SNS SubscribeURL allowlist |
| Native AWS SNS signature verify | `ALREADY IMPLEMENTED + WELL EXPOSED` | **B-R1 Done** — WebCrypto SigningCertURL + Signature verify in addition to Flap HMAC |
| Scheduled flush tenancy | `ALREADY IMPLEMENTED + WELL EXPOSED` | User routes scoped; cron may flush globally (Phase B) |
| Secrets in browser | `ALREADY IMPLEMENTED + WELL EXPOSED` | no SES keys client-side observed |
| Authz / IDOR automated tests | `PARTIALLY IMPLEMENTED` | Unit contracts in `security-authz` / `security-phase-b`; **B-R4 Deferred** — no full D1 HTTP harness |
| MFA/passkeys | `PARTIALLY IMPLEMENTED` | Clerk-managed; not Flap-product surface |
| Audit logs | `PARTIALLY IMPLEMENTED` | Table + API exist (Team); writers sparse. **Invite/accept/remove/share not audited** (Phase E). No Settings UI. |

### Phase B residuals (authoritative short list)

| # | Item | Status |
|---|------|--------|
| B-R1 | Native AWS SNS signature verification (WebCrypto) | **Done** |
| B-R2 | Draft update / calendar RSVP mailbox ACL | **Done** |
| B-R3 | Global unique domain names (migration `0031`) | **Done** |
| B-R4 | Full D1 / miniflare HTTP IDOR route harness | **Deferred** |

**Still deferred:** Amazon CA pin beyond host allowlist; thread-presence workspace scoping; remote-image / tracking UX policy; B-R4 D1 harness.

**Deploy needs:** local migrations `0030` + `0031`; remote migrate before prod.

---

## Reliability gaps

| Item | Status |
|------|--------|
| Inbound idempotency | `ALREADY IMPLEMENTED + WELL EXPOSED` (Phase B: stale reclaim, 503 in-progress, early `stored`) |
| Bounce/complaint → suppression | `ALREADY IMPLEMENTED + WELL EXPOSED` (workspace-scoped; soft-bounce 72h TTL) |
| Dead-letter / retry UX | `PARTIALLY IMPLEMENTED` (inbound_ingest_log + last_inbound_*; not full DLQ console) |
| Deliverability dashboard | `PARTIALLY IMPLEMENTED` (Settings Delivery timeline from `/api/delivery-events`) |
| Observability metrics catalog (§27) | `PARTIALLY IMPLEMENTED` (structured inbound logs; not full metric set) |
| Support debug tooling (§28) | `PARTIALLY IMPLEMENTED` (settings DNS + suppressions; no internal ops console) |

---

## SEO gaps

| Item | Status |
|------|--------|
| Technical SEO baseline | `ALREADY IMPLEMENTED + WELL EXPOSED` (registry, sitemap, robots, validate; Phase D synced `run_worker_first` + OG) |
| Core intent pages from audit §14 | `ALREADY IMPLEMENTED + WELL EXPOSED` (Phase D: pillar + founders + SaaS/studios + manage/send how-tos + Workspace education) |
| Competitor pages Folio/MailHow/OhRelay/mxroute | `PARTIALLY IMPLEMENTED` (`/vs/folio`, `/folio-alternative`, Zoho/Workspace deep pages; **mxroute/mailhow deferred**; no OhRelay) |
| Brand entity “Flap Email” consistency | `ALREADY IMPLEMENTED + WELL EXPOSED` (`og:site_name` / `PRODUCT_ALTERNATE_NAME` = Flap Email; legal short “Flap” OK) |
| `/email-for-founders`, `/email-for-agencies` exact paths | `ALREADY IMPLEMENTED + WELL EXPOSED` (founders page retained; agencies **301** → `/for/agencies`) |
| Structured data | `ALREADY IMPLEMENTED + WELL EXPOSED` on key pages |
| `/vs/*` claim accuracy | `PARTIALLY IMPLEMENTED` — **human review required before publish** |

---

## Missing trust surfaces

| Route / signal | Status |
|----------------|--------|
| `/security` | `ALREADY IMPLEMENTED + WELL EXPOSED` (Phase C expanded; no fake certs) |
| `/privacy`, `/terms` | `ALREADY IMPLEMENTED + WELL EXPOSED` |
| `/docs` | `ALREADY IMPLEMENTED + WELL EXPOSED` |
| `/status` | `PARTIALLY IMPLEMENTED` (health + links to changelog/manual notes; not full incident timeline) |
| `/subprocessors`, `/data-processing`, `/abuse`, `/deliverability` public | `NOT IMPLEMENTED` (subprocessors mentioned in privacy) |
| Public changelog | `ALREADY IMPLEMENTED + WELL EXPOSED` (`/changelog`) |
| Founder trust on homepage | `ALREADY IMPLEMENTED + WELL EXPOSED` (Phase C strip + `/about`) |

---

## Competitive gaps

Vs Folio / MailHow / OhRelay / SuperMailOS:

- Competitors lead with **one sentence + reply-from visual**. Flap homepage now matches that pattern (Phase C); keep suite features demoted.
- Folio-like **public demo** — **shipped** at `/demo`.
- MailHow-like **extreme message simplicity** — still optional polish on hero.
- Agency multi-client transfer / domain handoff absent (P2-E5 per RFC; do not build before clarity + read-only + audit).

---

## Agency / P2 (from Phase E RFC)

**Source:** `docs/rfc-agency-workspaces.md` (design only; no production schema in Phase E).

**Target roles:** Owner → Admin → Member → Read-only (fourth role not shipped). Boundaries: workspace role gates admin surfaces; mailbox grants gate mail for Member/Read-only; domain scope is future (expand-on-accept preferred before `domain_members`).

**Highest-value small builds (RFC §11):** (1) Team Settings shared-inbox membership UI + unshare→revoke prompt; (2) audit team lifecycle events; (3) end-to-end `read-only` with send guards. Defer transfer and domain IAM until those stabilize and a real agency needs handoff.

**Non-goals (RFC §10):** enterprise SSO/SCIM, custom roles, folder ACLs, white-label portals as launch, holding multi-billing workspaces, premature `user_id` ownership rewrite.

**Open questions carried:** Admin vs Owner-only API keys; transfer full history vs empty mailboxes; private mailbox grant auto-flipping `is_shared`. (**Resolved SEO:** `/email-for-agencies` → `/for/agencies` alias shipped in Phase D.)

---

## Recommended P0

1. ~~Reposition homepage hero + FAQ~~ — **Done (Phase C).**
2. ~~Promote reply-from as signature feature on landing~~ — **Done (Phase C)**; in-product empty-state copy still optional polish.
3. ~~Deepen `/security`~~ — **Done (Phase C).**
4. ~~Phase B: suppressions `user_id` + HTML sanitizer + authz/reply-from unit tests~~ — **Done.** B-R1…B-R3 **Done** (SNS verify, draft/RSVP ACL, global unique domains); **B-R4** D1 HTTP IDOR harness still deferred.
5. Confirm mailbox authorization regression tests for IDOR — **unit contract done**; full D1 HTTP harness still deferred (B-R4).

## Recommended P1

1. ~~Public `/migrate` + honest import limits~~ — **Done (Phase C).**
2. ~~No-signup interactive demo~~ — **Done** (`/demo`).
3. ~~`/why-not-amazon-ses`~~ — **Done (Phase C).**
4. ~~Public changelog + richer status~~ — **Done** (`/changelog`; Status links).
5. ~~Core SEO path aliases / new intent pages~~ — **Done (Phase D)**; **human `/vs/*` claim review before publish**; mxroute/mailhow deferred.
6. ~~Conversion events: `second_domain_added`, `cta_connect_domain`~~ — **Done** (Phase C + later).
7. ~~Pricing presentation clarity~~ — **Done (Phase C)**; numeric limits unchanged.

## Recommended P2

Phased per `docs/rfc-agency-workspaces.md` (do not jump to transfer):

1. **P2-E1 Clarity & hygiene** — shared-inbox copy + member grant list (wire existing APIs); audit invite/accept/revoke/remove/share; invite email delivery; `/email-for-agencies` → `/for/agencies` alias already shipped (Phase D); keep copy honest (not a full agency UI).
2. **P2-E2 Read-only role** — invite/member role + worker no-send / no-destructive guards + Settings UI.
3. **P2-E3 Domain-scoped grants** — expand-on-accept / future-mailbox flag before new tables; implement or remove public domain-IAM stub.
4. **P2-E4 Client grouping** — soft tags/groups; inbox filters; still one billing workspace.
5. **P2-E5 Domain transfer** — separate implementation RFC; Owner-only initiate; SES-coordinated cutover; dual audit; plan-limit preflight.

Also: better migration automation (IMAP/MBOX) remains P2 after public `/migrate` honesty (Phase A plan), independent of agency.

## Recommended P3

1. Expand AI / calendar / booking / newsletter only with demand.
2. IMAP when ready (already deferred openly to 2026-10-15).

---

## Files/routes/components affected

**Routing:** `src/App.tsx`  
**Marketing:** `src/pages/Landing.tsx`, `src/content/marketing.ts`, `shared/product-facts.ts`, `src/pages/PricingPage.tsx`, `src/pages/SecurityPage.tsx`, `src/pages/AboutPage.tsx`, `src/pages/MigratePage.tsx`, `src/pages/WhyNotSesPage.tsx`, `src/pages/DemoPage.tsx`, `src/pages/ChangelogPage.tsx`, `src/pages/StatusPage.tsx`, `src/content/hubs.ts`, `shared/client-routes.ts`  
**Inbox/compose:** `src/pages/Inbox.tsx`, `src/pages/Compose.tsx`, `src/components/MessageReader.tsx`, `src/components/MailFolderRail.tsx`  
**Domains/DNS:** `src/pages/settings/SettingsApp.tsx`, `src/pages/settings/DomainsPage.tsx`  
**Mail core:** `worker/email.ts`, `worker/lib/inbound-webhook.ts`, `worker/lib/mail-provider.ts`, `worker/lib/ses.ts`, `worker/lib/workspace.ts`, `worker/lib/team.ts`, `worker/lib/product-features.ts`, `worker/lib/collaboration-extras.ts`, `worker/lib/domain-controls.ts`  
**Agency/team UI:** `src/pages/settings/SettingsApp.tsx` (Team tab), `src/pages/InviteAccept.tsx`  
**Plans/analytics/SEO:** `shared/plans.ts`, `src/lib/analytics.ts`, `src/content/sitemap.ts`, `scripts/validate-seo.ts`  
**Agency design:** `docs/rfc-agency-workspaces.md`  
**Phase audits:** `docs/audit-phase-b-security.md`, `docs/audit-phase-c-positioning.md`, `docs/audit-phase-d-seo.md` (D complete; `/vs/*` claim review before publish)

---

## Database/schema changes required

| Change | Priority | Why |
|--------|----------|-----|
| `mail_suppressions.user_id` (+ unique `(user_id, email)`) | ✅ Done (migration 0030) | Tenancy; per-workspace suppressions |
| Global unique `domains.name` | ✅ Done (migration 0031) | Prevent cross-tenant domain claim races |
| Optional `delivery_event_log` backfill from messages | P1 | Historical attribution |
| `workspace_members.role` allow `read-only` | P2-E2 | Additive string; enforce on send paths |
| Agency: `domain_members` or invite `domain_ids` expand | P2-E3 | Prefer expand-on-accept before new tables |
| Agency: client group/tag on domains | P2-E4 | Soft grouping only |
| Agency: domain transfer state machine + SES job | P2-E5 | After separate implementation RFC |
| No pricing limit changes | — | Per audit: economics first |
| No rewrite of `workspace_id === user_id` | — | RFC non-goal until holding workspaces are real |

---

## Migration risks

- Suppressions now per-workspace `user_id` (migration 0030); product rule: unattributed bounce/complaint does not create a suppression — confirm vs SES-account-global intent.
- Domain names globally unique (migration 0031); deploy needs local `0030`+`0031` and remote migrate before prod.
- Newsletter unsubscribe now requires outbound message id match; orphaned SES events without stored `provider_message_id` skip list unsubscribe (safer than cross-tenant).
- Homepage copy changes must stay consistent with `shared/product-facts.ts` and SEO registry.
- Do not invent competitor prices on comparison pages; **Phase D:** human re-verify `/vs/*` claims before publish.
- **Agency (RFC §8):** empty mailbox grants after invite; unshare without revoke; Admin sees all mailboxes (too broad for multi-client); marketing Read-only without send guards; transfer + SES split-brain; plan limits on transfer accept; do not market portal/VA/holding stubs.

---

## Tests required

1. Reply-from: inbound mailbox → locked From; override does not bleed across threads; forward behavior; multi-recipient deterministic rule.
2. Authz: message/attachment/mailbox IDOR across users and restricted members.
3. Suppressions: user A cannot list/delete user B rows.
4. Domain verification: cannot send before `sending_ready_at`.
5. HTML email: script/iframe/onerror payloads do not execute (sandbox + sanitizer).
6. Inbound idempotency duplicate provider ids.
7. SEO registry uniqueness (already partially covered).
8. Agency (when P2 builds): invite grants preview; read-only cannot send; unshare revoke; transfer concurrent/partial-failure/cross-tenant (E5).

---

## Estimated effort by item

| Item | Complexity | Est. |
|------|------------|------|
| Homepage reposition + FAQ | M | 2–4 d |
| Security page depth | S–M | 1–2 d |
| Interactive demo | M | 2–3 d |
| `/migrate` + `/why-not-amazon-ses` | M | 2–3 d |
| Suppressions schema tenancy | M | 1–2 d |
| HTML sanitizer + tests | M | 1–2 d |
| Reply-from + authz test suite | M | 2–3 d |
| Core SEO intent pages | M–L | ✅ done (Phase D); claim review S |
| Changelog + status upgrade | S | 1 d |
| Analytics second-domain + activation | S | 0.5–1 d |
| Agency RFC (design) | S | ✅ done (`docs/rfc-agency-workspaces.md`) |
| P2-E1 shared-inbox UI + team audit + invite email | M | 2–4 d |
| P2-E2 read-only role end-to-end | M | 2–3 d |
| P2-E3 domain-scoped grants | M–L | 3–5 d |
| P2-E4 client grouping | M | 2–3 d |
| P2-E5 domain transfer | L | separate RFC + multi-day build |

---

# Item-by-item inventory (audit §§3–35)

### §3 Homepage positioning
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (**Phase C**)  
- **Evidence:** Hero “One inbox for every product you build”; CTA “Connect your first domain”; adjacent tools demoted (`Landing.tsx`, `marketing.ts`).  
- **Relevant files:** `src/pages/Landing.tsx`, `src/content/marketing.ts`, `shared/product-facts.ts`  
- **Risk:** Low — keep suite features from creeping back into hero.  
- **Recommendation:** Human copy sign-off; do not reintroduce calendar/newsletter as peer heroes.  
- **Estimated complexity:** — (done)

### §4 Automatic sender identity
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (product + Phase C marketing)  
- **Evidence:** `replyFromAddress` → locked From; homepage signature / hero proof; `/demo` walkthrough.  
- **Relevant files:** `src/pages/Inbox.tsx`, `src/pages/Compose.tsx`, `src/pages/Landing.tsx`, `src/pages/DemoPage.tsx`  
- **Risk:** Wrong-from edge cases (aliases, CC-only, forwards) — covered by unit contracts; HTTP suite optional.  
- **Recommendation:** Optional in-composer “Automatically selected because…” polish.  
- **Estimated complexity:** S (optional copy)

### §5 Unified inbox domain context
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** Domain rail with unread; row “via {domain}”; marketing mock domain-labeled (Phase C); mobile domain `<select>` on `max-lg` (later P1).  
- **Relevant files:** those + domain color picker  
- **Risk:** Low.  
- **Recommendation:** Optional badge/“sent to” copy polish.  
- **Estimated complexity:** S

### §6 Product category clarity
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (**Phase C**)  
- **Evidence:** Thesis-first landing; About aligned; adjacent tools under “Once domains are connected”.  
- **Recommendation:** Keep SEO/hub pages consistent with thesis (**Phase D** landings/aliases shipped).  
- **Estimated complexity:** S (ongoing)

### §7 Trust and safety surface
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` for core routes (**Phase C** security depth); status still light  
- **Evidence:** Expanded `/security`; `/changelog`; footer migrate/why-not-SES; Status health + changelog links.  
- **Relevant files:** `SecurityPage.tsx`, `ChangelogPage.tsx`, `Legal.tsx`, `StatusPage.tsx`, `MarketingShell.tsx`  
- **Risk:** Enterprise/agency may still want subprocessors/DPA pages.  
- **Recommendation:** Later subprocessors/DPA/abuse if demanded.  
- **Estimated complexity:** M (optional)

### §8 Domain onboarding
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Evidence:** Rich DNS wizard; Phase C marketing explains Add → DNS → Verify → Receive/send; some Settings copy still SES-facing.  
- **Relevant files:** `SettingsApp.tsx`, `worker/lib/onboarding-tools.ts`, `worker/lib/domain-controls.ts`  
- **Risk:** Users feel they are “configuring AWS”.  
- **Recommendation:** User-facing “Connect your domain”; keep SES in docs.  
- **Estimated complexity:** M

### §9 Migration story
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` public page; import automation `NOT IMPLEMENTED`  
- **Evidence:** `/migrate` honest cutover; Settings export/mbox; no IMAP importer.  
- **Recommendation:** Keep honesty; IMAP/MBOX import remains P2.  
- **Estimated complexity:** — (page done); import L later

### §10 Public interactive demo
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** `/demo` front-end-only multi-domain reply-from walkthrough.  
- **Estimated complexity:** — (done)

### §11 Pricing audit
- **Status:** `PARTIALLY IMPLEMENTED` (presentation improved Phase C; limits unchanged)  
- **Evidence:** Capacity dial copy on `/pricing` + homepage; paid plans share 50 domains.  
- **Risk:** “Why upgrade?” if visitor fixates on domains — mitigated by copy.  
- **Recommendation:** No limit changes without economics review.  
- **Estimated complexity:** — (presentation done)

### §12 Workspace cost calculator
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** `/tools/google-workspace-cost-calculator` + homepage pricing band link.  
- **Estimated complexity:** — (optional homepage embed)

### §13 Why not Amazon SES
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** `/why-not-amazon-ses`; claims should stay aligned with `docs/mail-architecture.md`.  
- **Estimated complexity:** — (done)

### §14 SEO landing pages
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (**Phase D**; competitor claim review still open)  
- **Evidence:** Pillar `/email-for-multiple-domains`; `/email-for-founders`; `/email-for-multiple-saas-products`; `/email-for-venture-studios`; `/how-to-manage-email-for-multiple-domains`; `/how-to-send-email-from-multiple-domains`; `/google-workspace-multiple-domains`; aliases for one-inbox / agencies / portfolio / zoho-mail / folio / fastmail. **Deferred:** `/flap-vs-mxroute`, `/flap-vs-mailhow` (unverified claims).  
- **Relevant files:** `src/content/seo-pages.ts`, `shared/client-routes.ts`, `src/content/hubs.ts`, `wrangler.jsonc`  
- **Risk:** Stale competitor prices/limits on existing `/vs/*` if published without review.  
- **Recommendation:** Human `/vs/*` claim review before publish; do not add thin competitor spam.  
- **Estimated complexity:** — (build done); claim review S

### §15 Technical SEO
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** `scripts/validate-seo.ts`, `scripts/seo.test.ts`, sitemap/robots/llms, prerender; Phase D: brand meta, soft-404/robots hygiene, Worker `SEO_PATHS`/`SEO_REDIRECTS`, synced `run_worker_first` + OG PNGs + registry home H1.  
- **Recommendation:** Optional later generate `run_worker_first` from `client-routes` to avoid drift.  
- **Estimated complexity:** S (ongoing)

### §16 Brand/entity SEO
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (**Phase D**)  
- **Evidence:** `og:site_name` / alternateName = Flap Email; homepage title matches audit suggestion; legal titles may use short “Flap”.  
- **Estimated complexity:** — (done)

### §17 Proof and credibility
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Evidence:** Qualitative trust cards (Phase C removed star-fake reviews); changelog/status/founder present; no fabricated metrics (good).  
- **Estimated complexity:** — (structure done; real testimonials when available)

### §18 Founder trust
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED`  
- **Evidence:** `/about` + homepage founder strip (`Landing.tsx` `#founder`).  
- **Estimated complexity:** — (done)

### §19–21 Shared inbox / agency / transfer
- **Status:** See product-gaps table (Phase E classifications). Multi-seat + invites `WELL EXPOSED`; shared flag `POORLY EXPOSED`; mailbox grants `PARTIAL`; domain IAM / read-only / grouping / transfer `NOT IMPLEMENTED`.
- **Evidence:** `worker/lib/team.ts`, Team tab, invite accept; `is_shared` + default grant-to-shared; `audit_log` sparse; domain-IAM stub; portals/VA/holding stubs; `/for/agencies` + Phase D `/email-for-agencies` alias. Full design: `docs/rfc-agency-workspaces.md`.
- **Recommendation:** Execute P2-E1 → E2 before E3–E5; do not ship enterprise RBAC; `/email-for-agencies` → `/for/agencies` alias shipped (Phase D).
- **Estimated complexity:** E1–E2 M; transfer L

### §22 AI positioning
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (demoted off hero in Phase C)  
- **Evidence:** Adjacent capabilities after domain thesis.  
- **Estimated complexity:** — (watch for regression)

### §23 Transactional email
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (API remains available; not hero)  
- **Evidence:** API send + quotas; demoted on homepage per thesis.  
- **Estimated complexity:** S (positioning maintenance)

### §24 Deliverability
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Evidence:** SES events → suppressions (workspace-scoped, Phase B); soft-bounce 72h; Settings Delivery timeline; attribution via outbound `provider_message_id`.  
- **Estimated complexity:** M (optional richer ops)

### §25 Inbox reliability
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Evidence:** Phase B inbound claim lifecycle fixes silent duplicate ACK; pagination/folders/attachments present; limited HTTP route coverage.  
- **Estimated complexity:** M (D1 HTTP harness)

### §26 Security checklist
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Evidence:** Phase B fixed flush tenancy, webhook HMAC/SSRF, send readiness, suppressions schema, sanitizer, ACL gaps (incl. draft/RSVP), reply-from hardening, global unique domains (`0031`), native SNS WebCrypto verify. **Deferred:** B-R4 D1 HTTP IDOR harness; Amazon CA pin; thread-presence scoping; remote-image UX policy. Do not enable `SES_INBOUND_ALLOW_UNSIGNED` in prod casually.  
- **Estimated complexity:** M (residuals)

### §27 Observability
- **Status:** `PARTIALLY IMPLEMENTED`  
- **Estimated complexity:** M

### §28 Support/debug tooling
- **Status:** `PARTIALLY IMPLEMENTED` (Delivery timeline + last inbound error in Settings)  
- **Estimated complexity:** M

### §29–30 Homepage structure / FAQ
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` (**Phase C**)  
- **Evidence:** Structure aligned to audit sections; FAQ rewritten to §30.  
- **Estimated complexity:** — (done)

### §31–32 Conversion instrumentation / activation
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` for named events  
- **Evidence:** `homepage_view`, `cta_connect_domain`, `migration_page_view`, `pricing_view`, `second_domain_added` (+ existing domain/mail funnel).  
- **Relevant files:** `src/lib/analytics.ts`, `worker/lib/activation.ts`, `worker/lib/analytics.ts`  
- **Estimated complexity:** — (done; cohort dashboards optional)

### §33–34 Content strategy
- **Status:** `ALREADY IMPLEMENTED + WELL EXPOSED` for pillar + supporting how-tos (**Phase D**); thin spam avoided  
- **Evidence:** Pillar + SaaS/studios/Workspace education/send how-to; deferred mxroute/mailhow + mass programmatic pages (§34).  
- **Recommendation:** Human `/vs/*` claim review; keep quality over page count.  
- **Estimated complexity:** — (Phase D done); claim review S

### §35 Priority checklist mapping
See Recommended P0–P3 above. Phase B security + Phase C positioning + later P1 demo/changelog/activation + Phase D SEO build closed; B-R1…B-R3 closed; **`/vs/*` claim review**, B-R4 + other deferred Phase B items, and P2 agency remain.

---

# Critical fix applied during inventory

### Cross-tenant suppressions / newsletter unsubscribe / bounce attribution

**Problem:** Any workspace admin could list/delete the entire global `mail_suppressions` table; deliverability counts were global; SES bounce/complaint handlers unsubscribed `newsletter_subscribers` by email across all tenants; `recordDeliveryEvent` attributed by bounce **recipient** domain (almost always wrong).

**Fix (2026-09-09):**
- `worker/lib/product-features.ts` — scope suppressions list/delete and deliverability/reputation counts to workspace via `messages.provider_message_id` and `delivery_event_log.user_id`.
- `worker/lib/inbound-webhook.ts` — resolve outbound owner from `messages.provider_message_id`; scope newsletter unsubscribe; stop recipient-domain attribution.

**Follow-up still required:** B-R4 D1 HTTP IDOR harness (deferred); Amazon CA pin; thread-presence scoping; remote-image UX policy; confirm suppressions product rule vs SES-account-global intent; deploy migrations `0030`+`0031` (remote before prod).
