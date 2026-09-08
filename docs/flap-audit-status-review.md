# Flap Audit — Status & Review Board

**As of:** 2026-09-09  
**Repo:** `/Users/sarmaasis/Work/projects/flap`  
**Audience:** Product owner continuing the audit wave  
**Working tree note:** Most audit deliverables and code fixes are **uncommitted** (docs + Phase B/C/D + remaining P0/P1). Commit/review before treating anything as shipped to production.

---

## Snapshot

| Phase | Status | Owner deliverable | Needs human review? |
|-------|--------|-------------------|---------------------|
| **A — Inventory** | **COMPLETE** | `docs/flap-audit-findings.md` + `docs/flap-implementation-plan.md` | Yes — confirm P0/P1 priority order still matches product intent |
| **B — Security** | **COMPLETE** (B-R1…B-R3 done; B-R4 deferred) | `docs/audit-phase-b-security.md` + code/tests | **Yes** — deferred residuals + deploy migrations `0030`/`0031` |
| **C — Positioning** | **COMPLETE** | `docs/audit-phase-c-positioning.md` + Landing / trust pages | **Yes** — copy, FAQ, migrate/why-not-SES claims |
| **D — SEO** | **COMPLETE** (reconciled; claim review before publish) | `docs/audit-phase-d-seo.md` + 7 landings/aliases | **Yes** — human review required for `/vs/*` claims before publish |
| **E — Agency RFC** | **COMPLETE** (design only) | `docs/rfc-agency-workspaces.md` | **Yes** — approve build order P2-E1→E5 before any agency UI |

---

## Done

### Phase A — Inventory
- **`docs/flap-audit-findings.md`** — Full classification vs audit brief; critical issues, strengths, conversion/product gaps.
- **`docs/flap-implementation-plan.md`** — P0→P3 task list with acceptance criteria and suggested execution order.
- **Suppressions API tenancy (inventory fix)** — Workspace-scoped list/delete/counts; newsletter unsubscribe + bounce attribution via outbound `provider_message_id`.

### Phase B — Security / reliability
- **Status: COMPLETE** — see `docs/audit-phase-b-security.md`.
- **Critical fixes landed in tree:** scheduled flush tenancy; SES events HMAC + SNS SubscribeURL allowlist; inbound claim lifecycle (stale reclaim / 503 / early `stored`); send readiness + owner-scoped domain on all `dispatchStoredMessage` paths; soft-bounce 72h TTL; label-delete ownership order; deterministic reply-from; mailbox ACL on undo-send / open-track / quarantine / draft update / calendar RSVP; `canManageSettings` on domain controls; SES HMAC timestamp required; MessageReader CSP + `referrerPolicy` + `sanitizeEmailHtml`; suppressions `user_id` (migration `0030`); global unique domains (migration `0031`); native SNS SigningCertURL + Signature verify (WebCrypto) in addition to Flap HMAC.
- **Tests:** `shared/security-guards.ts`, `shared/security-phase-b.test.ts`, `shared/security-authz.test.ts`, `shared/sanitize-email-html.ts` (wired into `npm run check`).
- **Phase B residuals B-R1…B-R4:**
  | # | Item | Status |
  |---|------|--------|
  | B-R1 | Native AWS SNS signature verify (WebCrypto) | **Done** |
  | B-R2 | Draft update / calendar RSVP mailbox ACL | **Done** |
  | B-R3 | Global unique domain names (migration `0031`) | **Done** |
  | B-R4 | Full D1 HTTP IDOR route harness | **Deferred** |
- **Still deferred (non-blocking):** Amazon CA pin beyond host allowlist; thread-presence workspace scoping; remote-image / tracking UX policy; D1 HTTP IDOR harness (B-R4).
- **Deploy needs:** apply local migrations `0030` + `0031`; run remote migrate before production.

### Phase C — Positioning / conversion
- **`docs/audit-phase-c-positioning.md`** — Before/after classification; §38 acceptance claimed **met**.
- **Homepage repositioned** — `src/pages/Landing.tsx`, `src/content/marketing.ts`: “One inbox for every product you build”; reply-from visual; CTA “Connect your first domain”; adjacent tools demoted.
- **Trust surfaces** — Expanded `src/pages/SecurityPage.tsx` (no fake certs); founder strip; qualitative credibility (no star-fake reviews).
- **New public pages** — `/migrate`, `/why-not-amazon-ses`, `/demo`, `/changelog`; footer + routing/SEO registry wiring.
- **Pricing presentation** — Upgrade-path copy clarified; **numeric plan limits unchanged**.
- **Analytics** — `homepage_view`, `cta_connect_domain`, `migration_page_view`, `pricing_view`, `second_domain_added`.

### Phase D — SEO
- **Status: COMPLETE** (reconciled dual-agent ship) — see `docs/audit-phase-d-seo.md` (§38 Phase D acceptance claimed met; claim-review gate remains).
- **Pages added:** `/email-for-multiple-domains` (pillar), `/email-for-founders`, `/email-for-multiple-saas-products`, `/email-for-venture-studios`, `/how-to-manage-email-for-multiple-domains`, `/how-to-send-email-from-multiple-domains`, `/google-workspace-multiple-domains`.
- **Aliases (301):** `/one-inbox-multiple-domains`, `/one-inbox-for-multiple-businesses` → `/multiple-domains-one-inbox`; `/email-for-agencies` → `/for/agencies`; `/email-for-portfolio-founders` → `/email-for-founders`; `/custom-domain-email-for-side-projects` → `/email-for-side-projects`; `/flap-vs-zoho-mail` → `/flap-vs-zoho`; `/flap-vs-folio` → `/folio-alternative`; `/flap-vs-fastmail` → `/vs/fastmail`.
- **Deferred (intentionally):** `/flap-vs-mxroute`, `/flap-vs-mailhow`; mass programmatic SEO; deep competitor price tables.
- **Tech SEO:** homepage brand meta; `Flap Email` entity/`og:site_name`; robots auth paths; soft-404 no canonical; Worker loops `SEO_PATHS`/`SEO_REDIRECTS`; registry H1 ↔ `POSITIONING_THESIS`; `wrangler.jsonc` `run_worker_first` synced; validators enforce unique meta + path sync.
- **Human review required:** re-verify numeric / limit claims on existing `/vs/*` (and research) pages **before publish**. Do not lift publish freeze on competitor claims without that review.

### Phase E — Agency
- **`docs/rfc-agency-workspaces.md`** — Current team/shared-inbox model, gaps, target model, phased P2-E1…E5 (no production schema migration in this phase).

### P0 leftovers — completed this pass
| # | Task | Status |
|---|------|--------|
| 4 | Suppressions schema `user_id` + backfill | **Done** — `migrations/0030_suppressions_tenancy_inbound.sql`; unique `(user_id, email)`; writers require attributed owner; send checks workspace-scoped |
| 5 | Full authz / IDOR / reply-from **route** tests | **Done (unit contract)** — `shared/security-authz.test.ts` covers mailbox ACL, message/attachment WHERE, reply-from, sending-ready; still no D1/miniflare HTTP suite |
| 6 | HTML sanitizer (DOMPurify-class) | **Done** — `sanitizeEmailHtml` wraps `isomorphic-dompurify` (DOMPurify); MessageReader keeps sandbox+CSP |
| 7 | Durable inbound failure / operator timeline UX | **Done (minimal)** — `inbound_ingest_log` + domain `last_inbound_*` columns; Settings Deliverability shows last inbound error |

### P1 leftovers — completed this pass
| # | Task | Status |
|---|------|--------|
| 9 | No-signup interactive demo | **Done** — `/demo` front-end only |
| 12 | Public changelog (+ richer status) | **Done** — `/changelog`; Status links changelog + manual notes |
| 13 | Core SEO intent pages (Phase D) | **Done** — landings + aliases; **human `/vs/*` claim review before publish** |
| 14 | `second_domain_added` activation event | **Done** — client + `afterDomainAdded` / analytics allowlist |
| 15 | In-product deliverability event timeline | **Done** — Settings Delivery tab lists `/api/delivery-events` |
| 16 | Mobile domain/mailbox filter parity | **Done** — domain `<select>` on `max-lg` in `MailFolderRail` |

---

## In progress / incomplete

### Conversion gaps still real (post–Phase C + later P1)
- Automated mailbox import (IMAP/Gmail Takeout) — `/migrate` narrative + Settings export only.
- Real customer social proof — correctly omitted (no fabricated metrics).
- Optional inbox UX polish (badge / “sent to” copy) — not blocking.

### Phase B remaining risks
B-R1…B-R3 **Done**. Still deferred: **B-R4** D1 HTTP IDOR harness; Amazon CA pin; thread-presence scoping; remote-image UX policy.

### P2 / P3
- Agency **implementation** not started (RFC only). Order: E1 → E2 → E3; E4 optional; E5 only after separate transfer RFC + real demand.
- P3 (AI/calendar/newsletter expansion, white-label, holding workspaces, SSO) demand-gated — do not start in this wave.

---

## Requires your review

1. **Commit / deploy gate** — Review Phase B + migrations `0030` + `0031` before production (local migrate; remote migrate before prod).
2. **Suppressions product rule (decided in code)** — Per-workspace `user_id`; unattributed bounce/complaint does **not** create a suppression or block sends. Confirm this matches intent vs SES-account-global blocks.
3. **Positioning copy sign-off** — Walk `/`, `/demo`, `/migrate`, `/why-not-amazon-ses`, `/security`, `/changelog`.
4. **SEO `/vs/*` claim review before publish** — Human re-verify competitor prices/limits/claims on existing `/vs/*` pages; Phase D landings are built but publish freeze remains on unverified competitor claims. New `/email-for-*` / how-to / Workspace education pages are OK to treat as Phase D–complete once copy is spot-checked.
5. **Plan limits** — Keep `shared/plans.ts` numbers unchanged.
6. **Agency RFC approval** — P2-E1 next when ready.
7. **Phase B deferred** — B-R4 D1 HTTP IDOR harness; Amazon CA pin; thread-presence scoping; remote-image UX policy (as capacity allows).

---

## Recommended next work order

1. Human review + commit of this wave (esp. Phase B + migrations `0030` + `0031`; remote migrate before prod).  
2. **Human `/vs/*` claim review** before lifting competitor-claim publish freeze (Phase D build is complete).  
3. Optional Phase B deferred: B-R4 D1 HTTP IDOR harness; Amazon CA pin; thread-presence scoping; remote-image UX policy.  
4. Later P2: **E1 → E2 → E3** per RFC.

---

## Key artifacts

| Path | Role |
|------|------|
| `/Users/sarmaasis/Downloads/FLAP_CURSOR_PRODUCT_AUDIT.md` | Source brief |
| `docs/flap-audit-findings.md` | Phase A master findings |
| `docs/flap-implementation-plan.md` | Master P0–P3 plan |
| `docs/audit-phase-b-security.md` | Phase B security audit + fixes |
| `docs/audit-phase-c-positioning.md` | Phase C positioning / conversion |
| `docs/audit-phase-d-seo.md` | Phase D SEO (COMPLETE; `/vs/*` claim review before publish) |
| `docs/rfc-agency-workspaces.md` | Phase E agency RFC |
| `docs/flap-audit-status-review.md` | This status board |
| `docs/mail-architecture.md` | Factual source for security / why-not-SES claims |
| `migrations/0030_suppressions_tenancy_inbound.sql` | Suppressions `user_id` + inbound failure log |
| `migrations/0031_global_unique_domains.sql` | Global unique domain names |

---

## Known risks / do-not-do

- **Do not** change plan numeric limits without economics / COGS review.
- **Do not** fabricate metrics, testimonials, star ratings, or certifications.
- **Do not** encode competitor prices/limits/claims on `/vs` pages without re-verifying at publish time.
- **Do not** attack AWS; keep `/why-not-amazon-ses` as product-layer explanation.
- **Do not** market client portals, VA invites, or holding-workspace stubs.
- **Do not** jump to domain transfer (P2-E5) or enterprise RBAC before E1–E2.
- **Do not** rewrite `workspace_id === user_id` ownership model casually.
- **Do not** claim one-click Gmail/IMAP import on `/migrate`.
- **Do not** loosen MessageReader iframe sandbox without the sanitizer in place.
- **Do not** enable `SES_INBOUND_ALLOW_UNSIGNED` in production without understanding poison/SSRF risk.
- **Phase B deferred:** B-R4 D1 HTTP IDOR harness; Amazon CA pin; thread-presence scoping; remote-image UX policy. (B-R1 SNS verify, B-R2 draft/RSVP ACL, B-R3 global unique domains — **Done**.)
