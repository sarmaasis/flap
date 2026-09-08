# Phase C — Positioning / conversion audit

**Scope:** Homepage, pricing clarity, FAQ accuracy, trust surfaces, migration explanation, why-not-SES, founder trust, conversion instrumentation.  
**Source:** `FLAP_CURSOR_PRODUCT_AUDIT.md` §§3–8, 9–13, 17–18, 29–32, 35 (P0/P1 conversion), §36 Phase C, §38.  
**Thesis:** One inbox for every product you build. Many domains → one place → correct sender identity. Do **not** lead with calendar/newsletter/AI bundle.  
**Date:** 2026-09-08.

Classification key: `WELL EXPOSED` | `POORLY EXPOSED` | `PARTIAL` | `NOT IMPLEMENTED` | `N/A`.

---

## Classification (before → after)

| Item | Before | After / notes |
|------|--------|---------------|
| §3 Homepage thesis / hero | **POORLY EXPOSED** — “Every project. One calm inbox”; subhead led with AI/newsletters/API | **Fixed** — hero = “One inbox for every product you build”; reply-from visual; CTA “Connect your first domain” |
| §4 Reply-from as signature feature | **PARTIAL** — product correct (`replyFromAddress` → locked From); marketing buried | **Fixed** on homepage (dedicated section + hero proof). Product correctness left to Phase B |
| §5 Domain context in inbox UI | **PARTIAL** — filters/chips exist in app; homepage mock lacked domain labels | **Marketing fixed** (domain-labeled inbox mock). App UX audit remains Phase B |
| §6 Category clarity (not suite bundle) | **POORLY EXPOSED** — calendar/newsletter/AI/API as peer hero sections | **Fixed** — adjacent tools demoted to “Once domains are connected” |
| §7 Trust routes `/security` `/privacy` `/terms` `/docs` `/status` | **WELL EXPOSED** routes; security page thin | **Improved** — expanded `/security` (no false certs); footer links include migrate/why-not-SES; privacy/terms/docs/status unchanged & linked |
| §8 Domain onboarding clarity | **PARTIAL** — product wizard exists; homepage didn’t explain 4 steps | **Marketing fixed** (Add → DNS → Verify → Receive/send). Deep DNS UX = Phase B |
| §9 `/migrate` | **NOT IMPLEMENTED** | **Added** — honest cutover: verify first, no auto IMAP import, .mbox/JSON export, MX switch, rollback |
| §10 Public interactive demo | **NOT IMPLEMENTED** | **Gap at Phase C close** — static reply-from mock on homepage only; full no-signup demo later shipped at `/demo` (see Post-completion update) |
| §11 Pricing presentation | **PARTIAL** — limits clear; upgrade “why” weak; prerender said Builder/Studio | **Improved** — capacity dial copy on `/pricing` + homepage teasers; prerender plan names fixed. **Numeric limits unchanged** |
| §12 Workspace cost calculator | **WELL EXPOSED** — `/tools/google-workspace-cost-calculator` | Linked from homepage pricing band; no rewrite |
| §13 Why not Amazon SES | **NOT IMPLEMENTED** | **Added** `/why-not-amazon-ses` |
| §17 Proof / credibility | **POORLY EXPOSED** — star-rated “quotes” looked like fake reviews | **Fixed** — qualitative trust cards, no stars/fake metrics |
| §18 Founder trust | **PARTIAL** — `/about` strong; homepage absent | **Fixed** — homepage founder strip + About accuracy tweak |
| §29 Homepage structure | **POORLY EXPOSED** | **Aligned** to suggested sections (problem → reply-from → how → inbox → use cases → adjacent → pricing → trust → FAQ → CTA) |
| §30 FAQ set | **PARTIAL** — good but incomplete vs objections | **Rewritten** to §30 questions; answers match shipped behavior |
| §31 Conversion instrumentation | **PARTIAL** — many events; `pricing_view` unused; no connect CTA event | **Easy wins** — `homepage_view`, `cta_connect_domain`, `migration_page_view`, `pricing_view` on `/pricing` |
| §32 Activation definition | **N/A (product)** | Documented as remaining; analytics already has domain/mail funnel events |

---

## Code / content changed

### Routes added
- `/migrate` — `src/pages/MigratePage.tsx`
- `/why-not-amazon-ses` — `src/pages/WhyNotSesPage.tsx`

Wired in: `src/App.tsx`, `shared/client-routes.ts`, `worker/index.ts`, `scripts/render-public.ts`, `scripts/prerender.ts`, `src/content/seo-registry.ts`, `public/robots.txt`, `scripts/generate-llms.ts`.

### Primary surfaces
- `src/pages/Landing.tsx` — repositioned structure + FAQ
- `src/content/marketing.ts` — thesis-first copy; credibility without fake stars
- `shared/product-facts.ts` — positioning paragraph + `POSITIONING_THESIS`
- `src/pages/SecurityPage.tsx` — expanded accurate sections
- `src/pages/PricingPage.tsx` — upgrade-path clarity + `pricing_view`
- `src/pages/AboutPage.tsx` — no longer claims “not Calendar” incorrectly
- `src/components/MarketingShell.tsx` — footer Product links
- `src/lib/analytics.ts` + `worker/lib/analytics.ts` — new event names

---

## §38 Acceptance criteria

| Criterion (≈10s) | Status |
|------------------|--------|
| For people with multiple domains/projects | **Met** (hero + problem + who) |
| All domains from one inbox | **Met** |
| Replies use appropriate address | **Met** (hero + signature section + FAQ) |
| No separate account per project | **Met** |
| Connecting a domain is straightforward | **Met** (how-it-works) |
| Clear reason to trust | **Met** (trust + security + founder + status links) |
| Obvious next action | **Met** (“Connect your first domain”) |

---

## Remaining conversion gaps

*(As of Phase C close, 2026-09-08 — see Post-completion update below for later P1 closes.)*

1. **Interactive no-signup demo** (§10) — not shipped; homepage static mock only.
2. **Automated mailbox import** — `/migrate` is narrative only; Settings export exists; no IMAP/Gmail Takeout importer marketed.
3. **Real social proof** — still no customer counts/testimonials (correctly omitted).
4. **Public changelog** — not added (P1 trust; optional later).
5. **Activation instrumentation depth** — `second_domain_added` as a first-class funnel event not added; server already tracks `domain_added`.
6. **Inbox product UX polish** (§5) — filters exist; further badge/“sent to” copy is Phase B, not marketing.
7. **Phase D SEO landings** — not owned here; homepage may link to existing `/email-for-*` / `/vs/*` when present.

---

## Post-completion update (2026-09-09)

Later P0/P1 agents closed several items that Phase C left open. **Do not treat the list above as current:**

| Phase C “remaining” | Later status |
|---------------------|--------------|
| §10 Interactive demo | **Shipped** — `/demo` (`DemoPage.tsx`), linked from homepage + footer |
| Public changelog | **Shipped** — `/changelog`; Status links changelog |
| `second_domain_added` | **Shipped** — client track + `afterDomainAdded` / analytics allowlist |
| Founder strip | **Present** on homepage (`Landing.tsx` `#founder`) — may have been re-edited after Phase C |

**Still open after reconciliation:** automated mailbox import (honest `/migrate` only); real customer social proof (intentionally omitted); Phase D SEO sign-off (owned by Phase D agent); residual inbox UX polish outside marketing.

---

## Out of scope (intentionally)

- Plan numeric limit changes
- Phase D new SEO routes under `/email-for-*` and `/vs/*` creation
- Fabricated metrics or competitor prices
- Full interactive demo app
- Changing reply-from product logic (already maps to receiving mailbox)

---

## How to verify

1. Open `/` — thesis hero, reply-from visual, no calendar/newsletter as peer heroes; founder strip; link to `/demo`.
2. Open `/migrate`, `/why-not-amazon-ses`, `/security`, `/pricing`, `/about`, `/demo`, `/changelog`.
3. Footer → Demo / Migrate / Why not SES? / Security / Privacy / Terms / Docs / Status / Changelog.
4. Analytics: homepage fires `landing_view` + `homepage_view`; CTA fires `cta_connect_domain`; `/pricing` fires `pricing_view`; second domain fires `second_domain_added`.
