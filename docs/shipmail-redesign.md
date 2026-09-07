# Flap redesign PRD: absorb Shipmail north star

**Status:** Product + engineering brief for a single mega-PR direction 
**Product:** Flap ([useflap.online](https://useflap.online)) · repo [github.com/sarmaasis/flap](https://github.com/sarmaasis/flap) 
**Inspiration (not a fork / not a new product):** [shipmail.to](https://shipmail.to) 
**Audience:** Founder (Ashish) + eng implementing one cohesive redesign track 
**Date:** 2026-09-07 
**Sources:** Shipmail public site, `/pricing`, `/security`, `/llms.txt`, `/for/*`, `/vs/*`, `/tools/*`, `/blog/*`, `/research/*` (verified 2026-09-07). Flap baseline from `README.md`, `shared/plans.ts`, `docs/feature-list.md`, `docs/mail-architecture.md`, `docs/imap-decision.md`.

**Hard rules for this doc**
- This is a **redesign of Flap**, not a new SaaS name or parallel product.
- Customer mail stays **Amazon SES**. Cloudflare stays app + system mail (`useflap.online`). Do not market Flap as "Cloudflare email."
- Default visual system = Shipmail-clean tokens below. Keep Flap teal / Fraunces **only if the founder explicitly insists**; otherwise replace.
- No em dashes in shipping copy that follows this PRD.
- Cite Shipmail prices exactly when comparing.

---

## 1. Executive summary - Flap absorbs the Shipmail north star

### North star (one sentence)

**Flap becomes the portfolio-founder email OS that Shipmail already sells to small teams: custom-domain mailboxes, unified webmail, shared inboxes, AI that drafts but never silent-sends, automations + API/MCP, and (staged) calendars / newsletters / open protocols - still priced for people who own many domains.**

### What "absorb" means

| Keep from Flap | Steal from Shipmail | Drop / demote |
|----------------|---------------------|---------------|
| Multi-domain portfolio wedge (domains as first-class quota) | Flat, comparable plan cards; shared-inbox ops; AI assistant beta; API/SDK/CLI/MCP story; booking/calendar path; newsletter path; security language | Teal+Fraunces as default identity; domain-only storytelling that hides mailbox/send math; marketing IMAP before it ships |
| SES honesty + any-DNS setup | 3-minute onboarding shape; paper/orange/ink UI; `/for` `/vs` `/tools` `/blog` SEO machine | Vague "priority support" without SLAs |
| Studio seats, referrals, DNS tools, filters, aliases, webhooks | Catch-all + aliases pool; delivery routing; forwarding confirm; automations definitions | Cold-outbound / full ESP ambitions |
| Vite SPA + Worker + D1/R2 | Shipmail's feature *surface* and IA, not their Rust MTA | Claiming EU-hosted Rust engine we do not run |

### Positioning rewrite

**Before:** One inbox for every startup you build. Domain-first plans.

**After (Shipmail-shaped, Flap-owned):** 
Professional email on every domain you ship. Shared inboxes, AI drafts, automations, and an API - from a flat monthly price. Set up in minutes. Leave anytime.

**ICP (unchanged, sharpened):** Indie hackers, serial founders, tiny studios/agencies who outgrew Cloudflare Email Routing / ImprovMX and refuse Google Workspace seat tax. Shipmail ICP (solo founders + small teams) overlaps heavily; Flap differentiates on **many domains per org** (Shipmail caps paid orgs at **50 custom domains**) and on SES + Cloudflare app stack already in production.

### Success metrics (90 days post mega-PR)

1. Signup → first green MX / first receive ≤ 10 minutes median (Shipmail claims ~3 minutes UI + 5-10 minutes DNS).
2. Paid conversion from Free ≥ baseline + 25% after Solo price cut + onboarding rewrite.
3. Support tickets about "wrong From" and "is IMAP ready?" down after From-lock + honest protocol dates.
4. Organic: `/tools/*` and `/vs/*` pages indexed; at least 8 new Shipmail-clone SEO URLs live.
5. Zero silent AI sends. Zero fake protocol claims on marketing.

### Opinion (implementable)

Shipmail is the clearest **business-email-host** packaging in 2026 for under-$30 flat plans. Flap already has a deeper *portfolio* product than Hydra/Folio. The redesign is packaging + feature parity toward Shipmail, **not** abandoning multi-domain. Win the comparison table: *cheaper entry than Workspace, more domains than Shipmail, more team/API depth than Hydra/Folio.*

---

## 2. Shipmail feature inventory (complete from research)

Research date: **2026-09-07**. Pricing numbers from [https://shipmail.to/pricing](https://shipmail.to/pricing). Product surface from homepage, docs, security, llms.txt, for/vs/blog pages.

### 2.1 Core hosting

| Feature | Shipmail behavior | Notes |
|---------|-------------------|-------|
| Custom domains | Up to **50** per paid org, **no per-domain fee**; Free dashboard orgs can add up to **2** domains before pay | Plan limit is **mailboxes**, not domains |
| Real mailboxes | Unique address with own inbox, login, storage | Distinct from aliases |
| Aliases | **2 aliases per mailbox** pooled org-wide | Alias ≠ mailbox |
| Catch-all | Supported | Domain-level |
| Shared inboxes | Built-in; assignments, internal notes, collision/waiting workflow | Replaces Front/Missive for light ops |
| Unified webmail | All mailboxes/domains in one UI; reply From correct address | |
| Delivery routing | keep / fixed / round_robin with fallback; OOO skip; 24h attention notify | Advanced ops |
| Forwarding | Up to 3 destinations; confirm link; optional sender filter; local copy kept | |
| Import / migration | Upload import with cancel / resume / restore; fingerprint resume | Heavy |
| Plus-addressing | Plus-primary routing rules documented | |

### 2.2 Protocols and clients

| Feature | Included |
|---------|----------|
| Webmail | Yes |
| IMAP + SMTP | Yes (any client: Apple Mail, Outlook, Thunderbird, etc.) |
| JMAP | Yes |
| CalDAV calendars | Yes |
| CardDAV contacts | Yes |
| Portability | Export; open protocols; cancel end-of-period | |

### 2.3 Calendar and booking

| Feature | Behavior |
|---------|----------|
| Calendar per mailbox | Full calendar |
| Booking pages | Availability-based booking |
| Meet links | Google Meet / Zoom connect |
| Team week overlay | See teammates before scheduling |
| Invitation languages | `en` / `fr` / `es` |
| Calendar API | Events CRUD + availability | |

### 2.4 Newsletters

| Feature | Behavior |
|---------|----------|
| Built-in newsletters | Every paid plan |
| Block editor | HTML issues or plain text |
| Audiences / subscribers | Plan-capped active subscribers |
| Sends | Separate from regular email quota |
| Collaboration | Pro/Team/Scale: teammates on drafts with owner-controlled access |
| Media storage | 2 / 5 / 10 GB by plan |
| Atom/feed API | Audience feeds, rotate/revoke |
| Newsletter domains | Sending subdomains; Reply-To flexibility |
| Preflight / test / schedule | Full workflow |
| Pacing | Sends pace to protect reputation | |

### 2.5 AI assistant (beta)

| Capability | Guardrail |
|------------|-----------|
| Ask inbox questions with source emails | |
| Cleanup: file + draft replies | Confirmation; drafts only |
| Automations in plain language (product) | API uses explicit definitions, not NL compile |
| Writing style from examples | |
| Agent draft/schedule newsletters | Human review |
| Included on every **paid** plan | No per-seat AI fee |
| Never silent-send | Drafts folder; bulk changes confirm; undo window (Shipmail: undoable bulk changes up to 7 days on assistant docs) |

### 2.6 Automations, API, agents

| Surface | Details |
|---------|---------|
| REST API | Domains, mailboxes, messages, threads, webhooks, members, analytics (safe projection), newsletters, calendar, automations, forwarding, delivery routing, imports |
| Auth | Scoped Bearer keys `sm_live_` / `sm_test_`; MCP also OAuth 2.0 |
| SDKs | Official TypeScript + Python |
| CLI | Official |
| Webhooks | HMAC-signed; delivery/bounce/reply events |
| MCP server | Official hosted MCP for AI agents |
| Idempotency | `Idempotency-Key` on POST |
| Automations API | Scheduled + event definitions; draft mode; mailbox scope |
| Message analytics | Privacy-stripped incremental sync API |
| Track reply / Waiting workflow | Thread-level `track_reply` | |

### 2.7 Team, storage, spam, privacy

| Feature | Details |
|---------|---------|
| Team members | Dashboard login seats (1 / 5 / unlimited by plan) |
| Storage | 15 GB Solo/Pro; 25 GB Team/Scale; add-ons to 25 GB or 100 GB |
| Spam protection | Spamhaus DNSBL, Bayesian, phishing heuristics, greylisting (marketed) |
| Encryption | TLS in transit; at-rest; optional user-held OpenPGP/S/MIME mailbox encryption |
| Hosting claim | EU-hosted (Frankfurt primary), Rust mail engine |
| No ads / no scanning for ads | Explicit security page promises |
| Export + delete | Account deletion; audit logs retained scrubbed |

### 2.8 Commercial packaging (cited)

Canonical: [https://shipmail.to/pricing](https://shipmail.to/pricing)

| Plan | Monthly | Annual | Mailboxes | Storage / mailbox | Regular sends / mo | Aliases | Team members | Newsletter sends / mo | Active subscribers |
|------|---------|--------|-----------|-------------------|--------------------|---------|--------------|----------------------|--------------------|
| Free | $0 | n/a | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| Solo | **$4/mo** | **$40/yr** | 2 | 15 GB | 20,000 | 4 | 1 | 1,000 | 500 |
| Pro | **$9/mo** | **$90/yr** | 4 | 15 GB | 40,000 | 8 | 5 | 5,000 | 2,500 |
| Team | **$29/mo** | **$290/yr** | 12 | 25 GB | 120,000 | 24 | Unlimited | 25,000 | 10,000 |
| Scale | **$2.50 / mailbox / mo** | **$25 / mailbox / yr** | 13-300 | 25 GB | 10,000 / mailbox | 2 / mailbox | Unlimited | 25,000 | 10,000 |

**Add-ons (Shipmail):** Solo/Pro mailbox → 25 GB total **$5/mo** ($50/yr); any paid mailbox → 100 GB **$10/mo** ($100/yr); Pro extra mailbox (up to 6) **$3/mo**; +10k newsletter sends **$10/mo**; +10k active subscribers **$10/mo**.

**Trial:** 14-day free trial, card required, not charged until end; newsletter sending unavailable on trial; trial mailboxes/sends capped (Solo 2 / Pro 3 / Team 3 / Scale 3 mailboxes; 100 regular sends).

**Included every paid plan (Shipmail):** up to 50 domains, 2 aliases/mailbox, REST+SDKs+CLI+webhooks+MCP, webmail+IMAP+SMTP+JMAP+calendars+contacts, shared inboxes, newsletters, booking pages, catch-all, filtering, spam setup, AI assistant beta.

### 2.9 Marketing / SEO surface (Shipmail)

See §6 for the clone map. Inventory summary: `/for` (11 ICPs), `/vs` (9 comps), `/tools` (7+), `/blog` (16+ posts), `/research` (cost + AI agents + methodology), `/docs`, `/security`, `/pricing`, `llms.txt`.

---

## 3. Pricing comparison: Flap vs Shipmail + recommended Flap moves

### 3.1 Flap baseline today (domain-first)

Source: Flap `README` / `shared/plans.ts` (2026-09).

| Plan | Price / mo | Domains | Mailboxes | Storage | Sends / mo | Seats | Notes |
|------|------------|---------|-----------|---------|------------|-------|-------|
| Free | $0 | 1 | 2 | 25 MB | 100 | 1 | Footer; explore usable mail |
| Solo | $9 | 3 | 10 | 2 GB | 500 | 1 | Catch-all |
| Builder (highlighted) | $19 | 10 | 30 | 15 GB | 2,000 | 1 | API + webhooks |
| Studio | $39 | 40 | 100 | 50 GB | 10,000 | up to 10 | Shared inboxes |

Annual: −20% via `DODO_PRODUCT_*_ANNUAL` (Flap). Shipmail annual = 10× monthly ($40 / $90 / $290).

### 3.2 Head-to-head optics

| Buyer need | Shipmail | Flap today | Winner today |
|------------|----------|------------|--------------|
| Cheapest paid start | **$4 Solo** / 2 mailboxes | **$9 Solo** | Shipmail |
| Many domains | Cap **50** | Free→Studio **1 / 3 / 10 / 40** | Flap story, but Solo/Builder under-sell vs Hydra |
| Team seats | Pro 5 / Team unlimited | Studio max **10** | Shipmail Team |
| Send volume | Solo **20k** regular | Solo **500** | Shipmail (huge optics gap) |
| Storage | 15-25 GB / mailbox | 25 MB-50 GB **pooled** | Shipmail clarity |
| Newsletters | Included paid | Not a product | Shipmail |
| IMAP/JMAP/CalDAV | Included paid | Deferred to **2026-10-15** | Shipmail |
| Free with real mailbox | Free = **0 mailboxes** | Free = **2 mailboxes** | **Flap** (keep this) |
| AI included | Paid | Not first-class | Shipmail |

### 3.3 Recommended Flap pricing moves (opinionated, shippable)

**Goal:** Match Shipmail *sticker clarity* and undercut Workspace, without throwing away Flap's domain wedge or Free-with-mailbox advantage.

#### New catalog (rename for comparison tables)

| Plan | Monthly | Annual | Domains | Mailboxes | Storage (pooled org) | Regular sends / mo | Seats | Newsletter (when P1 ships) |
|------|---------|--------|---------|-----------|----------------------|--------------------|-------|----------------------------|
| Free | $0 | n/a | 2 | 2 | 500 MB | 200 | 1 | Off (footer on) |
| Solo | **$5** | **$50** | 5 | 4 | 5 GB | 5,000 | 1 | 500 sends / 200 subs |
| Pro | **$12** | **$120** | 15 | 12 | 25 GB | 25,000 | 5 | 5,000 / 2,500 |
| Team | **$29** | **$290** | 40 | 30 | 75 GB | 100,000 | Unlimited | 25,000 / 10,000 |
| Scale | **$2.50 / mailbox** | **$25 / mailbox / yr** | 50 included, then +$1/domain or contact | 13-300 | 25 GB / mailbox equiv | 10,000 / mailbox | Unlimited | Team newsletter caps |

**Why not copy Shipmail $4 / $9 / $29 verbatim:** Flap's COGS are SES + R2 + support on a Cloudflare Worker stack with smaller reputation moat. $5 Solo still beats Flap's $9 and sits next to Shipmail Solo $4 without a race-to-the-bottom on 15 GB/mailbox promises we cannot keep on day one. **$29 Team** matches Shipmail Team sticker for SEO and sales calls.

**Mandatory optics fixes even if founder rejects full rename:**

1. Cut Solo **$9 → ≤ $5** or raise Solo value to ≥ Shipmail Solo (2+ mailboxes *and* ≥5k sends, ≥2 GB).
2. Raise Free to **2 domains**, **500 MB**, **200 sends** so Hydra Free does not win the trial by default.
3. Publish **send** and **storage** numbers on every plan card (Shipmail does; Flap undersells).
4. Keep Free **with mailboxes** (do not copy Shipmail Free = 0 mailboxes). That is Flap's conversion wedge.
5. Add **14-day paid trial** option for Pro/Team (card required) *in addition to* Free, or keep Free-only if Dodo trial is painful - but then raise Free usability.
6. Annual = **10× monthly** (Shipmail) *or* keep −20%; pick one and put it on the card. Prefer 10× for clean "$50/yr Solo" math.

#### Add-ons (phase with storage reality)

- Storage bump packs: +10 GB **$3/mo**, +50 GB **$10/mo** (do not promise 100 GB/mailbox until R2 economics + retention UI exist).
- Newsletter packs (when newsletters ship): +10k sends **$10/mo** (match Shipmail citation).
- Extra domain packs on Pro: +10 domains **$5/mo** before forcing Team.

#### Positioning line for pricing page

> Flat plans. Domains included. No per-seat tax. Free includes real mailboxes - unlike hosts that charge before you can receive mail.

#### Explicit non-goals

- Do not go to $49/year unlimited (JustEmails war).
- Do not adopt pure per-mailbox Scale until mailbox login + IMAP path exists.
- Do not promise Shipmail's 15 GB **per mailbox** until storage accounting is per-mailbox in product.

---

## 4. UI/UX tokens (Shipmail-clean default)

**Default decision:** Replace Flap teal + Fraunces with Shipmail-clean warm system below. Founder veto only.

### 4.1 Color tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--paper` | `#FAF9F6` | App + marketing background |
| `--ink` | `#141211` | Primary text, icons |
| `--orange` / `--cta` | `#F26522` | Primary buttons, links, focus rings, logo mark |
| `--ink-muted` | `#141211` at 64% / `#5C5652` | Secondary text |
| `--line` | `#141211` at 10-12% | Borders, dividers |
| `--paper-elevated` | `#FFFFFF` | Cards on paper |
| `--ok` | `#0a7b6f` | MX green / success (Shipmail uses similar teal *as status only*) |
| `--warn` | `#C47A10` | Deliverability caution |
| `--danger` | `#B42318` | Destructive |

**Do not** use teal as brand chrome. Teal = status only. 
**Do not** use cold SaaS gray (`#F8FAFC` + indigo). Paper must feel warm.

### 4.2 Typography

| Role | Family | Notes |
|------|--------|-------|
| UI + marketing body | **Inter** | Variable; tight tracking on H1 (−0.02em) |
| Code, DNS records, API | **JetBrains Mono** | Copyable DNS blocks, curl snippets |
| Display (optional) | Inter semibold only | **No Fraunces** unless founder insists |

### 4.3 Spacing / chrome

- 8px grid; marketing max width ~1120-1200px; app inbox denser than marketing.
- Radius: 10-12px cards; pills 999px for domain chips.
- Shadows: soft warm, not blue-tinted.
- Motion: 120-180ms ease; no gratuitous page fades.

### 4.4 Product UX principles (Shipmail + Flap)

1. Identity before content (domain chip / accent on every row).
2. From-lock on reply (hard to send wrong identity).
3. Keyboard-first (Cmd+K, j/k triage) - Flap already planned; keep.
4. Setup ends in green "receiving" + test send.
5. AI drafts only; human approve.
6. Marketing whitespace; **app density**.

### 4.5 Implementation checklist

- Global CSS variables in app + marketing.
- Replace Fraunces imports; self-host Inter + JetBrains Mono (or approved CDN with font-display swap).
- Re-skin Landing, Pricing, Auth, App shell, DNS wizard in one PR theme pass.
- Update OG images / favicon to orange-on-paper.
- Screenshot refresh for homepage feature strip.

---

## 5. Logo / brand direction

### Direction

**Name stays Flap.** Wordmark + simple mark. Visual language follows Shipmail-clean (paper field, orange accent, ink type), not a Shipmail clone logo.

### Mark

- Geometric **envelope flap** or abstract **F** with a lifted corner (literal flap).
- Single-color orange `#F26522` on paper; inverted paper-on-ink for dark footer only if needed.
- Avoid teal orb, gradient mesh, 3D glossy icons.

### Wordmark

- Inter SemiBold / Bold, optical kerning, lowercase `flap` or title `Flap` - pick one and stick (recommend **Flap** title case in UI, `flap` in logo lockup only if it reads cleaner).
- Clear space = 0.5× cap height.
- Do not combine Fraunces display + Inter body in logo lockups.

### Voice

- Short, concrete, founder-direct (Shipmail tone).
- Honest architecture: "Amazon SES for your domains. Cloudflare for the app."
- Never claim Rust EU MTA, end-to-end encryption like Proton, or IMAP before ship date.

### Deliverables in mega-PR

1. SVG mark + wordmark + favicon set.
2. `/public/brand/` usage notes (1 page).
3. Replace old teal assets in `public/` and marketing prerender.

---

## 6. SEO / blog / tools / vs / for map to clone for Flap

Clone **information architecture**, not Shipmail prose. Keep Flap URLs that already rank; add Shipmail-shaped hubs.

### 6.1 Hub routes to add (Flap)

| Hub | Path | Purpose |
|-----|------|---------|
| ICP index | `/for` | Index of ICP pages |
| Compare index | `/vs` | Index of comparisons |
| Tools index | `/tools` | Already exists - expand |
| Blog | `/blog` | Already exists - expand |
| Research | `/research` | Cost tables + methodology |
| Security | `/security` | Trust page (Shipmail-strength) |
| Docs | `/docs` | Product + API |

### 6.2 `/for/*` (clone Shipmail set; Flap-angled)

Shipmail live: accountants, agencies, consultants, creators, developers, ecommerce, freelancers, law-firms, nonprofits, real-estate, startups.

**Flap P0 `/for` pages:**

| Path | Angle |
|------|-------|
| `/for/indie-hackers` | Multi-domain portfolio (Flap native) |
| `/for/startups` | Shared support@ vs Workspace seats |
| `/for/freelancers` | $5 Solo / client domains |
| `/for/developers` | API, webhooks, MCP roadmap |
| `/for/agencies` | Client domains + Studio/Team seats |
| `/for/ecommerce` | orders@ + transactional API (honest caps) |
| `/for/creators` | Newsletter path when ready |

**P1:** consultants, nonprofits, real-estate, law-firms, accountants (thin pages OK if templated).

### 6.3 `/vs/*` (clone + Flap-native comps)

Shipmail live: fastmail, front, google-workspace, microsoft-365, migadu, missive, proton-mail, yandex-360, zoho-mail.

**Flap must ship:**

| Path | Priority |
|------|----------|
| `/vs/google-workspace` | P0 (map existing `/flap-vs-google-workspace`) |
| `/vs/microsoft-365` | P0 |
| `/vs/zoho-mail` | P0 (map `/flap-vs-zoho`) |
| `/vs/shipmail` | P0 (honest: domains vs mailbox-flat; SES vs their stack) |
| `/vs/hydra` | P0 (map `/hydra-alternative`) |
| `/vs/folio` | P0 (map `/folio-alternative`) |
| `/vs/migadu` | P1 |
| `/vs/fastmail` | P1 |
| `/vs/improvmx` | P1 |
| `/vs/cloudflare-email-routing` | P0 (map existing alternative URL) |
| `/vs/missive` `/vs/front` | P2 (shared-inbox narrative) |

Use **canonical redirects** from old flat URLs to `/vs/*` where needed.

### 6.4 `/tools/*`

Shipmail: mx-lookup, spf-checker, dkim-checker, dmarc-checker, email-health, google-workspace-cost-calculator, migration-planner.

Flap already has checkers + calculator + more in sitemap. **Keep and complete:**

| Tool | Status |
|------|--------|
| MX / SPF / DKIM / DMARC checkers | Keep |
| Email setup checker | Keep |
| Workspace cost calculator | Keep |
| Header analyzer, blacklist, DMARC generator, SPF flattener, deliverability scorecard | Finish if partial |
| **Migration planner** (CF Routing / Gmail / ImprovMX → Flap) | **Add (Shipmail clone)** |
| Email health (combo score) | Align naming with Shipmail `email-health` |

Every tool CTA: "Fix this in the Flap DNS wizard."

### 6.5 `/blog/*` topics to clone (Flap voice)

Shipmail posts to mirror (titles adapted):

- Best email hosting for small teams 2026
- Gmail / Outlook alternatives
- Custom domain email setup guide
- Cloudflare Email Routing vs real hosting
- Email forwarding vs real hosting
- Email hosting for multiple domains
- Email API for AI agents
- Ecommerce email setup
- Professional email address examples
- Shared mailbox vs distribution list
- Migrate from Gmail to Flap
- How Flap protects your email
- AI assistant included (when AI ships)
- Self-hosted vs managed
- GoDaddy email alternatives

### 6.6 `/research/*`

- `/research/business-email-cost/2026` - table vs Workspace / M365 / Zoho / Shipmail / Flap
- `/research/methodology`
- `/research/email-for-ai-agents/2026` (P1)

### 6.7 Existing Flap URLs to retain

Keep crawl equity: `/email-for-indie-hackers`, `/email-for-side-projects`, `/email-hosting-for-multiple-domains`, `/custom-domain-email`, `/guides/*`, `/tools/*`. Link them from new hubs.

---

## 7. Feature requirements P0 / P1 / P2

**Rule:** All Shipmail features are **targets**. Heavy items called out. Do not market undelivered protocol/calendar/newsletter surfaces.

### Legend

- **Already / partial:** Flap has some form
- **Heavy:** multi-sprint infrastructure (IMAP/JMAP/CalDAV/newsletters)

### 7.1 P0 - mega-PR must land (product feels Shipmail-shaped)

| ID | Requirement | Notes |
|----|-------------|-------|
| P0-1 | Shipmail-clean theme tokens + logo pass | §4-5 |
| P0-2 | Pricing catalog update in `shared/plans.ts` + Dodo products | §3 |
| P0-3 | Onboarding flow rewrite | §8 |
| P0-4 | From-lock + domain color identity | Already on Flap backlog |
| P0-5 | Shared inbox v1: multi-seat access, assignment, basic collision warn | Studio/Team |
| P0-6 | Security page `/security` | Honest SES/CF claims |
| P0-7 | SEO hubs: `/for` `/vs` + 6 P0 pages | §6 |
| P0-8 | AI draft assist (confirm-only): summarize + draft reply | §10; no auto-send |
| P0-9 | Webhook hardening: signed payloads, retries, delivery log | Partial exists |
| P0-10 | Export + cancel trust copy (30-day export window) | |
| P0-11 | Deliverability basics per domain: bounce/complaint banner | SES signals |
| P0-12 | Cmd+K + keyboard triage | Flap backlog |
| P0-13 | Honest IMAP date in Settings + no false marketing | Keep **2026-10-15** or update once |
| P0-14 | llms.txt / pricing numbers sync | |

### 7.2 P1 - 30-90 days (parity path)

| ID | Requirement | Heavy? |
|----|-------------|--------|
| P1-1 | IMAP + SMTP app passwords per mailbox | **Heavy** |
| P1-2 | CalDAV calendar sync + booking pages v1 | **Heavy** |
| P1-3 | CardDAV contacts | **Heavy** |
| P1-4 | Newsletters v1: audiences, block editor, caps, double opt-in | **Heavy** |
| P1-5 | JMAP (evaluate after IMAP; may defer to P2) | **Heavy** |
| P1-6 | TypeScript SDK + OpenAPI publish | |
| P1-7 | MCP server (read + draft-with-confirm; scoped send later) | |
| P1-8 | Automations: rules UI + webhook triggers; scheduled digests | |
| P1-9 | Delivery routing (round robin) | |
| P1-10 | Confirmed forwarding | |
| P1-11 | Migration planner tool + Gmail/CF import wizard | |
| P1-12 | AI cleanup + writing style packs | |
| P1-13 | Unlimited seats on Team | Pricing gated |
| P1-14 | Python SDK + CLI | |

### 7.3 P2 - moat / full Shipmail surface

| ID | Requirement | Heavy? |
|----|-------------|--------|
| P2-1 | Full newsletter collaboration + Atom feeds + media pipeline | **Heavy** |
| P2-2 | JMAP complete + calendar invitation languages | **Heavy** |
| P2-3 | User-held OpenPGP/S/MIME at-rest encryption | **Heavy** |
| P2-4 | Scale per-mailbox billing | |
| P2-5 | Message analytics privacy API | |
| P2-6 | Agency client portal / VA time-box | |
| P2-7 | SSO SAML/OIDC | |
| P2-8 | BIMI / MTA-STS / TLS-RPT wizard depth | |
| P2-9 | Reputation isolation modes | |
| P2-10 | Native mobile after IMAP | |

### 7.4 Explicit defer (do not smuggle into mega-PR)

- Cold outbound sequences / warmup product
- Claiming EU Rust MTA
- Auto-send AI agents
- Per-mailbox 15 GB promises without storage accounting
- Marketing CalDAV/newsletters on homepage before P1 flags flip

---

## 8. Onboarding flow (Shipmail-like)

### Target time

**UI under 3 minutes** to "records copied." **First successful receive** usually 5-15 minutes (DNS). Copy should say that honestly (Shipmail: ~3 minutes setup, 5-10 minutes first send depending on DNS).

### Steps

1. **Signup** - Clerk magic link only (no Google/GitHub in Flap UI). Minimal fields.
2. **Create org** - name + optional company size (startup / solo / agency) for `/for` personalization.
3. **Add domain** - own domain first; optional "buy domain" later (do not block).
4. **DNS checklist** - MX, SPF, DKIM (SES). Copy buttons in JetBrains Mono. Registrar deep links (reuse Flap guides).
5. **Verify loop** - separate states: identity verified / DKIM live / MX receiving. No single fake "Connected."
6. **Create mailboxes** - suggest `you@`, `hello@`, `support@` with one click. Catch-all default ON with plain explanation.
7. **Test receive + test send** - force both before confetti.
8. **Invite teammates** (Team/Pro) - skip available on Solo.
9. **Optional:** connect calendar (when P1), create API key, enable AI assist opt-in.
10. **Paywall moment** - if Free limits hit, show Solo $5 upgrade with mailbox/domain math vs Workspace.

### Empty states

- First inbox: three sample threads (local-only demos) **or** zero + strong CTA to send test from phone - prefer real test over fake demos.
- Post-MX green: referral share card (Flap growth loop).

### Anti-patterns

- Dumping all DNS records without order.
- Allowing compose before domain verified (except shadow/pre-MX probe).
- Skipping receive test.

---

## 9. Security

### Public commitments Flap should make (only if true)

| Promise | Flap truth to implement / document |
|---------|-------------------------------------|
| No ads, no ad scanning of mail | Product + privacy policy |
| No sale of email content | Privacy policy |
| TLS everywhere | App + SES transit |
| Encryption at rest | R2 / D1 / SES stores - document providers |
| Export anytime | P0 export |
| Delete account deletes customer data | Implement + document retention for audit logs |
| Open protocols, no lock-in | After IMAP ships; until then say webmail + export |
| Spam/phishing filtering | SES + additional filters; do not claim Spamhaus/Rust unless true |
| Abuse rate limits | Keep auth email rate limits; extend to outbound |

### `/security` page structure (clone Shipmail IA)

1. We don't read your email for ads 
2. We don't sell behavioral mail data 
3. Your data stays yours (export/delete) 
4. How deliverability is configured (SPF/DKIM/DMARC) 
5. Portability 
6. Concrete controls (TLS, at-rest, brute-force, rate limits) 
7. Infrastructure honesty: **Cloudflare Workers/D1/R2 + Amazon SES**; regions as configured 
8. FAQ: not Proton-style E2E; GDPR contact path 

### Engineering P0 security tasks

- HMAC webhook signatures verified in docs + UI sample 
- App password hashing when IMAP ships 
- Session hardening already via Better Auth - audit 
- Attachment malware scan = P1/P2 (do not claim now) 
- Optional user-held encryption = P2 only 

---

## 10. AI features

### Principles

1. **Opt-in per mailbox.** 
2. **Drafts only** until explicit user send. 
3. Show source threads for Q&A answers. 
4. Log AI actions in thread activity. 
5. Plan-gate quotas (Free: off or tiny; Solo: low; Pro/Team: higher). 
6. Never train marketing claims on private mail without policy.

### Shipmail-like feature set for Flap

| Feature | Priority | Behavior |
|---------|----------|----------|
| Thread summarize | P0 | Side panel |
| Draft reply in voice | P0 | Insert into TipTap draft |
| Ask inbox ("what did Alex say about X?") | P1 | Citations required |
| Cleanup agent (file + draft) | P1 | Confirm plan before apply; undo |
| Writing style from N examples | P1 | |
| NL → filter/automation suggestion | P1 | Compile to explicit rule user saves |
| Newsletter draft | P2 | After newsletters exist |
| MCP tools for agents | P1 | list domains, unread, fetch summary, create draft; send requires confirm token |

### Non-goals

- Silent auto-send 
- Autonomic bulk archive without undo 
- "Agent runs your company email" homepage hype without MCP + confirm UX 

---

## 11. Engineer brief - single mega-PR

### Title

`feat: Shipmail-north-star redesign (theme, pricing, onboarding, P0 product)`

### Scope in (mergeable slices behind flags if needed)

1. **Design tokens + brand assets** (CSS variables, fonts, logo, OG). 
2. **Pricing** (`shared/plans.ts`, marketing cards, Dodo product IDs, README). 
3. **Onboarding wizard** rewrite (domain → DNS → mailbox → test). 
4. **Inbox identity** (colors, From-lock, unread-per-domain). 
5. **Keyboard** (Cmd+K, triage, `?`). 
6. **Shared inbox assignments** v1 (Team/Studio). 
7. **AI draft/summarize** confirm-only (feature flag). 
8. **Security page + pricing/SEO hubs** (`/security`, `/for`, `/vs` stubs + P0 content). 
9. **Webhook delivery log + signatures**. 
10. **Export/trust pack**. 
11. Docs: this PRD linked from `docs/`; update `imap-decision.md` pointer; `mega-pr-matrix.md` checklist.

### Scope out (follow-up PRs)

- IMAP/JMAP/CalDAV/CardDAV servers (**Heavy**) 
- Full newsletters (**Heavy**) 
- Python SDK / CLI / Scale billing 
- OpenPGP at-rest 

### Suggested PR description checklist

```text
## Summary
- Absorb Shipmail north star into Flap (not a new product)
- Paper/orange/ink theme; Inter + JetBrains Mono
- Pricing move toward Solo $5 / Pro $12 / Team $29 (+ Free upgrades)
- Onboarding + From-lock + shared inbox v1 + AI drafts
- SEO hubs /security /for /vs

## Test plan
- [ ] Plan gates match shared/plans.ts
- [ ] DNS wizard green path on a real domain
- [ ] From-lock prevents wrong-domain reply
- [ ] AI never sends without confirm
- [ ] Free footer still on Free
- [ ] No IMAP claims on marketing routes
- [ ] Prerender + sitemap includes new hubs
- [ ] Dodo test checkout for new product IDs
```

### File touch map (expected)

- `src/` marketing + app shell + inbox 
- `worker/` plan enforcement, webhooks, AI routes 
- `shared/plans.ts` 
- `public/` brand, llms.txt 
- `docs/shipmail-redesign.md` (this file) 
- `docs/mega-pr-matrix.md` 

### Sequencing inside the PR (eng order)

1. Tokens/fonts (unblocks everything visual) 
2. plans.ts + billing IDs 
3. Onboarding + DNS states 
4. From-lock + domain colors 
5. Keyboard 
6. Shared inbox assignments 
7. AI flag 
8. Marketing SEO pages 
9. Security + trust/export 
10. Screenshot + prerender 

### Definition of done

- Founder can click through signup → MX green → shared support@ reply on paper/orange UI. 
- Pricing page cites clear numbers next to Shipmail $4/$9/$29 narrative without lying. 
- `docs/shipmail-redesign.md` is the living checklist; matrix updated Done/Partial/Deferred.

---

## 12. Risks (deliverability moat)

### The moat we do not have yet

Shipmail markets a dedicated mail engine (Rust), EU hosting story, paced newsletter sending, and mature spam/auth defaults. Flap sends on **shared Amazon SES** reputation (account/domain identities). That is fine early; it is **not** a moat.

### Concrete risks

| Risk | Failure mode | Mitigation |
|------|--------------|------------|
| SES account-level reputation burn | One abusive tenant pauses many domains | Per-domain pause; complaint thresholds; Free send caps; block cold-outbound product |
| Copying Shipmail newsletter volume | Spam complaints, ISP blocks | Hard caps; double opt-in; separate newsletter subdomain; pace sends; trial newsletter off |
| Marketing high send limits (20k) before warm | Bounces | Ramp limits; new domain warm mode; require DKIM+DMARC before high tier |
| Catch-all spam flood | Storage + support cost | Catch-all rate limits; junk folder; optional captcha contact forms |
| IMAP before auth hygiene | Password spray | App passwords, IP rate limits, fail2ban-class controls |
| AI hallucination in replies | Brand damage | Drafts only; citations; easy discard |
| Pricing too low vs support load | Churn + burnout | Keep Free capped; Team at $29; Scale only when ops ready |
| Theme change alienates early users | "Where did teal go?" | Founder note in changelog; optional temporary theme flag (default paper) |
| Over-claiming security | Trust collapse | `/security` only states true controls |
| Competing on Shipmail's 15 GB/mailbox | COGS blowup | Pooled storage until per-mailbox metering exists |

### Deliverability workstream (parallel to mega-PR)

1. Per-domain SES metrics dashboard (P0-11). 
2. Auto-pause on complaint spike. 
3. DMARC/BIMI/MTA-STS education in DNS wizard. 
4. Suppression list visibility. 
5. Honest "shared infrastructure" language until dedicated IPs exist (dedicated IPs = later, expensive).

### Strategic bet

**Product + UX + SEO can be absorbed from Shipmail quickly. Deliverability trust cannot.** Flap should win on multi-domain founder UX and speed of setup, while treating reputation ops as a first-class engineering surface - not a support footnote.

---

## Appendix A - Shipmail citation block (paste-ready)

> Shipmail public pricing (USD, new subscriptions, verified 2026-09-07 from https://shipmail.to/pricing): Free $0 (0 mailboxes); Solo **$4/mo** or **$40/yr** (2 mailboxes, 15 GB/mailbox, 20,000 regular sends, 1 member, 1,000 newsletter sends, 500 subscribers); Pro **$9/mo** or **$90/yr** (4 mailboxes, 15 GB, 40,000 sends, 5 members, 5,000 newsletter sends, 2,500 subscribers); Team **$29/mo** or **$290/yr** (12 mailboxes, 25 GB, 120,000 sends, unlimited members, 25,000 newsletter sends, 10,000 subscribers); Scale **$2.50/mailbox/mo** for 13-300 mailboxes. Add-ons include storage bumps and +10k newsletter sends or subscribers at **$10/mo**. Every paid plan includes up to 50 domains, AI assistant beta, API/SDKs/CLI/webhooks/MCP, webmail, IMAP, SMTP, JMAP, calendars, contacts, shared inboxes, newsletters, booking pages.

## Appendix B - Flap architecture reminder

| Layer | System |
|-------|--------|
| App | Cloudflare Workers + D1 + R2 + Assets |
| System mail (`useflap.online`) | Cloudflare SEB / Email Routing |
| Customer mail | Amazon SES inbound + outbound |
| Auth | Better Auth |
| Billing | Dodo Payments |

## Appendix C - Related Flap docs

- `docs/feature-list.md` - prior P0/P1/P2 backlog (merge, do not discard) 
- `docs/competitive-ux-guide.md` - Hydra/Folio UX 
- `docs/marketing-research.md` - competitor pricing 
- `docs/imap-decision.md` - IMAP dated defer 
- `docs/mail-architecture.md` - SES 
- `docs/mega-pr-matrix.md` - track Done/Partial/Deferred 

---

**End of PRD.** Implement P0 in one mega-PR; schedule Heavy protocol/newsletter work as explicit follow-ups. Default brand = paper `#FAF9F6`, orange `#F26522`, ink `#141211`, Inter + JetBrains Mono.
