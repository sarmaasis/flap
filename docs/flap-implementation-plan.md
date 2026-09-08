# Flap implementation plan (post–Phase A inventory)

**Master plan** owned with `docs/flap-audit-findings.md`.  
**Rule:** Do not blindly implement the full audit. Execute P0/P1 first. P2/P3 remain planned.

**Sibling inputs:**
- **Merged:** `docs/rfc-agency-workspaces.md` (Phase E) → expands P2 below (P2-E1…E5).
- **Merged:** `docs/audit-phase-b-security.md` (Phase B) → P0 security tasks 4–7 largely done; B-R1…B-R3 done; B-R4 deferred (see residuals table).
- **Merged:** `docs/audit-phase-c-positioning.md` (Phase C) → P0 tasks 1–3 and P1 tasks 8, 10–11 done; later agents closed 9, 12, 14.
- **Merged:** `docs/audit-phase-d-seo.md` (Phase D, reconciled) → P1 task 13 build complete; **human `/vs/*` claim review required before publish**; mxroute/mailhow deferred.

---

## P0 — Must do first

### 1. Homepage reposition: multi-domain wedge first
- **Status:** ✅ **Done (Phase C)**  
- **Priority:** P0  
- **Why:** Visitors cannot answer “what is Flap / who is it for / what happens on reply” in ~10 seconds; suite pitch creates category ambiguity (§3, §6, §38).  
- **Files affected:** `src/pages/Landing.tsx`, `src/content/marketing.ts`, possibly `shared/product-facts.ts`, `src/components/MarketingShell.tsx`  
- **Implementation:** Rewrite hero to “One inbox for every product you build”; supporting line on connect domains + auto reply-from; CTA “Connect your first domain” / signup equivalent; move AI/calendar/newsletter/API to later “More than webmail” band; add signature workflow visual (receive → reply → From locked).  
- **Tests:** Manual screenshot/FAQ schema still valid; `scripts/validate-seo.ts` / registry titles if meta changes.  
- **Acceptance criteria:** New visitor can state multi-domain + one inbox + correct From + simple setup + trust path without scrolling past fold for the suite pitch.  
- **Dependencies:** None.

### 2. Expose reply-from as signature feature (product copy + landing)
- **Status:** ✅ **Done (Phase C marketing + Phase B `resolveReplyFromAddress`)** — optional in-composer “because…” copy polish remains  
- **Priority:** P0  
- **Why:** Behavior already ships; competitors win on making it obvious (§4).  
- **Files affected:** `src/pages/Compose.tsx`, `src/pages/Landing.tsx`, optionally `src/components/MessageReader.tsx`  
- **Implementation:** Composer copy: “Sending as … automatically selected because this message was sent to …”; homepage section mirroring that UX.  
- **Tests:** Manual; pair with task 5 automated tests.  
- **Acceptance criteria:** Reply compose always shows locked identity explanation before send; landing shows the workflow above the fold or as section 3.  
- **Dependencies:** Task 1 preferred first for messaging consistency.

### 3. Deepen `/security` with accurate architecture
- **Status:** ✅ **Done (Phase C)**  
- **Priority:** P0  
- **Why:** Email is high-trust; current page is short promises (§7).  
- **Files affected:** `src/pages/SecurityPage.tsx`, `shared/product-facts.ts`, `docs/mail-architecture.md` (source of truth for claims)  
- **Implementation:** Document inbound/outbound SES paths, TLS, at-rest (D1/R2/SES), auth (Clerk), webhook HMAC, export/deletion, AI confirm-before-send, operator access honesty, incident contact. No fake certifications.  
- **Tests:** SEO meta/JSON-LD still unique; factual review against product-facts.  
- **Acceptance criteria:** Security page answers audit §7 checklist where true; linked from footer (already).  
- **Dependencies:** None.

### 4. Suppressions tenancy hardening (schema follow-up)
- **Status:** ✅ **Done (Phase B)** — `migrations/0030_suppressions_tenancy_inbound.sql`; unattributed events do not block sends  
- **Priority:** P0  
- **Why:** Inventory fixed API scoping; table remains globally unique on email — incomplete tenancy (§26).  
- **Files affected:** new `migrations/0030_*.sql`, `worker/lib/inbound-webhook.ts`, `worker/lib/product-features.ts`, send paths using `isAddressSuppressed`  
- **Implementation:** Add `user_id`; decide product rule for shared-SES global block vs per-workspace; backfill from `messages.provider_message_id` / delivery log; update upsert/list/delete.  
- **Tests:** Cross-tenant list/delete forbidden; bounce for A does not unsubscribe B’s newsletter.  
- **Acceptance criteria:** No workspace can read/mutate another’s suppression rows; send suppression behavior documented.  
- **Dependencies:** Inventory fix already merged in working tree.

### 5. Authorization + reply-from automated tests
- **Status:** ✅ **Done (unit contracts)** — `shared/security-phase-b.test.ts`, `shared/security-authz.test.ts`. **Deferred (B-R4):** full D1 HTTP IDOR route harness  
- **Priority:** P0  
- **Why:** Critical security/reliability without CI coverage (§4, §25, §26).  
- **Files affected:** new tests under `worker/` or `scripts/` (match repo test runner), fixtures for D1 if available  
- **Implementation:** Cases: IDOR on `/api/mail/:id`, attachment download, member mailbox grant denial; reply-from mailbox_id mapping; domain not sending-ready blocks send.  
- **Tests:** The deliverable is the tests.  
- **Acceptance criteria:** CI fails if cross-user message fetch or wrong default From regresses.  
- **Dependencies:** Stable test harness choice.

### 6. HTML email sanitization defense-in-depth
- **Status:** ✅ **Done (Phase B)** — `shared/sanitize-email-html.ts` + MessageReader CSP / `referrerPolicy`  
- **Priority:** P0  
- **Why:** `sandbox=""` iframe is necessary but single-layer (§26).  
- **Files affected:** `src/components/MessageReader.tsx` (and shared sanitize helper)  
- **Implementation:** Sanitize HTML (strip script/iframe/object/handlers/javascript: URLs) before `srcDoc`; keep sandbox; document remote-image policy.  
- **Tests:** Payload corpus does not execute; visual smoke on normal marketing email.  
- **Acceptance criteria:** Dangerous tags removed even if sandbox attributes change later.  
- **Dependencies:** None.

### 7. Mailbox authz / inbound failure path audit notes → minimal reliability fix
- **Status:** ✅ **Done (Phase B minimal)** — inbound claim lifecycle + `inbound_ingest_log` / `last_inbound_*`; Settings shows last inbound error. **B-R2 Done:** draft/RSVP mailbox ACL  
- **Priority:** P0  
- **Why:** Audit requires understood persistence/failure path (§24–25).  
- **Files affected:** `worker/email.ts`, `worker/lib/inbound-webhook.ts`, optional ops log table  
- **Implementation:** Ensure failed ingest outcomes are durable/queryable (at least structured logs + admin-visible last failure per domain); document SES→Lambda→Worker retry. Avoid silent drop without claim release (already mostly handled).  
- **Tests:** Duplicate provider id → duplicate; parse_error releases claim.  
- **Acceptance criteria:** Operator can explain what happened to a missing inbound message from domain + provider id.  
- **Dependencies:** Task 5 helpful.

---

## Phase B residuals (follow-up; non-blocking)

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| B-R1 | Native AWS SNS signature verification | P1 security | **Done** | WebCrypto SigningCertURL + Signature; Flap HMAC retained |
| B-R2 | Draft update / calendar RSVP mailbox ACL | P1 security | **Done** | `mailboxAccessClause` parity on those routes |
| B-R3 | Global unique domain names | P1 / product | **Done** | Migration `0031_global_unique_domains.sql` + claim check |
| B-R4 | Full D1 / miniflare HTTP IDOR route harness | P1 quality | **Deferred** | Beyond pure unit authz helpers |

**Still deferred:** Amazon CA pin beyond host allowlist; thread-presence workspace scoping; remote-image / tracking UX policy; B-R4.

**Deploy needs:** local migrations `0030` + `0031`; remote migrate before prod.

---

## P1 — High impact

### 8. Public `/migrate` experience
- **Status:** ✅ **Done (Phase C)**  
- **Priority:** P1  
- **Why:** Prospects already have mail elsewhere (§9).  
- **Files affected:** `src/App.tsx`, new `src/pages/MigratePage.tsx`, `worker/lib/onboarding-tools.ts`, SEO registry  
- **Implementation:** Explain verify → test send → MX switch → rollback → export; link in-app SES/CF helpers; honest import limits (mbox today; IMAP later).  
- **Tests:** Route in sitemap if indexable; no false “one-click Gmail import” claims.  
- **Acceptance criteria:** Public page answers migration questions without overclaiming.  
- **Dependencies:** Export already exists.

### 9. No-signup interactive demo
- **Status:** ✅ **Done** (`/demo`)  
- **Priority:** P1  
- **Why:** Strongest comprehension tool vs Folio (§10).  
- **Files affected:** new demo page/component, `Landing.tsx` CTA, `App.tsx`  
- **Implementation:** Fake domains/messages; Reply shows locked From; front-end only; never call send APIs.  
- **Tests:** Demo route does not hit `/api/mail` send.  
- **Acceptance criteria:** User completes receive→reply→correct From without signup.  
- **Dependencies:** Task 1 messaging.

### 10. `/why-not-amazon-ses`
- **Status:** ✅ **Done (Phase C)**  
- **Priority:** P1  
- **Why:** Technical founders ask build-vs-buy (§13).  
- **Files affected:** new page, hubs/SEO registry, footer/docs link  
- **Implementation:** Explain product layer (inbox, identities, DNS UX, storage, teams, API) without attacking AWS.  
- **Tests:** SEO validation.  
- **Acceptance criteria:** Page is accurate vs `docs/mail-architecture.md`.  
- **Dependencies:** None.

### 11. Pricing presentation clarity
- **Status:** ✅ **Done (Phase C)** — numeric limits unchanged  
- **Priority:** P1  
- **Why:** Identical 50-domain caps obscure upgrade rationale (§11).  
- **Files affected:** `src/pages/PricingPage.tsx`, `Landing.tsx` plan band  
- **Implementation:** Emphasize mailboxes, seats, sends, newsletters as upgrade dial; keep numbers from `shared/plans.ts` unchanged.  
- **Tests:** None beyond copy review.  
- **Acceptance criteria:** Visitor understands why Pro/Team costs more without domain-count confusion.  
- **Dependencies:** Economics review before any limit change (out of scope).

### 12. Founder + changelog + status upgrade
- **Status:** ✅ **Done** — homepage founder strip; `/changelog`; Status links changelog  
- **Priority:** P1  
- **Why:** Early-stage trust signals (§17–18).  
- **Files affected:** `Landing.tsx`, new `/changelog` (or GitHub releases page), `StatusPage.tsx`  
- **Implementation:** Concise founder strip on homepage; public changelog with real dates; status beyond single health probe (even manual incident notes).  
- **Tests:** Routes indexable only if contentful.  
- **Acceptance criteria:** Trust section links security, status, about, changelog, export.  
- **Dependencies:** Task 3 preferred.

### 13. Core SEO intent pages (accurate only)
- **Status:** ✅ **Done (Phase D)** — build complete; **human `/vs/*` claim review required before publish**  
- **Priority:** P1  
- **Why:** Capture high-intent queries (§14–16).  
- **Files affected:** `shared/client-routes.ts`, `src/content/seo-pages.ts` / hubs / registry, `wrangler.jsonc`, prerender scripts, `scripts/seo.test.ts`  
- **Shipped (reconciled):** Pillar `/email-for-multiple-domains`; audience `/email-for-founders`, `/email-for-multiple-saas-products`, `/email-for-venture-studios`; education `/how-to-manage-email-for-multiple-domains`, `/how-to-send-email-from-multiple-domains`, `/google-workspace-multiple-domains`; 301 aliases (one-inbox variants, `/email-for-agencies` → `/for/agencies`, portfolio/side-project, zoho-mail/folio/fastmail); tech SEO (brand meta, Flap Email entity, robots/soft-404, Worker `SEO_PATHS`/`SEO_REDIRECTS`, registry H1, OG, `run_worker_first`).  
- **Deferred:** `/flap-vs-mxroute`, `/flap-vs-mailhow`; mass programmatic SEO; deep competitor price tables.  
- **Tests:** `npm run test:seo` / `validate:seo` / `generate:og`.  
- **Acceptance criteria:** Each new page unique title/H1/intent — **met**; no unsupported competitor price/limit claims on new pages — **met**.  
- **Remaining (non-blocking):** Human re-verify `/vs/*` claims before publish; optional Search Console submit; optional generate `run_worker_first` from `client-routes`.  
- **Dependencies:** — (Phase D complete).

### 14. Conversion analytics + activation definition
- **Status:** ✅ **Done** — `homepage_view`, `cta_connect_domain`, `migration_page_view`, `pricing_view`, `second_domain_added`  
- **Priority:** P1  
- **Why:** Second domain is the differentiation signal (§31–32).  
- **Files affected:** `src/lib/analytics.ts`, domain add UI, `worker/lib/activation.ts`  
- **Implementation:** Emit `second_domain_added`; align naming (`homepage_view` alias or docs); dashboard query for 1 vs 2+ domain retention.  
- **Tests:** Event accepted by `/api/analytics`.  
- **Acceptance criteria:** Funnel from signup → verified domain → first mail → second domain measurable.  
- **Dependencies:** None.

### 15. Deliverability event visibility in-product
- **Status:** ✅ **Done** — Settings Delivery timeline  
- **Priority:** P1  
- **Why:** Operators need bounce/complaint timeline (§24, §28).  
- **Files affected:** Settings deliverability UI, `worker/lib/product-features.ts`  
- **Implementation:** Per-domain event timeline from `delivery_event_log`; clear empty states.  
- **Tests:** Scoped to workspace (regression on tenancy).  
- **Acceptance criteria:** Owner sees last bounce/complaint for their sends only.  
- **Dependencies:** Task 4.

### 16. Mobile domain/mailbox filter parity
- **Status:** ✅ **Done** — domain `<select>` on `max-lg`  
- **Priority:** P1  
- **Why:** Domain rail hidden on small screens (`MailFolderRail`).  
- **Files affected:** `src/components/MailFolderRail.tsx`, `Inbox.tsx`  
- **Implementation:** Select/chips for domain filter on mobile.  
- **Tests:** Manual responsive.  
- **Acceptance criteria:** Multi-domain users can filter without desktop rail.  
- **Dependencies:** None.

---

## P2 — Planned (do not implement in this wave)

**Agency RFC:** ✅ `docs/rfc-agency-workspaces.md` (P2-E0). Build order below; keep additive/reversible.

### P2-E1 — Shared-inbox clarity & team hygiene
- **Title:** Shared-inbox membership UI + team audit + invite email  
- **Priority:** P2  
- **Why:** Highest agency clarity per line of code; grant/revoke APIs already exist; invite/accept/share not audited today.  
- **Files affected:** `src/pages/settings/SettingsApp.tsx`, `worker/lib/team.ts`, `worker/lib/plan-guard.ts` (`writeAuditLog`), `worker/lib/system-email.ts`; `/email-for-agencies` → `/for/agencies` alias already shipped (Phase D)  
- **Implementation:** List members per shared mailbox; wire grant/revoke; unshare → revoke prompt; audit `team.invite_*` / remove / share; send invite email in addition to copyable link; document “defaults to all shared inboxes.” (SEO alias done — no need to re-add.)  
- **Tests:** Member without grant cannot read mailbox; unshare can revoke; audit rows appear.  
- **Acceptance criteria:** Admin can see who accesses each shared inbox; lifecycle actions leave audit trail; invitee can receive email link.  
- **Dependencies:** None (RFC done).

### P2-E2 — Read-only role
- **Title:** Workspace `read-only` role end-to-end  
- **Priority:** P2  
- **Why:** Target fourth role for client observers / VAs without send authority.  
- **Files affected:** `worker/lib/team.ts`, compose/send routes in `worker/index.ts` / `workspace.ts`, Settings + Invite UI  
- **Implementation:** Allow `role = 'read-only'` on invites/members; block send, permanent delete, mailbox settings; UI option.  
- **Tests:** Read-only can list/read granted mail; send returns 403.  
- **Acceptance criteria:** Role is enforceable, not cosmetic.  
- **Dependencies:** P2-E1 preferred.

### P2-E3 — Domain-scoped grants
- **Title:** Domain allow-list / expand-on-accept grants  
- **Priority:** P2  
- **Why:** Agencies need “all mailboxes on client.com” without listing each address.  
- **Files affected:** invites schema or expansion job, `team.ts`, domain-IAM stub in `domain-controls.ts`  
- **Implementation:** Prefer invite `domain_ids` → expand to mailboxes on accept + “include future mailboxes” re-sync; implement or remove public stub. Avoid premature heavy `domain_members` if expand works.  
- **Tests:** New mailbox on granted domain appears for member when flag set.  
- **Acceptance criteria:** Member scoped to a client domain without Admin-all-mailboxes.  
- **Dependencies:** P2-E1–E2.

### P2-E4 — Client / domain grouping
- **Title:** Soft client groups/tags on domains  
- **Priority:** P2  
- **Why:** Agencies think in clients, not flat domain lists.  
- **Files affected:** domains schema (additive), inbox/settings filters, hubs optional  
- **Implementation:** Tags/groups; filter inbox + settings; still one billing workspace. Holding/`workspaces_extra` remain non-goals.  
- **Tests:** Filter returns only tagged domains’ mail.  
- **Acceptance criteria:** Studio can triage by client label.  
- **Dependencies:** P2-E1.

### P2-E5 — Domain ownership transfer
- **Title:** Domain handoff to client workspace  
- **Priority:** P2 (large — separate implementation RFC first)  
- **Why:** Client offboarding without recreate-DNS theatre (§21).  
- **Files affected:** new transfer tables/APIs, SES identity runbook, billing limit preflight, Settings UX, audit events  
- **Implementation:** Per RFC §7: Owner-only initiate; accept by client Owner; move domain/mailboxes/messages/aliases; drop agency mailbox_members; keep API keys/webhooks on agency; SES-coordinated job; fail closed; dual audit.  
- **Tests:** Concurrent transfer rejected; partial SES failure no split-brain; cross-tenant access denied post-cutover; Free plan accept blocked with upgrade CTA.  
- **Acceptance criteria:** Typed domain confirmation; agency loses read immediately on success; mail continues if SES reassigned correctly.  
- **Dependencies:** P2-E1 audit + stable ownership model; real agency demand.

### Other P2 (non-agency)
| Title | Why | Notes |
|-------|-----|-------|
| Better migration automation | IMAP/MBOX import | After public `/migrate` (P1 task 8) honesty |

---

## P3 — Later (demand-gated)

| Title | Why deferred |
|-------|----------------|
| Expand AI | Not acquisition wedge |
| Expand calendar/booking | Adjacent, not core |
| Advanced newsletters | Caps already intentional |
| Deeper automation integrations | After API retention proof |
| White-label client portals / VA product | Stubs exist; RFC non-goal for launch |
| Holding multi-billing workspaces | RFC non-goal until paying Studio asks |
| Enterprise SSO / custom RBAC | RFC non-goals |

---

## Suggested execution order

1. ~~Tasks **1 → 2 → 3** (positioning + trust)~~ ✅ Phase C; ~~**5 → 6 → 4** (security)~~ ✅ Phase B (unit tests + sanitizer + suppressions).  
2. ~~**7**, **14**, **16**~~ ✅ done.  
3. ~~**8 → 9 → 10 → 12 → 11**~~ ✅ done.  
4. ~~**13**~~ ✅ Phase D build done — **human `/vs/*` claim review before publish**; Phase B residuals **B-R1…B-R3 Done**, **B-R4 Deferred**; **15** ✅ done.  
5. P2: **E1 → E2 → E3**; E4 optional; **E5 only after** separate transfer RFC + customer need.

---

## Out of scope for immediate implementation

- Changing plan numeric limits without COGS review.  
- Fabricating testimonials/metrics.  
- Attacking AWS or unverified competitor pricing on `/vs` pages.  
- Building enterprise RBAC, domain transfer, or `domain_members` before P2-E1–E2.  
- Marketing client portals / VA / holding workspace stubs.  
- Rewriting `workspace_id === user_id` ownership model.
