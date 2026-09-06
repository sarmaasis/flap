# Flap Competitive UX Guide

**For:** Ashish Sharma, founder of Flap  
**Product:** [useflap.online](https://useflap.online) · [github.com/sarmaasis/flap](https://github.com/sarmaasis/flap)  
**Date:** 2026-09-06  
**Purpose:** One actionable doc: what Flap already is, who it fights, which UX patterns win, what to build next.

---

## 1. Executive summary

**What Flap is:** A hosted multi-domain email SaaS for indie hackers and serial founders. One web inbox for every project domain. Domain-first plans (Free / Solo / Builder / Studio), not per-seat Workspace pricing.

**Correct the GitHub / marketing blurb:** Cloudflare hosts the *app* (Workers, D1, R2, SEB for system auth mail). Customer inbound/outbound mail runs on **Amazon SES**, not "on the user's Cloudflare account." DNS is registrar-agnostic: any DNS host → SES MX/DKIM → S3/queue → Worker → D1/R2. System mail for `useflap.online` stays on Cloudflare SEB. Saying "Cloudflare email" in the README sells the wrong architecture and confuses buyers comparing you to Cloudflare Email Routing.

**Wedge vs Hydra ([hydra.mx](https://hydra.mx)) and Folio ([folioinbox.com](https://folioinbox.com)):** Same ICP (portfolio founders, many domains, hate Workspace seats). Hydra and Folio win on *clarity of story* and *multi-identity UX* (color-coded domains, reply-from-correct-address). Flap already has the deeper product surface (folders, labels, filters, aliases, Team Studio, referrals, API keys, inbound webhooks, TipTap compose, DNS wizard, SEO marketing). You are not behind on features. You are behind on **keyboard-first speed, identity visibility, trust/export, and shipping IMAP/SMTP**.

**Opinion:** Beat Hydra/Folio on *operator velocity* (Cmd+K, zero wrong-From replies, 5-minute DNS that feels finished) and *depth* (Studio seats, filters, webhooks, API). Do not race them on free-domain count alone. Race them on "I never miss a customer email from a side project" plus "I can automate this."

---

## 2. Product snapshot (current strengths from code)

Already shipped and worth advertising honestly:

| Area | What exists |
|------|-------------|
| **Core mail** | Unified web inbox, folders, compose (TipTap), labels, filters, aliases |
| **Domains** | Multi-domain add flow + DNS wizard (MX/SPF/DKIM path) |
| **Team** | Studio plan with shared inboxes / seats (up to 10) |
| **Growth** | Referrals (+1 domain permanently after invitee connects a domain) |
| **Developer** | API keys, inbound webhooks |
| **Auth / billing** | Better Auth, Dodo Payments, plan gating |
| **Marketing** | SEO pages, guides, DNS tools, Workspace cost calculator |
| **Stack** | React 19 + Vite + Tailwind; Hono Worker; D1/R2; SES for customer mail; SEB for system mail |
| **Design** | Light-only UI: warm editorial + teal (distinct from cold SaaS gray) |

**Positioning line that matches the code:**  
> One inbox for every startup you build. Real domain mail (SES), not Gmail forwarding. Built for founders who ship many projects.

---

## 3. Competitor map

| Product | Type | ICP fit | Strength | Weakness vs Flap | Flap move |
|---------|------|---------|----------|------------------|-----------|
| **[Hydra](https://hydra.mx)** | Hosted multi-domain inbox | Direct | Color-coded domains; auto reply-from; 5-min DNS story; free 3 domains; honest "CF Routing is fine for 1 domain" | Shallower product (less team/filters/API depth marketed); free plan reply-only outbound on lowest tier | Match identity UX + win on Studio, filters, webhooks, API |
| **[Folio](https://folioinbox.com)** | Hosted multi-domain webmail | Direct | Per-domain color/reputation story; flat per-operator pricing; strong solo-founder SEO content | Solo-operator focus; less "team Studio" story | Keep Studio as moat; copy Folio's identity clarity and trust language |
| **[CF Email Routing](https://developers.cloudflare.com/email-routing/)** | Free forward-only | Adjacent (1 domain) | Free, 2-min setup if already on CF | No real inbox, no native send, reply-from-Gmail pain | Own the upgrade path: "outgrew CF Routing" landing page |
| **[ImprovMX](https://improvmx.com)** | Forward + paid SMTP | Adjacent | Simple aliases, API, webhooks | Not a unified project inbox | Compete on inbox UX, not forwarding price |
| **[Forward Email](https://forwardemail.net)** | Open-source forward + paid send | Adjacent | Open source, cheap start | Forwarding-first identity | Differentiate as true hosted inbox for founders |
| **[Migadu](https://www.migadu.com)** | Full IMAP host | Adjacent | Cheap real mailboxes, unlimited domains | Classic webmail UX, not portfolio-founder product | Steal "unlimited domains" messaging only if storage/IMAP is ready |
| **[HEY](https://www.hey.com) / [Superhuman](https://superhuman.com)** | UX bar (not ICP) | Aspirational UX | Keyboard-first, Cmd+K, ruthless speed, opinionated triage | Wrong price/ICP for multi-domain indie use | Steal interaction patterns, not positioning |

**Also on the radar (secondary):** Purelymail (ultra-cheap IMAP), JustEmails (~$49/yr full host), Mailyond, CF Agentic Inbox (watch Cloudflare's AI/inbox experiments). None replace Hydra/Folio as primary comps.

**Market truth:** Hydra and Folio are selling *identity hygiene* (right From, per-domain color, reputation isolation). Forwarders sell *pipes*. Classic hosts sell *mailboxes*. Flap should sell **portfolio operator inbox + automation depth**.

---

## 4. Best UI/UX guide for Flap

### Principles (steal these; they are highly upvoted across HEY/Superhuman/Hydra/Folio)

1. **Keyboard is the product.** Every frequent action has a key. Mouse is secondary.
2. **Identity before content.** User knows *which domain* before reading the subject.
3. **Reply From is automatic and hard to get wrong.** Wrong-From is the #1 multi-domain failure mode.
4. **Setup feels finished.** DNS wizard ends in a green "receiving mail" state with a test email, not a wall of records.
5. **Trust is visible.** Export, retention, "what happens if I cancel," deliverability status per domain.
6. **Speed over chrome.** Prefer density + shortcuts over empty marketing whitespace inside the app.
7. **One job per screen.** Inbox = triage. Compose = write. Domains = verify. Settings = configure.

---

### Inbox

**Do**

- Domain color chip (or left accent bar) on every row: Folio/Hydra pattern. Make it configurable per domain.
- Unified list with sticky filters: All / Unread / Starred / per-domain / per-label.
- Thread preview pane (optional split) for desktop; full-screen on mobile.
- Bulk select + keyboard: `j`/`k` move, `e` archive, `r` reply, `c` compose, `#` delete, `l` label, `f` filter domain.
- Cmd+K / Ctrl+K command palette: jump domain, go to settings, compose as `hello@project.com`, search.
- Unread counts per domain in a left rail (not only global unread).
- Empty states that teach: "No mail on shopfront.io yet. Send a test →."

**Don't**

- Generic Gmail clone with no domain identity.
- Hide which address received the message until the thread is open.
- Ship dark mode before keyboard nav (your brand is light editorial; finish light first).

---

### Compose / reply

**Do**

- Pre-select From from the inbound address on reply. Show a locked "From: support@x.com" pill; allow override via dropdown of verified aliases only.
- Identity-colored compose chrome matching the From domain.
- TipTap: keep bold/link/lists; add templates ("Thanks for the purchase", "Founder reply") keyed to domain.
- Send shortcuts: Cmd+Enter. Draft autosave. Undo send (5–10s).
- Attachment UX with clear size limits tied to SES reality.
- Quote collapse on long threads.

**Don't**

- Allow free-typed From that isn't a verified alias (spam/reputation death).
- Put domain picker three clicks deep.

---

### Domain setup

**Do (this is a conversion surface)**

- 3-step wizard: Add domain → Publish records (copy buttons + registrar tips: Cloudflare, Porkbun, Namecheap, GoDaddy) → Send test email / auto-verify.
- Live status: MX ✓ SPF ✓ DKIM ✓ DMARC (optional) with plain English, not only record types.
- Catch-all default ON with clear explanation (Hydra's "every address works" is sticky messaging).
- Post-verify celebration + "Create first alias" CTA.
- Per-domain deliverability panel later: bounce rate, complaints, SES reputation summary.

**Don't**

- Dump a raw record table with no "what next."
- Claim Cloudflare-hosted customer mail.

---

### Settings

**Do**

- Group by operator jobs: Domains · Identities/Aliases · Filters · Team · API/Webhooks · Billing · Data export.
- Filters: visual rules (if domain/from/subject → folder/label/archive) with test-against-sample.
- Team Studio: invite, seat usage, shared inbox permissions in one place.
- API keys + webhook endpoint with signed secret + delivery log (last 20 events).
- Export: mailbox download (.eml / mbox) + "30-day export window on cancel" language (Hydra already markets this; match or beat it).
- Honest IMAP/SMTP: if coming soon, say date or remove from marketing until shippable.

**Don't**

- Market "priority support" if it is only a badge.
- Leave password-reset as "coming soon" in README when it already ships.

---

### Marketing site

**Do**

- Hero: "One inbox for every startup you build." Sub: outgrow CF Routing / Workspace seats.
- Competitor honesty block (Hydra-style): when CF Routing is enough vs when Flap is worth it.
- Live product screenshots with **color-coded multi-domain inbox**, not abstract gradients.
- Pricing table aligned to domains + seats (you already have this). Highlight Builder.
- Trust: architecture one-liner (SES + Cloudflare app), export, cancel policy, status page link.
- Replace empty testimonials with 3 founder quotes or remove the section until real.
- SEO: keep calculator + DNS guides; add "Hydra alternative" / "Folio alternative" / "Cloudflare Email Routing reply" pages only if accurate and non-toxic.

**Don't**

- Overclaim IMAP, priority support, or Cloudflare-as-mail-backend.
- Keep inlet→flap naming leftovers in public copy.

---

## 5. Feature gaps to compete

Mapped against what Flap **already has**.

### Must (next competitive bar)

| Gap | Why | Flap today |
|-----|-----|------------|
| **Keyboard-first inbox + Cmd+K** | Superhuman/HEY bar; Hydra feels fast | Partial at best; not a product pillar |
| **Multi-identity colors + auto From** | Folio/Hydra's core UX story | Domains exist; identity chrome must be first-class |
| **DNS wizard → verified receiving** | Setup tax is the buying moment | Wizard exists; polish to "5 minutes done" |
| **Export / cancel trust** | Hydra markets 30-day export; builds confidence | Need explicit export + policy in UI |
| **IMAP/SMTP or kill the tease** | Power users and mobile clients; listed coming_soon | Coming soon; README/marketing mismatch risk |
| **Honest architecture copy** | SES vs CF confusion erodes trust | Fix README + site |

### Differentiator (win vs Hydra/Folio)

| Gap | Why | Flap today |
|-----|-----|------------|
| **Team Studio depth** | Folio is solo-leaning; Hydra less team | Studio seats already planned/priced |
| **Filters + labels + folders** | Operator triage at volume | Already in product; make them visible in marketing |
| **API keys + inbound webhooks** | Indie hackers automate support → Notion/Linear/Slack | Already shipped; put on homepage |
| **Referrals (+1 domain)** | Growth loop Hydra/Folio don't emphasize the same way | Shipped |
| **SEO + calculator** | Capture "Workspace alternative" intent | Shipped; keep feeding |

### Later

| Gap | Why wait |
|-----|----------|
| Dark mode | Brand is light; finish speed + identity first |
| AI triage / Agentic inbox | CF and others will flood this; only after core UX is sharp |
| Mobile native apps | PWA + IMAP may be enough early |
| Cold outbound / sequences | Reputation risk; stay reply-and-support first |
| Per-domain reputation dashboards | Powerful; needs SES metrics plumbing |

---

## 6. Issues / bugs / debt in existing Flap features

From codebase audit. Fix credibility before adding chrome.

| Issue | Impact | Action |
|-------|--------|--------|
| **IMAP/SMTP `coming_soon`** | Blocks power users; marketing tease | Ship MVP credentials *or* remove from UI/marketing until date |
| **README stale on password reset** | Looks abandoned | Document as shipped |
| **License UNLICENSED vs MIT LICENSE file** | Legal/confusion for GitHub visitors | Align package license with LICENSE file intent |
| **Unused Radix deps** | Bundle/noise | Remove or use |
| **Empty testimonials** | Trust leak on marketing | Real quotes or delete section |
| **Priority support marketing-only** | Overpromise | Define SLA or drop badge |
| **inlet → flap rename risk** | Broken links, old env names, SEO ghosts | Grep + redirect + copy sweep |
| **Auth depends on SEB** | System magic-link/verify fails if SEB misconfigured | Document hard dependency; alerting on auth-mail failures |
| **GitHub blurb implies CF customer mail** | Wrong architecture story | Rewrite to SES + CF app hosting |

---

## 7. Prioritized 30 / 60 / 90 day roadmap

### Days 0–30: Credibility + identity UX (beat Hydra on feel)

1. Fix copy debt: README (password reset, SES architecture), remove overclaims (IMAP/priority support unless real), inlet→flap sweep.
2. Inbox identity: domain color chips, unread-per-domain rail, auto From on reply (locked + override).
3. Cmd+K palette + `j/k/e/r/c` shortcuts on inbox.
4. Domain wizard polish: copy-all records, registrar tips, send-test-email, green verified state.
5. Marketing: replace empty testimonials; homepage feature strip for filters / webhooks / API / Studio.
6. License + unused Radix cleanup.

**Success metric:** New user adds a domain and replies from the correct address without thinking; time-to-first-verified-domain under 10 minutes.

### Days 31–60: Trust + differentiation

1. Mailbox export (.eml/mbox) + cancel/export policy on billing page.
2. Webhook delivery log + API quickstart in-app.
3. Filters UX upgrade (visual rules + "test rule").
4. Studio invite/permissions clarity (shared inbox mental model).
5. Competitor landing pages: CF Routing upgrade path; honest Hydra/Folio comparison.
6. SEB auth-mail monitoring (alert when magic links fail).

**Success metric:** Paid conversion from users with 2+ domains; support tickets about "wrong From" near zero.

### Days 61–90: Protocol or double-down web

1. **Decision gate:** Ship IMAP/SMTP read+send MVP **or** publicly defer with date and lean harder into best-in-class web + PWA.
2. If IMAP: credentials per identity, app-password style, docs for Apple Mail / Thunderbird.
3. Deliverability panel v1 (bounce/complaint signals per domain).
4. Referral loop UX (share link prominence after verify).
5. Performance pass: inbox virtualization, compose draft reliability.

**Success metric:** Either IMAP in hands of beta users, or web NPS/speed clearly above Hydra on "daily driver" feedback.

---

## 8. Sources / URLs

### Flap

- App / marketing: https://useflap.online  
- Repo: https://github.com/sarmaasis/flap  

### Direct competitors

- Hydra: https://hydra.mx  
- Folio: https://folioinbox.com  
- Folio solo founders: https://folioinbox.com/for/solo-founders  
- Folio billing docs: https://folioinbox.com/docs/billing  

### Adjacent / pipes / hosts

- Cloudflare Email Routing: https://developers.cloudflare.com/email-routing/  
- ImprovMX: https://improvmx.com  
- Forward Email: https://forwardemail.net  
- Migadu: https://www.migadu.com  
- Purelymail: https://purelymail.com  
- JustEmails: https://justemails.app  

### UX bar

- HEY: https://www.hey.com  
- Superhuman: https://superhuman.com  

### Internal Flap docs (repo)

- `docs/mail-architecture.md`  
- `docs/aws-ses-setup.md`  
- `docs/hybrid-product.md`  

---

## Bottom line for Ashish

Hydra and Folio are winning the *story*: color, From-address safety, setup speed, trust. Flap already has the *deeper product*. Your 90 days are not "add more features." They are **make identity and keyboard speed undeniable**, **tell the SES truth**, **ship export trust**, and **either deliver IMAP or stop advertising it**. Studio + webhooks + API are your unfair advantages. Lead with those after the inbox feels inevitable.
