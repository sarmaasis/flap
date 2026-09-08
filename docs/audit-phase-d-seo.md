# Phase D — SEO findings & delivery (reconciled)

**Scope:** Technical SEO audit + highest-intent core landing pages (audit §§14–16, 33–34, 35 P1 SEO, §36 Phase D).  
**Date:** 2026-09-09  
**Site:** https://useflap.online  
**Note:** Two Phase D agents shipped overlapping work. This doc reflects the **reconciled final state** (union of valuable pages + shared tech SEO). No competitor claim pages invented; homepage hero not rewritten.

---

## Executive summary

Flap already had solid SEO infrastructure (central registry, prerender, sitemap generation, validation tests, `/for` + `/vs` hubs, and several commercial SEO landings). Phase D:

1. Fixed brand/entity metadata and crawl hygiene.
2. Shipped **seven** high-intent landings with distinct `primaryIntent` (pillar + audience + education cluster).
3. Consolidated audit keyword URLs via **301 aliases** (no thin duplicate pages).
4. Synced Worker / `wrangler` routing to `SEO_PATHS` + `SEO_REDIRECTS`.

**Publish gate:** human re-verify numeric / limit claims on existing `/vs/*` (and research) pages before lifting the competitor-claim publish freeze. New `/email-for-*` / how-to / Workspace education pages do not invent competitor prices.

---

## 1. Technical SEO audit

### Already strong

| Area | Status |
|------|--------|
| Unique titles / descriptions / H1s | Enforced by `scripts/validate-seo.ts` + `scripts/seo.test.ts` |
| Canonical URLs | `setPageMeta` + prerender inject; registry `canonicalPath === path` |
| Open Graph + Twitter cards | Registry-driven PNG OG images under `/og/` |
| `sitemap.xml` | Generated from SEO registry (`src/content/sitemap.ts`) |
| `robots.txt` | Allow marketing; disallow private app/auth |
| Structured data | Organization / SoftwareApplication / FAQ / Article / WebPage builders in `src/lib/jsonld.ts` |
| Prerender | Build-time HTML for marketing/SEO routes (`scripts/prerender.ts` + `scripts/render-public.ts`) |
| Private path hygiene | Auth/app paths absent from sitemap; 404 shell is `noindex` |

### Issues found & fixed

| Issue | Severity | Fix |
|-------|----------|-----|
| Homepage title/description did not match audit brand entity pattern | Medium | `MARKETING.seo_title` / `seo_description` → **Flap — One Inbox for All Your Custom Domains** + audit description; mirrored in `index.html` |
| Ambiguous brand “Flap” in schema / social | Medium | `PRODUCT_ALTERNATE_NAME` = **Flap Email**; Organization + SoftwareApplication `alternateName`; `og:site_name` → **Flap Email** |
| Homepage registry H1 lagged thesis | Low | Registry home `h1` ↔ `POSITIONING_THESIS` |
| `robots.txt` missing `/sso-callback` and `/auth/` | Low | Added `Disallow` rules |
| Soft-404 HTML claimed canonical `https://useflap.online/404` | Low | Removed canonical from `public/404.html` (keeps `noindex`) |
| Worker SEO routes hardcoded (easy to miss new pages) | Medium | Worker loops `SEO_PATHS` + `SEO_REDIRECTS` from `shared/client-routes.ts` |
| `wrangler.jsonc` `run_worker_first` drift | Medium | Synced exact SEO paths into `run_worker_first` |
| Path sync drift risk between defs and routes | Low | Validation + test assert `SEO_PAGE_DEFS` keys ≡ `SEO_PATHS` |

### Not changed / acceptable

- **Duplicate-ish hubs:** Thin `/vs/*` and `/for/*` pages coexist with deeper `/flap-vs-*` and audience SEO pages. Different depth; left in place. Prefer deepening `/vs` hubs later (after claim review) rather than deleting.
- **Homepage visible H1** remains Phase C copy; metadata/title/description aligned for brand SEO — **hero not rewritten**.
- **No mass schema additions** (BreadcrumbList, Product) where UI does not show matching chrome.

---

## 2. Brand / entity consistency

| Surface | Choice |
|---------|--------|
| Product name | **Flap** |
| Alternate / disambiguator | **Flap Email** |
| Homepage title | **Flap — One Inbox for All Your Custom Domains** |
| Homepage description | Manage email for every SaaS, side project, client, or business domain from one inbox… |
| `og:site_name` | Flap Email |
| Registry home H1 | `POSITIONING_THESIS` (“One inbox for every product you build.”) |

Remaining consistency work (not blocking): social directory bios, Product Hunt listing text, and any third-party launch pages should reuse the same entity string.

---

## 3. Pages shipped (reconciled union)

All paths live in `SEO_PAGE_DEFS`, `SEO_PATHS`, App routes, Worker, `wrangler` `run_worker_first`, sitemap, and OG assets.

### Commercial / audience

| Path | Intent | Distinct from |
|------|--------|----------------|
| `/email-for-multiple-domains` | **Pillar** — commercial “email for multiple domains” | Hosting (`/email-hosting-for-multiple-domains`), workflow (`/multiple-domains-one-inbox`) |
| `/email-for-founders` | Audience — portfolio / serial founders | `/email-for-indie-hackers`, `/for/startups` |
| `/email-for-multiple-saas-products` | Audience — multi-product SaaS operators | Pillar (generic multi-domain); side projects; agencies |
| `/email-for-venture-studios` | Audience — studio + portfolio company domains | Founders; `/for/agencies` (client vs portfolio) |

### Education / how-to

| Path | Intent | Distinct from |
|------|--------|----------------|
| `/how-to-manage-email-for-multiple-domains` | Operating playbook (inventory → DNS → cutover) | Pillar commercial landing |
| `/how-to-send-email-from-multiple-domains` | Send-side identity / SPF-DKIM / reply-from | Manage how-to (ops vs send) |
| `/google-workspace-multiple-domains` | Education: Workspace multi-domain model vs Flap | `/flap-vs-google-workspace`, calculator, cost blog |

### Alias redirects (not new pages)

| From | To | Why |
|------|----|-----|
| `/one-inbox-multiple-domains` | `/multiple-domains-one-inbox` | Audit keyword URL; page already exists |
| `/one-inbox-for-multiple-businesses` | `/multiple-domains-one-inbox` | Same intent family |
| `/email-for-agencies` | `/for/agencies` | Avoid thin duplicate of hub |
| `/email-for-portfolio-founders` | `/email-for-founders` | Synonym → founders page |
| `/custom-domain-email-for-side-projects` | `/email-for-side-projects` | Synonym → side projects |
| `/flap-vs-zoho-mail` | `/flap-vs-zoho` | Path alias |
| `/flap-vs-folio` | `/folio-alternative` | Covered by alternative page |
| `/flap-vs-fastmail` | `/vs/fastmail` | Thin hub until claims verified |

Wiring: `SEO_REDIRECTS` in `shared/client-routes.ts`, Worker 301, App soft-redirect, sitemap **excludes** aliases.

---

## 4. Pages deferred (with reasons)

| Audit candidate | Reason |
|-----------------|--------|
| `/flap-vs-mxroute`, `/flap-vs-mailhow` | Competitor claims/prices not re-verified — skip spammy comparisons (§14, §34) |
| Deep `/flap-vs-fastmail` comparison | Thin `/vs/fastmail` hub + alias only until claims verified |
| Mass programmatic SEO / thin keyword farms | Explicitly avoid (§34) |
| Deep competitor price tables on new pages | Claim-review gate; calculator/blog already cover illustrative math |
| Generic productivity / AI email / “future of email” | Explicitly avoid (§34) |

**Not deferred (kept after reconciliation):** SaaS products, venture studios, send how-to, and Workspace multi-domain education — each has unique intent + non-thin body (earlier “defer for cannibalization” note was superseded by shipped content).

Existing coverage already meeting adjacent intent:

- `/email-for-indie-hackers`, `/email-for-side-projects`, `/custom-domain-email`
- `/email-hosting-for-multiple-domains`, `/multiple-domains-one-inbox`
- `/flap-vs-google-workspace`, `/flap-vs-zoho`, alternative pages, `/for/*`, `/vs/*`

---

## 5. Claim-review gate (before publish)

- [ ] Human re-verify competitor prices, limits, and feature claims on existing `/vs/*` and deep comparison pages
- [ ] Do **not** invent mxroute/MailHow comparison pages until facts are checked
- [ ] Spot-check new Phase D landings for product-facts alignment (plans, IMAP honesty, no fake SLAs)
- [ ] Optional: Search Console submit updated sitemap; monitor 301 aliases

---

## 6. Remaining SEO work (non-blocking)

1. **Prerender in CI/deploy** — ensure `npm run build` (prerender + `validate:seo`) runs before ship.
2. **Deepen thin `/vs` hubs** only where competitor facts are verified.
3. **Internal linking pass** from homepage / pricing FAQ once Phase C sign-off is final (link to pillar).
4. **Optional later pages** from §14 education list, one at a time, after Search Console shows query gaps.
5. **OG regeneration** if social previews look stale (`npm run generate:og`).
6. Optional: generate `run_worker_first` from `client-routes` to prevent future drift.

---

## 7. Files changed (Phase D)

### Content / routes
- `src/content/seo-pages.ts` — seven new pages + related links + `primaryIntent`
- `src/content/marketing.ts` — brand SEO title/description; `SEO_PAGES` list
- `src/content/seo-registry.ts` — `SITE_MODIFIED`; home H1 ↔ thesis
- `src/content/seo-paths.ts` — re-exports redirects
- `shared/client-routes.ts` — `SEO_PATHS` + `SEO_REDIRECTS`
- `shared/product-facts.ts` — alternateName / entity tagline
- `src/lib/jsonld.ts` — Organization + SoftwareApplication entity fields
- `src/lib/seo.ts` — `og:site_name`
- `src/components/MarketingShell.tsx` — footer links to pillar / founders / SaaS / manage how-to
- `src/App.tsx` — alias soft-redirect + SEO path set
- `worker/index.ts` — dynamic SEO routes + 301 redirects
- `wrangler.jsonc` — `run_worker_first` SEO paths
- `index.html` — homepage meta/title/`og:site_name`
- `public/robots.txt`, `public/404.html`, `public/sitemap.xml`
- `public/og/*` — images for new routes
- `scripts/prerender.ts` — `og:site_name`
- `scripts/validate-seo.ts`, `scripts/seo.test.ts` — path sync + redirect target checks
- `docs/audit-phase-d-seo.md` — this file (reconciled)

---

## 8. Acceptance checklist

- [x] Technical SEO hygiene fixes (canonical soft-404, robots auth paths, brand meta, Worker/`run_worker_first` sync)
- [x] Pillar `/email-for-multiple-domains` + six supporting landings live in defs, routes, registry, sitemap
- [x] Audit keyword URLs handled via 301 aliases (no thin duplicates)
- [x] No fabricated competitor pricing/claims on new pages
- [x] Homepage hero not rewritten
- [x] `npm run test:seo` + `validate:seo` pass
- [ ] Human `/vs/*` claim review before publish (remaining gate)
