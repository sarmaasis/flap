# Flap product mail strategy (SES)

**Status:** Implementation decision (supersedes hybrid Free=CF / Paid=Mailgun).  
**Date:** 2026-09-05

---

## Executive summary

All customer plans (Free, Solo, Builder, Studio) use **Amazon SES** for customer-domain mail. Cloudflare is Flap infrastructure and system mail (`useflap.online`) only — **not** a customer prerequisite.

| Layer | Transport |
|--------|-----------|
| System (`useflap.online`) | Cloudflare Email Routing + SEB |
| Customer domains | Amazon SES inbound + outbound |

**Positioning:** One inbox for every domain you launch. Add MX at any DNS host. Upgrade for more domains/mailboxes/sends — never for a different mail pipe.

The earlier hybrid proposal (Free on Cloudflare Email Routing, Paid on Mailgun) is **rejected** to keep one setup story, avoid Free→Paid MX migration, and keep Free COGS bounded by quotas/anti-abuse rather than a second transport.

---

## Why not hybrid

| Hybrid claim | Why we dropped it |
|--------------|-------------------|
| Free on CF for COGS | Forces Cloudflare zone + Worker rule; false “ready” when routes missing |
| Paid = Mailgun for DNS freedom | Two setup stories + upgrade MX cutover support load |
| Upgrade unlocks “any DNS” | SES already gives DNS-anywhere on Free |

SES usage at early volume is low tens of dollars/month; abuse, support, and storage dominate. Cap Free with plan quotas (1 domain / 2 mailboxes / 100 sends).

---

## User journey (all plans)

1. Create Flap account → verify email  
2. Add domain → Flap creates SES identity + DNS checklist  
3. Publish verification, DKIM, MX at **any** DNS host  
4. Check setup (identity + MX + receipt readiness — distinct states)  
5. Create `hello@domain` (no DNS change)  
6. Receive + send a real test email  

Adding `support@` later is Settings-only.

---

## Plans

| Plan | Domains | Mailboxes | Sends/month |
|------|--------:|----------:|------------:|
| Free | 1 | 2 | 100 |
| Solo | 3 | 10 | 500 |
| Builder | 10 | 30 | 2,000 |
| Studio | 40 | 100 | 10,000 |

Upgrading unlocks capacity immediately with **no** DNS migration.

---

## Messaging

### Do

- Say customer mail works with **any DNS host** (including Free).  
- Say Flap does **not** require moving nameservers to Cloudflare.  
- Separate receiving vs sending readiness in UI.  
- Keep system auth mail on Cloudflare.

### Don’t

- Promise Free “on Cloudflare” or Paid-only “DNS anywhere.”  
- Show a single “Connected” badge when only the DB row exists.  
- Route magic links through customer SES.

---

## Implementation pointer

Ship details live in `docs/mail-architecture.md`, `docs/aws-ses-setup.md`, and `infra/ses-inbound/`. This doc is product intent only.
