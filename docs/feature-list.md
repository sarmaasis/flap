# Flap New Feature List

**Product:** [useflap.online](https://useflap.online) · [github.com/sarmaasis/flap](https://github.com/sarmaasis/flap)  
**Audience:** Ashish + eng. Hand this to an engineer as a build backlog, not a brainstorm.  
**Date:** 2026-09-06  
**Companion:** `docs/marketing-research.md` (pricing/competitors), `docs/competitive-ux-guide.md` (UX patterns).

**Rule:** Do not rebuild what already ships (folders, labels, filters, aliases, Studio seats, API keys, inbound webhooks, TipTap, DNS wizard, referrals). Market those harder. This doc is **new capabilities**.

**Plan gates used below:** Free / Solo / Builder / Studio (see `shared/plans.ts`).

---

## Already strong (don't rebuild; market better)

| Shipped | What to do instead of rebuilding |
|---------|----------------------------------|
| Unified multi-domain web inbox | Homepage screenshots with domain chips once colors ship |
| Folders, labels, filters, aliases, catch-all | Feature strip above fold; demo GIFs |
| TipTap compose + signatures | Sell templates + From-lock on top of this |
| DNS wizard (MX/SPF/DKIM) | End in green "receiving" + test send; keep registrar guides |
| Studio seats (up to 10), shared inboxes | Weaponize vs Folio solo; invite UX clarity |
| API keys + inbound webhooks | Homepage + in-app quickstart + delivery log |
| Referrals (+1 domain after invitee verifies) | Prompt after first MX green |
| SEO tools (MX/SPF/DKIM/DMARC checkers, Workspace calculator) | Expand set; do not replace with fluff |

---

## P0 New features (next 30 days)

Ship identity hygiene + operator speed. These close the Hydra/Folio feel gap and stop "I signed up and it felt like generic webmail."

| # | Name | Description | Why users care | Competitor gap | Plan gate |
|---|------|-------------|----------------|----------------|-----------|
| 1 | **Domain color identity** | Per-domain accent color (chip on every inbox row, left rail, compose chrome). User picks or Flap auto-assigns a stable palette. | Instant "which project is this?" without opening the thread. | Hydra/Folio own this story today. | Free |
| 2 | **From lock (reply identity)** | On reply, From is pre-set to the inbound address and shown as a locked pill. Override only via verified aliases on that domain. | Wrong-From is the #1 multi-domain failure mode and burns reputation. | Hydra/Folio lead with auto From; Flap must make it first-class. | Free |
| 3 | **Cmd+K command palette** | Global Ctrl/Cmd+K: jump domain, compose as `hello@project.com`, search threads, open settings, apply label. | Founders live in keyboard; mouse-only feels slow vs Superhuman habit. | Neither Hydra nor Folio markets a palette this hard. | Free |
| 4 | **Keyboard triage pack** | Inbox shortcuts: `j`/`k` move, `e` archive, `r` reply, `c` compose, `#` trash, `l` label, `f` filter by domain, `s` star, `u` unread. | Daily triage volume across 5-20 domains needs muscle memory. | Classic webmail competitors are mouse-heavy. | Free |
| 5 | **Keyboard cheat sheet overlay** | `?` opens a one-screen shortcut map; dismissible, remember "don't show again." | Discoverability so shortcuts actually get used. | Easy win Hydra/Folio under-document. | Free |
| 6 | **Unread per domain rail** | Left rail shows each domain with unread badge; sticky All / Unread / Starred filters. | Global unread hides which side project is on fire. | Folio-style identity; Flap should match. | Free |
| 7 | **Smart folders / saved views** | Save views: e.g. `Unread @shopfront.io`, `Label:billing`, `Has attachment`. Pin to sidebar per account. | Operators invent the same filters every morning. | Deeper than Hydra marketing; beats Folio triage story. | Solo+ (pin 3 on Free) |
| 8 | **Snooze packs** | Snooze thread until tomorrow 9am, next Monday, or custom. Pack presets: "Investor week", "Support SLA 24h". | Founders park mail without losing it in archive. | HEY-style; portfolio hosts rarely ship it. | Solo+ |
| 9 | **Send later (reliable)** | Schedule outbound; show countdown in Sent; cancel/edit before fire. Honor timezone of mailbox owner. | Night drafts should not wake customers at 2am. | Forwarders don't; suites do poorly for multi-domain. | Solo+ |
| 10 | **Undo send (10s)** | After send, 10s undo window before SES handoff (or soft-hold queue). | Panic fix for wrong recipient / wrong From override. | Expected in modern mail; missing = amateur. | Free |
| 11 | **Pre-MX send test / shadow domain** | Before MX cutover: Flap sends a probe and shows "we can authenticate outbound; inbound waiting on MX." Optional temporary receive path for verification only. | Reduces fear of flipping MX and going dark. | CF Routing feels instant; Flap must feel finished. | Free |
| 12 | **Plus-addressing UI** | Create/show `you+stripe@domain` aliases in UI; copy button; optional auto-label by plus tag. | Signup hygiene without burning real aliases. | ImprovMX-ish; Flap can productize in inbox. | Free (create), Solo+ (auto-label) |
| 13 | **Disposable QR / share address** | Generate short-lived or one-event address with QR + share link (conference, launch waitlist). Auto-expire. | Side projects collect spam; disposable keeps primary clean. | Unique vs Hydra/Folio. | Builder+ |
| 14 | **Slack / Discord notify on new mail** | Per-mailbox or per-domain: post subject + deep link to Flap on new mail (webhook URL). Mute rules. | Founders live in Slack; email alone gets ignored. | ImprovMX/Forward Email notify; portfolio inboxes weaker. | Solo+ (1 channel), Builder+ (many) |
| 15 | **Webhook out enhancements** | Harden `mail.received`: signed payloads, retry with backoff, last-50 delivery log, sample events, filter by domain/mailbox. | Devs already have webhooks; reliability is the product. | Flap already ships base; log + retries beat ImprovMX feel. | Builder+ |
| 16 | **Export + cancel trust pack** | One-click mailbox export (.eml/mbox), billing page "30-day export window on cancel", retention copy. | Hydra markets this; buyers ask "what if you die?" | Match or beat Hydra trust language. | Free (export own), Solo+ (bulk) |
| 17 | **New project 60-second wizard** | Single flow: add domain → DNS copy → create `hello@` + `support@` → catch-all on → send test → invite optional teammate. | Serial launchers add domains often; setup tax kills conversion. | Hydra's 5-min story; Flap must own "finished." | Free |
| 18 | **Mobile PWA install polish** | Install prompt after first verified domain; offline shell for inbox list; home-screen icon; push optional later. | Founders check mail on phone between meetings. | Beats "desktop only" feel without native apps yet. | Free |

**P0 count: 18**

---

## P1 New features (30-90 days)

Depth that turns Flap into the operator OS for a portfolio, not just a prettier inbox.

| # | Name | Description | Why users care | Competitor gap | Plan gate |
|---|------|-------------|----------------|----------------|-----------|
| 1 | **Shared inbox assignments** | Assign thread to a Studio seat; "mine / unassigned / theirs" filters; claim button. | Support@ with 2-3 people needs ownership. | Folio is solo; Hydra thinner on team. | Studio |
| 2 | **Collision detection** | If two seats open same thread, show "Alex is viewing" and soft-lock reply or warn before dual send. | Double replies look unprofessional. | Workspace has presence; portfolio hosts don't. | Studio |
| 3 | **Deliverability dashboard (per domain)** | SES bounce/complaint/reject rates, suppression list peek, "sending paused" banner, plain-English fixes. | One bad domain should not silently poison the portfolio. | Folio talks reputation; few show live SES signals. | Builder+ (Studio full history) |
| 4 | **Reputation isolation modes** | Modes: Shared pool (default) vs Isolated (stricter pause on complaint spike per domain). Document SES reality honestly. | Agencies and launchers need blast radius control. | Differentiator vs flat hosts. | Studio (Isolated), Builder (Shared metrics) |
| 5 | **Contact forms → Flap mailbox** | Embeddable form or hosted `/contact` page that lands as mail in chosen mailbox with spam honeypot. | Replace Formspree/Getform for simple sites. | Adjacent tools; Flap owns the inbox destination. | Solo+ |
| 6 | **Public status + domain health badge** | Account status page + embeddable SVG badge: MX/SPF/DKIM green for a domain. | Trust for customers and "we receive mail" social proof. | Rare in portfolio inbox category. | Free (badge), Solo+ (status page) |
| 7 | **Autopilot rules marketplace templates** | One-click rule packs: "Archive newsletters", "Label receipts", "VIP investors to folder", "Support SLA tag". Community + official. | Filters exist but blank canvas is intimidating. | Unique marketing wedge. | Free (install 2), Solo+ unlimited |
| 8 | **Calendar RSVP** | Parse `.ics` invites; Accept/Decline/Maybe from thread; write response mail. | Founders get meeting mail constantly. | Suites do this; Hydra/Folio usually don't. | Solo+ |
| 9 | **AI summarize / triage with confirm** | Optional AI: thread summary, suggested label/archive, draft reply. **Never auto-send**; always confirm. Opt-in per mailbox. | Speed without agentic disaster. | CF Agentic Inbox coming; Flap stays human-in-loop. | Builder+ (quotas), Studio higher |
| 10 | **IMAP decision path (MVP or dated defer)** | Either ship read+send IMAP credentials (app passwords per identity) **or** remove marketing tease and publish a date. Docs for Apple Mail / Thunderbird. | Power users and mobile clients demand protocol. | Migadu/Purelymail win protocol; Flap must choose. | Builder+ (if shipped) |
| 11 | **Multi-language compose templates** | Domain-scoped templates with locales (EN/HI/ES/…); insert via Cmd+K. | Global customers; founder support in one inbox. | Thin in competitor set. | Solo+ |
| 12 | **Client portal for agencies** | Studio: client-facing read-only or limited mailbox view without full Flap admin; white-label URL optional later. | Agencies manage many domains for clients. | Huge Studio moat vs Folio. | Studio |
| 13 | **Bulk import from Gmail / ImprovMX** | Wizard: OAuth or forward-history import; map aliases; preserve labels where possible. | Switching cost kills deals. | Migration UX is underbuilt everywhere. | Solo+ |
| 14 | **Migrate wizard from CF Email Routing** | Detect CF Routing records, guide MX cutover, import route list into Flap aliases, "outgrew CF Routing" checklist. | Hydra owns this narrative; Flap should steal it with SES honesty. | Direct competitive wedge. | Free |
| 15 | **Scheduled reports digest** | Weekly email: volume per domain, unanswered >48h, bounce spikes, seat activity (Studio). | Operators fly blind across 10 domains. | Differentiator. | Builder+ |
| 16 | **Labels synced to API** | CRUD labels via API; webhook includes label ids; filter API list by label. | Automation pipelines need parity with UI. | Deepens Builder/Studio API story. | Builder+ |
| 17 | **Open tracking OFF by default** | If pixel tracking ships at all: default off, per-send opt-in, privacy copy. No dark patterns. | Founders hate being tracked; don't become the villain. | Privacy positioning vs sales tools. | Solo+ (if feature exists) |
| 18 | **Attachment virus scan** | Scan inbound attachments (ClamAV-class or vendor API) before download; quarantine UI. | Safety for catch-all domains that eat everything. | Trust feature suites have; indie hosts skip. | Builder+ |
| 19 | **Custom domain for webhooks** | Serve webhook docs/endpoints under `hooks.customer.com` or signed custom host for agency branding. | Agencies want clean integration surfaces. | Rare. | Studio |
| 20 | **Audit log for Studio** | Who read/exported/changed aliases/billing; exportable CSV; retention 90 days. | Teams and agencies need accountability. | Folio weak; Workspace strong → Flap fills middle. | Studio |
| 21 | **Domain park / pause billing** | Park a domain: stop inbound processing or keep receive-only; reduce quota count or pause add-on; clear restore path. | Side projects die and revive; full delete is scary. | Unique retention lever. | Solo+ |
| 22 | **Dark mode** | System + manual theme; keep editorial teal identity. Ship **after** keyboard + colors. | Night users ask; brand is light-first so defer polish. | Table stakes eventually. | Free |
| 23 | **Compose domain templates pack** | Starter templates per new domain: Thanks / Pricing / Bug ack / Waitlist. | Empty compose box slows support. | Easy upsell of existing TipTap. | Free |
| 24 | **Webhook out: mail.sent / bounce / complaint** | Expand event types beyond received; same delivery log UX. | Ops automations need full lifecycle. | Completes API story vs ImprovMX. | Builder+ |
| 25 | **Referral after-verify UX** | Modal + share card when MX turns green: "Invite a founder, both get +1 domain." | Growth loop already coded; unused = waste. | Hydra/Folio weaker on this loop. | Free |

**P1 count: 25**

---

## P2 / Moat features

Longer bets that make Flap hard to leave and hard to clone as a thin Hydra clone.

| # | Name | Description | Why users care | Competitor gap | Plan gate |
|---|------|-------------|----------------|----------------|-----------|
| 1 | **MCP light** | Read-only MCP server: list domains, unread counts, fetch thread summary, draft-with-confirm. No silent send. | AI-native founders will ask; stay safe. | Mektup/AI mail toys; Flap can be sober. | Builder+ |
| 2 | **Newsletter one-shot from mailbox** | Single blast to a tagged list from a domain, hard caps, double opt-in required, SES config set, **not** a full ESP. | Launch announcements without Mailchimp. | Dangerous if abused; careful caps. | Studio (strict quotas) |
| 3 | **SSO (SAML/OIDC)** | Google Workspace / Okta SSO for Studio orgs. | Agencies and tiny teams graduating. | Table stakes for B2B later. | Studio (add-on or included) |
| 4 | **Per-domain sending sub-users / IAM** | Map Studio roles to domains (can send as X, not Y). | Agency least-privilege. | Deep Studio moat. | Studio |
| 5 | **Shadow inbox / hire-a-VA mode** | Time-boxed invite with scoped mailbox access; auto-revoke. | Founders hire VAs without full seat forever. | Unique. | Studio |
| 6 | **Deliverability war room** | Cross-domain heat map, suggested pause, one-click suppress bad recipients. | When SES reputation wobbles, panic needs a UI. | Hosts bury this in support tickets. | Studio |
| 7 | **Public API v2 + SDKs** | Versioned REST, TypeScript/Python thin SDKs, Postman collection. | Indie hackers automate support → Linear/Notion. | ImprovMX has API; Flap has inbox+API combo. | Builder+ |
| 8 | **Multi-workspace / holding company** | Separate billing + brand walls under one login (holding-of-one → many). | Folio content angle; productize it. | Folio narrative; Flap can ship structure. | Studio |
| 9 | **Inbound parse → structured fields** | Rules extract order id / refund amount into metadata + webhook payload. | Support automation without Zapier gymnastics. | ESP feature in an inbox. | Builder+ |
| 10 | **Native push + better offline PWA** | Web push for new mail; cache last N threads. | Phone-first triage. | After PWA polish. | Free / Solo |
| 11 | **Custom retention policies** | Per-domain auto-delete / archive after N days; legal hold flag. | Storage and privacy control. | Enterprise-lite. | Studio |
| 12 | **Email authentication upgrades** | BIMI assist, MTA-STS/TLS-RPT setup wizard tied to domain. | Deliverability nerds and brand inboxes. | Tools + product loop. | Builder+ |
| 13 | **Competitor switcher packs** | One-click migration recipes: Folio, Hydra, Migadu, JustEmails (export map + DNS). | Lower switching friction inbound. | Aggressive GTM productization. | Free |
| 14 | **SLA / priority support (real)** | Defined response times for Studio; drop fake badge until real. | Trust. | Only if ops can deliver. | Studio |
| 15 | **Readonly embed inbox widget** | Embed latest public announcements mailbox on a marketing site (opt-in). | Weird but sticky for launch logs / changelogs. | Unique experiment. | Builder+ |

**P2 count: 15**

---

## Free tools to build (SEO)

Each tool: no-login, fast, CTA "Fix this permanently in Flap DNS wizard." Prefer indexable `/tools/...` pages.

| # | Tool | Intent | Priority | Status |
|---|------|--------|----------|--------|
| 1 | MX checker | mx lookup | P0 keep | Has |
| 2 | SPF checker | spf check | P0 keep | Has |
| 3 | DKIM checker | dkim verify | P0 keep | Has |
| 4 | DMARC checker | dmarc check | P0 keep | Has |
| 5 | Email setup checker (combo) | email dns check | P0 keep | Has |
| 6 | Workspace cost calculator | workspace multi-domain cost | P0 keep | Has |
| 7 | Email header analyzer | read message headers | P0 build | To build |
| 8 | Blacklist / RBL checker | email blacklist | P0 build | To build |
| 9 | DMARC generator | dmarc record generator | P0 build | To build |
| 10 | SPF generator / flattener helper | too many dns lookups | P0 build | To build |
| 11 | Deliverability scorecard (A-F) | deliverability test | P1 | To build |
| 12 | BIMI checker | bimi record | P1 | To build |
| 13 | MTA-STS / TLS-RPT checker | mta-sts | P1 | To build |
| 14 | Catch-all detector | does domain have catch-all | P1 | To build |
| 15 | DNS propagation (MX/TXT) | mx propagation | P1 | To build |
| 16 | DKIM generator assist | dkim record generator | P1 | To build |
| 17 | Plus-address / alias tester | email alias test | P1 | To build |
| 18 | From-domain mismatch educator | reply from wrong address | P1 | To build |
| 19 | PTR / reverse DNS checker | ptr lookup | P2 | To build |
| 20 | SMTP banner probe (safe) | smtp port 25 test | P2 careful | To build |
| 21 | WHOIS / nameserver quick view | who is my dns host | P2 | To build / link-out |
| 22 | ARC / forward DMARC explainer | failed dmarc forward | P2 | To build |
| 23 | Registrar copy-block toolizer | paste-ready records | P1 | Partial (guides) |
| 24 | Flap vs Workspace share card | calculator derivative | P1 | Extend |

---

## Features to avoid / defer

| Avoid / defer | Why |
|---------------|-----|
| **Cold outbound sequences / full ESP** | SES reputation death; wrong ICP; become "spam tool." Stay reply-and-support. |
| **Native iOS/Android apps before IMAP or excellent PWA** | Costly; protocol or PWA covers 80%. |
| **Auto-send AI agents** | Support nightmares and brand risk; confirm-only AI only. |
| **Per-seat Workspace clone pricing** | Flap's wedge is domain-first; don't become Google. |
| **Marketing IMAP/priority support before real** | Credibility burn (already flagged in UX guide). |
| **Dark mode before Cmd+K + From lock** | Brand is light editorial; speed/identity first. |
| **Unlimited free domains race with Hydra** | Race Free *usability* and paid depth, not free domain count alone. |
| **Rebuilding folders/labels/filters/API** | Already ship; market and polish, don't rewrite. |
| **Newsletter product expansion** | One-shot with hard caps max; no Mailchimp clone. |
| **"Cloudflare email" positioning** | Customer mail is SES; lying loses trust vs CF Routing buyers. |

---

## Suggested 30-day eng order (opinionated)

1. Domain colors + From lock + unread-per-domain rail  
2. Cmd+K + keyboard triage + `?` cheat sheet  
3. New project 60s wizard + pre-MX test polish  
4. Undo send + send later + snooze v1  
5. Webhook delivery log + Slack/Discord notify  
6. Export/cancel trust pack  
7. Plus-addressing UI  
8. PWA install prompt  

Then P1: assignments/collision, deliverability dashboard, CF Routing migrate wizard, AI confirm-only, IMAP go/no-go.

---

## Counts

| Section | Features |
|---------|----------|
| Already strong (market, don't rebuild) | 9 areas |
| P0 (30 days) | **18** |
| P1 (30-90 days) | **25** |
| P2 / moat | **15** |
| Free tools (table rows) | **24** (6 has, 18 to build/extend) |
| Avoid / defer | **10** |
| **New capability items (P0+P1+P2)** | **58** |

---

## Bottom line for Ashish

Marketing research without this list looked like pricing + polish. The engineer backlog is **58 new capabilities**: identity/keyboard in 30 days, team+deliverability+migration in 90, moat (MCP, agency portal, SSO, isolation) after. Market what already ships; build what Hydra/Folio cannot copy quickly (Studio assignments, webhooks depth, SES deliverability, migrate wizards, API).
