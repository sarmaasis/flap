# Flap Pricing Spec — September 2026

> **Purpose:** Define a sustainable, Flap-owned pricing structure for multi-domain founders and small teams.

## Infrastructure Baseline

| Service | Expected baseline | Notes |
|---|---:|---|
| Cloudflare Workers | ~$5/mo | Required for production app and database writes. |
| Amazon SES | Usage based | Production sends are billed per thousand messages. |
| Clerk | $0 at current scale | Free tier covers early usage. |
| Cloudflare R2 | $0 at current scale | Free tier covers early attachments. |
| Dodo Payments | Transaction based | No platform fee until payments occur. |

The product can stay lean, but send volume and storage must remain visible in plan limits.

## Pricing Position

Flap is not a productivity suite. It is custom-domain email for people who operate several projects, brands, or client domains from one place. Pricing should therefore scale by:

- custom domains,
- mailboxes,
- team seats,
- storage,
- outbound send volume,
- API and webhook usage,
- support burden.

## Current Catalog

| Plan | Monthly | Annual | Domains | Mailboxes | Position |
|---|---:|---:|---:|---:|---|
| Free | $0 | — | 2 | 2 | Prove DNS and receive real mail before paying. |
| Solo | $6 | $60 | 25 | 3 | One founder managing active project domains. |
| Pro | $15 | $150 | 40 | 8 | Small team with shared support and API usage. |
| Team | $35 | $350 | 75 | 18 | Studio or agency managing portfolio/client mail. |
| Scale | $3/mailbox | $30/mailbox | 100 | 19-300 | Predictable expansion beyond Team. |

## Free Plan

Free stays useful because trust starts with a real mailbox. Keep the free tier small enough to protect reputation and cost:

- 2 domains,
- 2 mailboxes,
- 4 aliases,
- 500 MB storage,
- 200 sends/month,
- Flap footer,
- export included.

## Paid Gates

| Feature | Gate | Rationale |
|---|---|---|
| More domains and mailboxes | Solo+ | Core capacity scaling. |
| API keys and webhooks | Solo+ | Developer value and operational load. |
| Newsletter sends | Solo+ | Abuse and deliverability risk. |
| Catch-all | Solo+ | Spam risk and storage load. |
| Team seats | Pro+ | Collaboration value. |
| Shared inboxes | Pro+ | Team workflow. |
| Agency access controls | Team+ | Client/portfolio operations. |
| Concierge onboarding | Scale | Human support time. |

## Claim Boundaries

- Do not claim IMAP/SMTP until credentials and round-trip tests ship.
- Do not describe preview calendar, booking, newsletter, or AI surfaces as fully mature.
- Do not publish invented ratings, fake customer quotes, or broad "all included" claims.
- Keep plan copy tied to measurable limits from `shared/plans.ts`.

## Acceptance Checks

- Pricing page reads from the shared catalog.
- JSON-LD offers match the catalog.
- Billing product IDs match the plan names and intervals.
- SEO copy explains Flap's multi-domain value without leaning on another product's plan ladder.
