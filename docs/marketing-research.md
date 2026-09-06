> Looking for the rich new-feature list? See docs/feature-list.md

# Flap Marketing Research - Competitors, Pricing, Features, Free Tools

**Date:** 2026-09-06  
**Product:** [useflap.online](https://useflap.online) · [github.com/sarmaasis/flap](https://github.com/sarmaasis/flap)  
**Audience:** Founder / product / GTM decisions for Flap  
**Companion doc:** `docs/competitive-ux-guide.md` (UX roadmap); this doc owns pricing, competitors, feature backlog, and SEO free tools.

---

## 1. Executive summary and positioning

**What Flap is:** Hosted multi-domain email for indie hackers, serial founders, and small studios. One web inbox across every project domain. Domain-first plans (Free / Solo / Builder / Studio), not Google Workspace-style per-seat tax.

**Architecture truth to sell honestly:** Cloudflare hosts the *app* (Workers, D1, R2; SEB for system auth mail). Customer inbound/outbound mail runs on **Amazon SES**. DNS is registrar-agnostic. Do not market Flap as "Cloudflare email"; that confuses buyers comparing you to Cloudflare Email Routing.

**Positioning line:**  
> One inbox for every startup you build. Real domain mail (SES), not Gmail forwarding. Built for founders who ship many projects.

**Market shape:** Three buyer clusters compete for the same founder:

1. **Portfolio inboxes (direct):** Hydra, Folio: color-coded multi-domain webmail, auto reply-From, founder SEO. Primary competitors.
2. **Cheap full hosts / flat annual:** JustEmails, TrekMail, Migadu, Purelymail, MXroute: IMAP-first, price wars, less founder UX story.
3. **Pipes and giants:** CF Email Routing, ImprovMX, Forward Email, Porkbun mail add-ons, Google Workspace, Zoho, Microsoft 365, Fastmail, Proton: either free forwarders or seat-tax suites.

**Opinionated takeaway (do this):**

1. **Raise Free usability** so Hydra's "3 domains free forever (reply-only)" does not win the trial by default. Give Free enough storage, sends, and preferably **2 domains** so someone can prove the product on a real portfolio.
2. **Match Hydra Builder domain count at $19** (20 domains). Flap Builder today is 10 domains at the same price; that is a silent loss on comparison tables.
3. **Weaponize Studio seats** against Folio's single-operator model. Folio is cheaper for solos; Flap Studio (up to 10 seats, shared inboxes) is the team/studio moat.
4. **Own SEO free tools** (MX, SPF, DKIM, DMARC, headers, blacklists, Workspace calculator). Tools already ship; expand the set and rank for "check MX / SPF / DMARC" intent that founders search before they buy email.

Flap is **not behind on product depth** (folders, labels, filters, aliases, Studio seats, referrals, API keys, inbound webhooks, TipTap compose, DNS wizard). Flap is behind on **price-table optics vs Hydra**, **Free generosity**, and **identity/keyboard UX polish** (covered in the UX guide). Pricing and SEO tools are the GTM levers in this document.

---

## 2. Current Flap baseline plans

Source of truth: `shared/plans.ts` (Worker quotas + marketing UI). Domain-first catalog. Storage = D1 message bodies + R2 attachments. Send quota = successful outbound sends per UTC calendar month.

| Plan | Price / mo | Domains | Mailboxes | Aliases | Storage | Sends / mo | API keys | Webhooks | Seats | Notes |
|------|------------|---------|-----------|---------|---------|------------|----------|----------|-------|-------|
| **Free** | $0 | 1 | 2 | 5 | 25 MB | 100 | 0 | 0 | 1 | Sent with Flap footer; rules, contacts, signatures, export & restore |
| **Solo** | $9 | 3 | 10 | Unlimited (cap 10k) | 2 GB | 500 | 5 | 3 | 1 | Catch-all; no Flap footer |
| **Builder** | $19 (highlighted) | 10 | 30 | Unlimited (cap 50k) | 15 GB | 2,000 | 25 | 15 | 1 | Catch-all & filters; API + webhooks; priority support marketed |
| **Studio** | $39 | 40 | 100 | Unlimited (cap 100k) | 50 GB | 10,000 | 100 | 50 | up to 10 | Shared inboxes; mailbox delegation & roles |

**Marketing features currently advertised (from plan cards):**

- Free: 1 custom domain, 2 mailboxes, 5 aliases, 25 MB, 100 sends/mo, rules/contacts/signatures, export & restore, 1 seat, Flap footer.
- Solo: 3 domains, 10 mailboxes, unlimited aliases, 2 GB, 500 sends/mo, catch-all, no footer, 1 seat.
- Builder: 10 domains, 30 mailboxes, unlimited aliases & disposables, 15 GB, 2,000 sends/mo, catch-all & filters, API keys + webhooks, priority support, 1 seat.
- Studio: 40 domains, 100 mailboxes, unlimited aliases, 50 GB, 10,000 sends/mo, up to 10 team seats, shared inboxes (support@, hello@), delegation & roles, priority support.

**Baseline gaps vs direct comps (optics):**

- Free is tight (1 domain, 25 MB, 100 sends) vs Hydra Free (3 domains, 1 GB, reply-only outbound) and Folio Preview (1 domain, 100 sends).
- Builder at $19 offers **10 domains**; Hydra Builder at $19 offers **20 domains**. Same sticker, half the domain story.
- Solo at $9 is above Folio Solo (~$2.99-$3.50) and near Hydra Starter ($10 / 5 domains). Need clearer value (API/webhooks start earlier, or lower Solo, or raise Free so Solo feels like an upgrade not a tax).
- Studio seats are a real differentiator Folio does not sell; Hydra Pro is unlimited domains / single-operator leaning. Lead with seats + shared inboxes.

**Referrals (growth loop already shipped):** invitee connects a domain → referrer gains +1 domain permanently. Keep prominent after verify.

---

## 3. Exhaustive competitor map

For each: URL, offers, pricing numbers (as of research date 2026-09-06; verify before publishing comparison pages), ICP, Flap attack angle.

### Direct: portfolio multi-domain inboxes

#### Hydra - https://hydra.mx

| | |
|--|--|
| **Offers** | Unified color-coded inbox; catch-all; auto reply-From; 5-minute DNS story; honest "CF Routing is fine for 1 domain"; 30-day export on cancel; annual −20% |
| **Pricing** | **Free:** 3 domains, unlimited addresses, 1 GB, reply-to-inbound only (no cold outbound). **Starter $10/mo** ($120/yr): 5 domains, 10 GB, send new mail. **Builder $19/mo** ($228/yr): **20 domains**, 50 GB, API, higher send cap. **Pro $39/mo** ($468/yr): unlimited domains, 200 GB, highest send cap, priority support. Storage overage $2/10 GB on paid. |
| **ICP** | Indie hackers, ADHD serial shippers, portfolio founders who outgrew CF Routing |
| **Flap attack** | Match identity UX and Free trial usefulness; **match Builder at 20 domains / $19**; beat on Studio seats, filters, webhooks depth, referrals, SEO tools. Do not race only on free domain count. |

#### Folio - https://folioinbox.com

| | |
|--|--|
| **Offers** | Single-operator multi-domain webmail; per-domain color/reputation; auto reply-From; strong solo-founder SEO and Workspace-alternative content; Stripe billing; Preview free |
| **Pricing** | **Preview free:** 1 domain, ~100 sends. **Solo:** ~$3.50/mo or **~$2.99/mo annual** - up to 3 domains, ~1,000 sends/mo. **Studio:** ~$15/mo or **~$12/mo annual** - up to 10 domains, ~6,000 sends/mo. **Holding Co.:** ~$39/mo or **~$29/mo annual** - unlimited domains, ~30,000 sends/mo, priority support / onboarding. **Single-user** across all plans. |
| **ICP** | Holding-company-of-one, solo founders, multi-LLC operators who refuse Workspace seats |
| **Flap attack** | Cannot win pure solo price war at $2.99. Win on **team Studio seats**, API/webhooks, filters, referrals, Free tools SEO. Copy Folio's identity clarity and trust language; keep Studio as the moat. |

### Flat / cheap full hosts (price pressure)

#### JustEmails - https://justemails.app

| | |
|--|--|
| **Offers** | Unlimited domains + mailboxes; unified inbox; IMAP/SMTP/POP3; SPF/DKIM/DMARC/MTA-STS setup; team RBAC; migration; 1k transactional API emails/mo |
| **Pricing** | **$49/year** flat (~$4.08/mo). 10 GB included; +100 GB blocks ~$100/yr. 7-day trial. |
| **ICP** | Agencies and founders who want cheapest unlimited domains with classic protocols |
| **Flap attack** | Compete on founder UX (identity, web compose, filters, webhooks), SES deliverability story, and Studio collaboration - not on $49/yr. Publish "when JustEmails is enough vs when Flap is worth it." |

#### TrekMail - https://trekmail.net

| | |
|--|--|
| **Offers** | Flat / pooled storage business email; many domains; optional Drive-like add-ons; MSP/agency skew |
| **Pricing** | **Free (Nano):** ~10 domains, ~5 GB pooled. **Starter ~$3.50/mo (~$42/yr):** ~50 domains, ~15 GB. **Pro ~$10/mo (~$96/yr):** ~100 domains, ~50 GB, API. **Agency ~$23.25/mo (~$279/yr):** 1,000+ domains, ~200 GB+. |
| **ICP** | MSPs, agencies billing clients, volume mailbox shops |
| **Flap attack** | Different ICP. Steal "flat vs per-seat" messaging only. Flap stays portfolio-operator inbox, not reseller hosting. |

#### Mektup - https://usemektup.com

| | |
|--|--|
| **Offers** | Real IMAP/SMTP hosting + webmail; contact forms; REST API; **MCP server for AI agents**; multi-domain one account |
| **Pricing** | **Free:** 1 domain, ~3,000 emails/mo, ~3 GB/domain. **Paid from ~$20/mo:** e.g. 10 domains, ~50k emails/mo, ~5 GB/domain (confirm on site before quoting). Higher tiers for agencies/unlimited. |
| **ICP** | Developers and AI-agent builders who want mailboxes as API/MCP tools |
| **Flap attack** | Flap already has API keys + inbound webhooks. Productize developer story harder; consider MCP later. Win on founder inbox UX and Studio; watch Mektup on AI-agent SEO. |

#### Mailflo - https://mailflo.co

| | |
|--|--|
| **Offers** | Cold-email infrastructure: managed Google/MS mailboxes, warmup, DNS health, blacklist monitoring, domain masking - not a founder unified inbox |
| **Pricing** | From ~**$56/mo** (10 mailboxes) up through ~$144/mo (30) and ~$400/mo (100); annual discounts ~20% |
| **ICP** | SMB/cold outreach teams |
| **Flap attack** | Adjacent only. Stay reply-and-support first; avoid cold-outbound reputation risk. Optional later: deliverability monitoring features without becoming a spam shop. |

### Forwarders and pipes

#### ImprovMX - https://improvmx.com

| | |
|--|--|
| **Offers** | Email forwarding + paid SMTP; aliases; rules; API; webhooks |
| **Pricing** | **Free:** 1 domain, 25 aliases, 500 forwards/day. **Premium $9/mo:** up to 30 domains, SMTP sends. **Pro $24/mo:** up to 100 domains. **Light $50/yr:** up to 5 domains. Custom enterprise. |
| **ICP** | People who want aliases into Gmail, not a new inbox |
| **Flap attack** | Compete on real inbox UX and send identity, not forwarding price. Landing: "outgrew ImprovMX / CF Routing." |

#### Forward Email - https://forwardemail.net

| | |
|--|--|
| **Offers** | Open-source-friendly forwarding + paid send; privacy positioning; custom domain |
| **Pricing** | Free tier for forwarding; paid plans for enhanced send/storage (check current tiers before quoting exact $) |
| **ICP** | Privacy-conscious and open-source buyers |
| **Flap attack** | Differentiate as true hosted portfolio inbox for founders, not a forwarder. Respect OSS buyers with honest architecture docs. |

#### Cloudflare Email Routing - https://developers.cloudflare.com/email-routing/

| | |
|--|--|
| **Offers** | Free forward-only custom addresses; Workers Email Workers hooks; analytics; requires CF DNS |
| **Pricing** | **Free** |
| **ICP** | One-domain CF users who only need forward-to-Gmail |
| **Flap attack** | Own the upgrade path Hydra already names: "CF Routing is fine for 1 domain; Flap when you need real reply inbox across projects." Do not bash; convert. |

#### Cloudflare Agentic Inbox - (Cloudflare AI / inbox experiments; watch docs.cloudflare.com and CF blog)

| | |
|--|--|
| **Offers** | Emerging AI triage / agentic mail experiments on Cloudflare stack |
| **Pricing** | TBD / experimental |
| **ICP** | CF-native builders |
| **Flap attack** | Do not rush AI triage. Ship identity + keyboard + export first; add AI after core UX is sharp. Watch closely for positioning copy. |

#### Porkbun email - https://porkbun.com (registrar mail add-ons)

| | |
|--|--|
| **Offers** | Domain registrar with optional email forwarding / mailbox products tied to domains purchased there |
| **Pricing** | Low add-on pricing; varies by product (forward vs mailbox); not a multi-project inbox SaaS |
| **ICP** | Domain buyers wanting cheapest hello@ at purchase time |
| **Flap attack** | Partner-style content: Porkbun DNS guide already exists. Upsell Flap when they outgrow single-domain registrar mail. |

### Classic / privacy / suite hosts

#### Migadu - https://www.migadu.com

| | |
|--|--|
| **Offers** | Full IMAP host; unlimited aliases; flat plans by mailbox/storage class; excellent value |
| **Pricing** | Roughly **Mini ~$19/yr** upward through Standard ~$99/yr and higher Maxi tiers (confirm current); soft limits culture |
| **ICP** | Self-serve technical users wanting cheap real mailboxes |
| **Flap attack** | Steal "unlimited domains" messaging only when IMAP is real. Until then, win on web UX and founder positioning. |

#### Purelymail - https://purelymail.com

| | |
|--|--|
| **Offers** | Ultra-cheap IMAP; pay-per-resource; unlimited domains culture |
| **Pricing** | Entry roughly **~$10/yr** + storage/mailbox usage (hybrid) |
| **ICP** | Price-sensitive technical solos |
| **Flap attack** | Not competing on $10/yr. Compete on productized multi-identity inbox. |

#### MXroute - https://mxroute.com

| | |
|--|--|
| **Offers** | Flat storage-tier email hosting; unlimited domains/accounts; cPanel-ish ops heritage; strong uptime reputation |
| **Pricing** | Small/Medium from roughly **~$55-$99/yr** by storage tier (e.g. Mini/Small ~10 GB class); larger and reseller tiers quarterly/monthly |
| **ICP** | Hosting-savvy operators, resellers |
| **Flap attack** | Different UX category. Mention in "cheap IMAP hosts" comparison only. |

#### Google Workspace - https://workspace.google.com

| | |
|--|--|
| **Offers** | Full suite (Gmail, Drive, Meet); secondary domains possible but identity/admin pain; per-user billing |
| **Pricing** | Business Starter list ~**$7/user/mo** (flexible higher). Multiplies per seat and often per tenant if brands are separated. |
| **ICP** | Teams that live in Docs/Drive |
| **Flap attack** | Flap already has Workspace cost calculator + alternative SEO pages. Message: one inbox across projects without seat tax per launch. |

#### Zoho Mail - https://www.zoho.com/mail/

| | |
|--|--|
| **Offers** | Mail + optional Workplace suite; generous free tier on single-domain constraints; Lite paid per user |
| **Pricing** | Free tier (limits); Lite from roughly **~$1/user/mo** annual class |
| **ICP** | SMBs wanting cheap suite-adjacent mail |
| **Flap attack** | Multi-domain portfolio story and unified founder inbox vs managing Zoho per setup. Existing `/flap-vs-zoho` SEO page. |

#### Microsoft 365 - https://www.microsoft.com/microsoft-365

| | |
|--|--|
| **Offers** | Outlook + Office; Exchange Online; per-user |
| **Pricing** | Business Basic roughly **~$6/user/mo** class (~$72/user/yr); higher for Standard |
| **ICP** | Outlook/Office-locked orgs |
| **Flap attack** | Same seat-tax critique as Workspace. Flap is not replacing Office; it replaces email sprawl for multi-project founders. |

#### Fastmail - https://www.fastmail.com

| | |
|--|--|
| **Offers** | Premium webmail UX; custom domain; masked email; strong apps |
| **Pricing** | Roughly **~$5+/user/mo** (~$60+/user/yr) depending on plan |
| **ICP** | Power users wanting best mail client UX, not necessarily 20 side-project domains |
| **Flap attack** | Steal UX bar (speed, density); do not race premium single-user price. Multi-domain portfolio is Flap's wedge. |

#### Proton Mail - https://proton.me/mail

| | |
|--|--|
| **Offers** | E2E encryption; privacy; custom domain on paid |
| **Pricing** | Plus roughly **~$4/user/mo** annual class; higher for Unlimited/business |
| **ICP** | Privacy-first buyers |
| **Flap attack** | Different value prop. Do not claim E2E. Offer clear export, retention, and SES architecture honesty for trust-adjacent buyers. |

### Competitor map summary table

| Product | Type | Entry price signal | Domains story | Flap attack angle |
|---------|------|--------------------|---------------|-------------------|
| Hydra | Direct inbox | Free 3 domains (reply-only); Builder $19 / 20 domains | Strong | Match Builder domains; beat Studio + tools |
| Folio | Direct inbox | Solo ~$2.99-3.50; Holding ~$29-39 | Strong solo | Weaponize seats; copy identity clarity |
| JustEmails | Flat host | $49/yr unlimited | Unlimited | UX + Studio depth, not price |
| TrekMail | Flat host | Free → $3.50 → $10 → $23.25 | Extreme counts | Different ICP; ignore price race |
| Mektup | Host + MCP | Free 1 domain; ~$20/mo | Multi-domain | Ship stronger API/MCP narrative later |
| Mailflo | Cold infra | ~$56/mo+ | Mailbox packs | Stay out of cold email |
| ImprovMX | Forward + SMTP | Free → $9/$24 | Up to 100 | Upgrade-from-forwarder landing |
| Forward Email | Forward + send | Free + paid | Multi | Hosted inbox differentiation |
| CF Email Routing | Free forward | $0 | Per CF zone | Primary upgrade funnel |
| CF Agentic Inbox | Experimental | TBD | CF-native | Watch; don't rush AI |
| Porkbun | Registrar add-on | Low | Per domain | DNS guide → Flap upsell |
| Migadu | IMAP host | ~$19/yr+ | Unlimited culture | IMAP decision gate |
| Purelymail | IMAP host | ~$10/yr+ | Unlimited culture | Not a price war |
| MXroute | IMAP host | ~$55-99/yr | Unlimited | Ops host, not founder UX |
| Google Workspace | Suite | ~$7/user/mo | Secondary domains pain | Calculator + alternative SEO |
| Zoho | Suite-ish | Free / ~$1/user/mo | Limited free multi | vs Zoho SEO page |
| M365 | Suite | ~$6/user/mo | Per-user | Seat-tax messaging |
| Fastmail | Premium mail | ~$5+/user/mo | Limited multi story | Steal UX patterns |
| Proton | Privacy mail | ~$4+/user/mo | Custom domain paid | Trust honesty, not E2E claims |

---

## 4. Recommended Flap pricing redesign

**Goals:** (1) Free must feel usable enough to form a habit. (2) Builder must not lose the Hydra comparison table. (3) Studio must advertise seats as the Folio killer. (4) Annual billing improves cash and perceived value.

### Proposed catalog

| Plan | Monthly | Annual (suggested −20%) | Domains | Storage (direction) | Sends (direction) | Seats | Role |
|------|---------|-------------------------|---------|---------------------|-------------------|-------|------|
| **Free** | $0 | - | **2** (raise from 1) | Raise from 25 MB (e.g. **250 MB-1 GB**) | Raise from 100 (e.g. **300-500**/mo) | 1 | Habit + DNS proof on a real mini-portfolio |
| **Solo** | **~$7** (down from $9) | ~$67/yr (−20%) | 3-5 | Keep ~2 GB or nudge to 3-5 GB | ~500-1,000 | 1 | Undercut Hydra Starter optics; still above Folio Solo on purpose |
| **Builder** | **$19** (keep) | ~$182/yr (−20%) | **20** (match Hydra; up from 10) | Keep/raise toward 15-50 GB | Keep/raise ~2,000+ | 1 | **Hero plan**; API + webhooks + filters |
| **Studio** | **$39** (keep) | ~$374/yr (−20%) | 40+ (or unlimited soft cap) | Keep ~50 GB | Keep ~10k | **Up to 10** (lead marketing) | Team/studio moat vs Folio |

### Design rules

1. **Free raise storage/sends + 2 domains.** 25 MB / 1 domain loses to Hydra Free before the product is felt. Keep Free outbound modest (or reply-biased) if abuse is a risk, but storage and second domain are non-negotiable for trial quality.
2. **Solo ~$7.** Closes the gap vs Hydra Starter $10 without racing Folio to $3. Position Solo as "serious send + catch-all + no footer," not "barely more than Free."
3. **Builder $19 with 20 domains.** Same price as Hydra Builder, same domain count. Flap wins the row with filters, webhooks, API keys, referrals, and SEO tools.
4. **Studio $39 seats.** Price matches Hydra Pro and Folio Holding monthly sticker, but **seats + shared inboxes** are the story Folio cannot tell and Hydra under-emphasizes.
5. **Annual −20%** on all paid (align with Hydra yearly toggle). Optional: **flat annual SKUs** (Solo/Builder/Studio prepaid) for founders who hate subscriptions - useful against JustEmails $49/yr psychology without matching that price.
6. **Optional flat annual "Founder Annual"** experiment: e.g. Builder-class domain cap for a single yearly charge positioned against JustEmails (expect lower margin; use only if conversion data supports it).

### Migration notes

- Grandfather existing Solo $9 customers or auto-move to new Solo $7.
- Builder customers gaining domain cap 10 → 20 is a goodwill upgrade; announce loudly.
- Update `shared/plans.ts`, Dodo products, calculator (`flapPlanForDomains`), and marketing plan cards together.
- Revisit Free footer branding: keep on Free only.

### Pricing opinion (short)

Raise Free usability; match Hydra Builder domain count at $19; weaponize Studio seats vs Folio; own SEO free tools. Do not try to beat JustEmails at $49/yr or Folio Solo at $2.99 on sticker price.

---

## 5. Feature matrix vs Hydra / Folio

| Capability | Flap (today) | Hydra | Folio | Winner / note |
|------------|--------------|-------|-------|---------------|
| Multi-domain unified inbox | Yes | Yes | Yes | Tie; UX polish race |
| Domain color / identity chrome | Partial (must elevate) | Strong | Strong | Hydra/Folio today |
| Auto reply-From correct address | Needs first-class lock | Strong | Strong | Must match |
| Catch-all | Yes (paid) | Yes (incl. Free) | Yes | Hydra Free edge |
| Folders / labels / filters | Yes (deeper) | Lighter marketed | Lighter marketed | **Flap** |
| Team seats / shared inboxes | Studio up to 10 | Weak / not core | Single-user | **Flap** |
| API keys | Paid | Builder+ | Limited | **Flap** / Hydra |
| Inbound webhooks | Yes | Limited marketed | Limited | **Flap** |
| Referrals (+domain) | Yes | Not emphasized | Not emphasized | **Flap** |
| DNS wizard | Yes | Excellent story | Strong | Polish Flap to "5 min done" |
| Export / cancel trust | Export exists; market policy | 30-day export marketed | Billing clarity strong | Match Hydra language |
| IMAP/SMTP | Coming soon / risk | Web-first | Web-first | Decision gate |
| Free domain count | 1 | **3** | 1 preview | Hydra |
| Builder domains @ $19 | **10** | **20** | Folio Studio 10 @ ~$12-15 | Hydra table win today |
| SEO free tools / calculator | Strong start | Moderate | Strong content | **Flap can own** |
| Price for solo cheap | Solo $9 | Starter $10 | **Solo ~$3** | Folio |
| Keyboard / Cmd+K | Partial | Feels fast | Solid | Must raise Flap |

**Read:** Hydra/Folio win *story and identity*. Flap wins *depth* (Studio, filters, API, webhooks, referrals, tools). Pricing redesign + identity UX closes the gap.

---

## 6. Rich feature backlog

### Must-have (next competitive bar)

- Keyboard-first inbox + Cmd+K command palette (`j/k/e/r/c`, jump domain, compose as identity).
- Multi-identity colors + **locked auto From** on reply (override only to verified aliases).
- DNS wizard → green "receiving mail" with send-test-email and registrar tips (CF, Porkbun, Namecheap, GoDaddy, Vercel, Route 53, Squarespace already have guides).
- Explicit **export + cancel policy** in UI (match or beat Hydra 30-day export messaging).
- **IMAP/SMTP or kill the tease** - ship MVP credentials or remove from marketing until dated.
- Honest architecture copy everywhere (SES customer mail + CF app hosting).
- Pricing redesign: Free usability, Builder 20 domains, Solo ~$7, annual −20%.

### Differentiators (win vs Hydra/Folio)

- Studio seats depth: invite, roles, shared support@ / hello@, delegation clarity.
- Filters + labels + folders as marketed pillars (already built; make visible on homepage).
- API keys + inbound webhooks + delivery log + quickstart (already shipped; homepage + docs).
- Referral loop UX after domain verify.
- Workspace cost calculator and alternative SEO pages (keep feeding).
- Domain-first pricing honesty vs seat tax (content system).

### Growth / SEO

- Expand free tools set (section 7) with indexable landing pages and internal links into signup.
- Competitor honesty pages: CF Routing upgrade; Hydra alternative; Folio alternative; JustEmails vs Flap (accurate, non-toxic).
- Registrar DNS guides (already strong) + "email for indie hackers / side projects" cluster.
- Blog cadence: MX/SPF/DMARC checklist, catch-all aliases, self-host vs hosted, Workspace multi-domain cost.
- Comparison tables that include Builder 20-domain parity after redesign.
- Public status page + deliverability trust snippets.

### Later

- Dark mode (brand is light editorial; finish speed + identity first).
- AI triage / agentic inbox (after core UX; watch CF Agentic Inbox).
- Native mobile apps (PWA + IMAP may suffice early).
- Cold outbound / sequences (reputation risk; stay reply-and-support).
- Per-domain reputation dashboards (SES bounce/complaint plumbing).
- MCP server for agents (respond to Mektup only if ICP expands to AI builders).
- Flat ultra-cheap annual SKU experiment vs JustEmails.

---

## 7. Free tools list (20+) that drive search clicks

Intent: founders Google these before buying mail. Each tool should be a fast, no-login page with CTA into Flap DNS wizard / signup. Mark status vs Flap today (`TOOL_PAGES` in `src/content/marketing.ts` and related routes).

| # | Tool | Search intent | Status |
|---|------|---------------|--------|
| 1 | **MX record checker** | "mx lookup", "check mx records" | **Has** `/tools/mx-checker` |
| 2 | **SPF checker** | "spf record check" | **Has** `/tools/spf-checker` |
| 3 | **DKIM checker** | "dkim checker", "verify dkim" | **Has** `/tools/dkim-checker` |
| 4 | **DMARC checker** | "dmarc check" | **Has** `/tools/dmarc-checker` |
| 5 | **Email setup checker** (MX+SPF+DMARC combo) | "email dns check" | **Has** `/tools/email-setup-checker` |
| 6 | **Google Workspace cost calculator** | "workspace cost multiple domains" | **Has** `/tools/google-workspace-cost-calculator` |
| 7 | **DMARC generator** | "dmarc record generator" | **To build** |
| 8 | **SPF generator / flatener helper** | "spf generator", "too many lookups" | **To build** |
| 9 | **DKIM record generator** (selector + public key paste assist) | "dkim record generator" | **To build** |
| 10 | **BIMI checker** | "bimi record check" | **To build** |
| 11 | **MTA-STS / TLS-RPT checker** | "mta-sts check" | **To build** |
| 12 | **Email header analyzer** | "email header analyzer", "read message headers" | **To build** |
| 13 | **Blacklist / RBL checker** | "email blacklist check" | **To build** |
| 14 | **PTR / reverse DNS checker** | "ptr lookup email" | **To build** |
| 15 | **SMTP banner / port 25 reachability probe** (safe, informational) | "smtp test port 25" | **To build** (careful with abuse) |
| 16 | **Catch-all detector** | "does my domain have catch-all" | **To build** |
| 17 | **Disposable alias / plus-address explainer + tester** | "email alias test" | **To build** |
| 18 | **From-domain mismatch / spoof education tool** | "reply from wrong address" | **To build** (ties to Hydra/Folio story) |
| 19 | **DNS propagation checker** (MX/TXT focus) | "mx propagation check" | **To build** |
| 20 | **WHOIS / nameserver quick view** (email setup context) | "who is my dns host" | **To build** (or link out carefully) |
| 21 | **Flap vs Workspace savings share card** | calculator derivative | **Extend existing** |
| 22 | **Deliverability scorecard** (auth aggregate A-F) | "email deliverability test" | **To build** |
| 23 | **ARC / forwarded-mail explainer** | "email failed dmarc forward" | **To build** (content+light tool) |
| 24 | **Registrar record templates** (copy blocks) | already partly in guides | **Has guides; toolize** |

**Already has (shipped tool routes):** MX, SPF, DKIM, DMARC, combined email setup checker, Workspace cost calculator.  
**To build (priority order):** header analyzer, blacklist checker, DMARC/SPF generators, deliverability scorecard, BIMI, MTA-STS, catch-all detector, DNS propagation.

**GTM note:** Each tool page ends with: "Want this fixed permanently? Add the domain to Flap → DNS wizard." Cross-link guides (Cloudflare, Porkbun, Namecheap, GoDaddy, Vercel, Route 53, Squarespace).

---

## 8. Go-to-market / attractiveness recommendations

1. **Ship the pricing redesign in one release** (Free raise + Builder 20 domains + Solo ~$7 + annual −20%). Comparison tables are how Hydra/Folio get chosen; optics matter as much as features.
2. **Lead marketing with Studio seats + API/webhooks + filters**, not another me-too "one inbox" hero alone. Depth is the moat; say it on the homepage above the fold strip.
3. **Own the CF Routing upgrade narrative** with an honest page (when free forward is enough vs when Flap is worth it). Hydra already does this; Flap should too, with SES architecture clarity.
4. **Weaponize free tools for SEO** - expand from 6 shipped checkers to 20+ indexable utilities; this is compounding acquisition Hydra underweights and Folio partially covers with content.
5. **Identity UX sprint** (colors, auto From, Cmd+K) so paid conversion does not bounce after signup. Pricing gets the click; UX keeps the card.
6. **Trust pack:** export UI, cancel/export policy, status page, fix README architecture blurb, remove IMAP/priority-support overclaims until real.
7. **Referral after verify** as a first-class growth loop (already coded): prompt "invite a founder, earn a domain" once MX is green.
8. **Do not race JustEmails/Migadu on $49/yr or Folio on $2.99.** Win portfolio operators who want a productized inbox, automation, and (for Studio) a small team - and who will pay $19 for Builder when domains and tools feel generous.

---

## 9. Source URLs

### Flap

- https://useflap.online  
- https://github.com/sarmaasis/flap  
- Internal: `shared/plans.ts`, `src/content/marketing.ts`, `docs/competitive-ux-guide.md`, `docs/mail-architecture.md`, `docs/aws-ses-setup.md`

### Direct competitors

- https://hydra.mx  
- https://folioinbox.com  
- https://folioinbox.com/pricing  
- https://folioinbox.com/docs/billing  
- https://folioinbox.com/for/solo-founders  
- https://folioinbox.com/for/holding-company-of-one  

### Flat / niche hosts

- https://justemails.app  
- https://justemails.app/blog/business-email-pricing-survey-2026  
- https://trekmail.net  
- https://usemektup.com  
- https://mailflo.co  

### Forwarders / pipes / registrar

- https://improvmx.com  
- https://improvmx.com/pricing/  
- https://forwardemail.net  
- https://developers.cloudflare.com/email-routing/  
- https://www.cloudflare.com/products/email-routing/  
- https://porkbun.com  

### Classic / suite / privacy hosts

- https://www.migadu.com  
- https://purelymail.com  
- https://mxroute.com  
- https://workspace.google.com  
- https://www.zoho.com/mail/  
- https://www.microsoft.com/microsoft-365  
- https://www.fastmail.com  
- https://proton.me/mail  

### UX bar (patterns, not ICP)

- https://www.hey.com  
- https://superhuman.com  

---

## Bottom line

**Raise Free usability; match Hydra Builder at 20 domains / $19; weaponize Studio seats vs Folio; own SEO free tools.**

Flap's product depth already exceeds Hydra/Folio on team, filters, API, webhooks, and referrals. The marketing research gap is **pricing table parity**, **Free trial quality**, and **tooling-led acquisition**. Close those three and the UX guide's identity/keyboard sprint converts the traffic you earn.
