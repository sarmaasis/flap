# Flap Pricing Spec — September 2026

> **Purpose:** Define the optimal pricing structure for Flap to sustain operations at $20/month with zero paying users, and to grow sustainably as users convert. This document covers COGS, competitor landscape, feature paywall gates, and recommended plan configuration.

---

## 1. Infrastructure Cost at Zero Paying Users

| Service | Cost with 0 paying users | Notes |
|---|---|---|
| **Cloudflare Workers** (Paid plan) | $5/mo | Required for D1 database writes in production. Includes 10M requests/day, D1 reads/writes, KV, R2. |
| **Amazon SES** | ~$0/mo | Still in sandbox (DENIED production review). Sandbox = $0. Production: $0.10/1k emails. With 0 active users: ~$0. |
| **Clerk** (auth) | $0/mo | Free for first 10,000 MAU. Only costs if you hit 10k active users/month. |
| **Cloudflare R2** (attachments) | $0/mo | 10 GB free tier; 1M Class A ops free. With 0 users: $0. |
| **Domain** (useflap.online) | ~$1/mo | Amortized ~$10-15/year. |
| **GitHub Actions** | $0/mo | Free tier for public/private repos with 2,000 min/month. |
| **Dodo Payments** | $0/mo | No monthly fee; takes a percentage only on successful transactions. |
| **Total** | **~$6–7/mo** | Well under the $20/month budget. |

### Breakeven with Paying Users

| Scenario | Monthly Revenue | Infrastructure | Margin |
|---|---|---|---|
| 0 paying users | $0 | ~$6 | -$6 |
| 1 × Solo ($6/mo) | $6 | ~$6.50 | -$0.50 |
| 2 × Solo ($6/mo) | $12 | ~$7 | +$5 |
| 1 × Pro ($12/mo) | $12 | ~$7 | +$5 |
| 3 × Solo or 2 × Pro | $18–24 | ~$8 | +$10–16 |

**Conclusion:** You need only **2 Solo users or 1 Pro user** to cover operating costs and hit the $20/month breakeven. The infrastructure is extremely lean.

---

## 2. Competitor Landscape (September 2026)

| Product | Free Tier | Starter | Mid | Top |
|---|---|---|---|---|
| **Folio** | 100 sends + 1 domain | $2.99–3.50/mo (3 domains) | ~$10/mo (10 domains) | $25+/mo (unlimited) |
| **Hydra** | 3 domains, free forever | $10/mo (5 domains, 10GB) | $19/mo (20 domains, 50GB) | $39/mo (unlimited domains) |
| **Mailmark** | 7-day trial only | $10/mo (5 domains, 25k sends) | $50/mo (unlimited, 100k sends) | $100/mo |
| **Shipmail** | 0 mailboxes (dashboard only) | $4/mo (Solo) | $9/mo (Pro) | $29/mo (Team) |
| **Google Workspace** | 14-day trial | $7/user/domain/mo (Business Starter) | $14/user/mo | $22/user/mo |
| **Zoho Mail** | 5 users/1 domain free | $1/user/mo (Lite) | $4/user/mo | — |
| **ImprovMX** | 1 domain, forwarding only | $9/mo (5 domains) | $24/mo (unlimited) | — |
| **Migadu** | Trial | $19/mo (Micro, 3 domains) | $35/mo | $75/mo |
| **Fastmail** | — | $3/user/mo | $5.50/user/mo | $9/user/mo |

### Key Takeaways

1. **Flap's Solo at $6/mo is competitively priced** vs Hydra ($10 for only 5 domains) and Migadu ($19). The differentiator: 50 domains included on every paid plan is dramatically more generous than any competitor at this price.
2. **Folio ($2.99-3.50/mo) is the most direct price competitor** for single-identity founders. Flap beats it on domain count (50 vs 3) and feature surface (AI, API, newsletters, bookings).
3. **Hydra (free for 3 domains)** is the most dangerous competitor for free-tier acquisition. Flap's free tier (2 domains, real mailboxes, no card) is a solid counter — prove MX before paying.
4. **Shipmail ($4 Solo)** undercuts Flap by $2 but lacks a free tier with real mailboxes. Flap's free tier is a genuine conversion advantage.

---

## 3. Feature Paywall Gates — Current vs Recommended

### What Should Be **Free** (conversion/trust driver)

| Feature | Rationale |
|---|---|
| 2 custom domains | Prove MX before paying. Low COGS: ~0 with sandbox SES. |
| 2 mailboxes | Real functional inbox — not a dashboard-only trial. |
| 200 sends/month | Enough for personal testing; caps abuse. |
| Basic webmail (receive, send, filters, contacts) | Must show product value. |
| Rules and contacts | Low COGS; increases stickiness. |
| Export (JSON + .mbox) | Trust signal. Users won't leave if they trust they can. |
| "Sent with Flap" footer | Distribution / word-of-mouth channel. |

### What Should Be **Paid** (paywall gates)

| Feature | Plan Gate | Rationale |
|---|---|---|
| More than 2 domains / mailboxes | Solo+ | Core capacity scaling; main conversion driver. |
| AI assistant (draft, summarize) | Solo+ | Non-zero inference COGS; LLM provider cost. |
| API keys (transactional send) | Solo+ | Developer value; SES cost scales with usage. |
| Inbound webhooks | Solo+ | Server-side cost; developer feature. |
| Newsletters / bulk blast | Solo+ | SES send cost; abuse potential. |
| Catch-all addresses | Solo+ | Infrastructure + spam risk for free tier. |
| Booking pages (public) | Solo+ | Server cost minor; but premium feature UX. |
| CalDAV sync | Pro+ | Higher complexity/infra; team feature. |
| Team seats | Pro+ | Multi-seat = team revenue, not solo. |
| Shared inboxes (shared mailboxes) | Team | Requires multi-seat, more complex infra. |
| Remove "Sent with Flap" footer | Solo+ | Distribution trade-off is worth the upgrade. |
| Higher send limits (40k/mo, 120k/mo) | Pro / Team | SES cost scales directly with sends. |
| Priority support | Pro+ | Human time = real COGS. |
| Unlimited saved views | Solo+ | Low COGS; feels premium. |

### Borderline Features (currently free — consider gating)

| Feature | Current | Recommendation |
|---|---|---|
| Calendar (basic week view) | Free | **Keep free** — low COGS, big stickiness. |
| Snooze / labels / workflow | Free | **Keep free** — core inbox feature, needed for trial experience. |
| Data export | Free | **Keep free** — trust signal. |

---

## 4. Current Plan Configuration Assessment

```
Free:  0$/mo — 2 domains, 2 mailboxes, 200 sends, 0 API keys, branding footer
Solo:  $6/mo  — 50 domains, 3 mailboxes, 15k sends, API keys, no footer
Pro:   $12/mo — 50 domains, 6 mailboxes, 5 seats, 40k sends, AI, newsletters
Team:  $29/mo — 50 domains, 12 mailboxes, unlimited seats, 120k sends
Scale: $2.50/mailbox/mo — 13–300 mailboxes
```

### What's Working

- ✅ **50 domains on all paid plans** is the standout value proposition vs every competitor.
- ✅ **Free forever with real mailboxes** beats Shipmail's dashboard-only free tier.
- ✅ **Solo at $6/mo** is competitively placed above Shipmail ($4) but below Hydra ($10 for far fewer domains).
- ✅ **Scale tier at $2.50/mailbox/mo** matches Shipmail and is market rate for agencies.

### What Needs Attention

1. **Solo's mailbox cap (3 boxes) is tight.** Many founders need 4-5 mailboxes (hello@, support@, me@, press@, api@). Consider **4 mailboxes** on Solo — the extra capacity is negligible COGS but meaningfully reduces the "I need Pro just for 1 more mailbox" churn signal.

2. **Pro price ($12/mo) is right, but the jump from Solo ($6) to Pro ($12) is 2×.** This is defensible if the capacity (3→6 mailboxes, 1→5 seats) justifies it for growing teams. Consider framing Pro as "team starter" not just "more boxes."

3. **The API/webhooks behind Solo+ creates friction for developer trials.** Consider a **free API key** (test-mode only) so developers can try the send API without upgrading. Live API keys require Solo+.

4. **AI assistant should be Solo+ but beta remains acceptable on free** for now — the marginal cost of summarizing 200 emails/month is minimal, and it drives conversion.

---

## 5. Recommended Plan Adjustments

### Option A — Minor Tuning (Recommended)

Keep current structure; only adjust mailbox counts:

| Plan | Current mailboxes | Suggested |
|---|---|---|
| Solo | 3 | **4** (reduce upgrade friction) |
| Pro | 6 | 6 (unchanged) |
| Team | 12 | 12 (unchanged) |

Cost impact: near-zero additional SES/storage COGS. Conversion impact: likely positive.

### Option B — Competitive Free Tier (Aggressive)

Match Hydra's "3 domains free forever":

| Plan | Current | Suggested |
|---|---|---|
| Free | 2 domains | **3 domains** |

Risk: slightly longer time-to-paid for Folio/Hydra switchers who now have "enough for free." Only do this if the Hydra free tier proves to be a conversion blocker.

### Option C — Developer Test Mode (Unlock API on Free)

Add a test-mode API key (sandboxed, no live SES sends) to the Free tier. This lets developers evaluate the API without upgrading. Live keys require Solo+.

---

## 6. $20/Month Sustainability Playbook

### Month 1-3: $0 revenue

- Infrastructure: ~$6-7/month → **safe**
- Focus: ship product, get MX approved, get 10 beta users
- SES sandbox is fine for beta (only verified recipients receive)

### Month 4-6: First 2 paying users

- At 2 × Solo ($6/mo): $12/mo revenue, ~$7/mo costs → **near breakeven**
- At 1 × Pro ($12/mo): $12/mo revenue → **breakeven**
- Goal: 3 paying users = positive cash flow

### Month 6+: Growth

- 10 × Solo = $60/mo; 10 × Pro = $120/mo
- Infrastructure scales gradually (Clerk stays free to 10k MAU; SES ~$0.10/1k sends)
- First meaningful infra cost increase is at ~$500 MRR (Clerk hits MAU limits)

### Key levers to reach breakeven fastest

1. **Get SES production access approved** — allows sending to any email, not just verified. Currently blocking real user growth.
2. **Referral program** — existing bonus domain mechanic is already built. Add referral CTA to onboarding.
3. **Product Hunt launch** — low cost, high-visibility. Time for when SES is live.
4. **Content SEO** — already strong (comparison pages, tools, guides). Keep publishing to the blog.

---

## 7. Summary

| Question | Answer |
|---|---|
| Can you run at $20/mo with 0 paying users? | **Yes** — infra is ~$6-7/mo today. |
| How many users to break even? | **2 Solo or 1 Pro** user. |
| Is current pricing competitive? | **Yes** — 50 domains at $6 beats every direct competitor. |
| What should stay free? | Real mailboxes, 2 domains, 200 sends, export, calendar, filters. |
| What should be paywalled? | API keys, newsletters, catch-all, AI (strictly), team seats, more domains/mailboxes. |
| Biggest pricing risk? | Folio at $2.99/mo. Counter: Flap has 50 domains, AI, API, newsletters, bookings. |
| Biggest growth unlock? | **SES production access** — nothing else matters more right now. |

---

*Last updated: 2026-09-08*
