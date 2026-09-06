# Dodo Payments wiring (Flap)

Billing is **Dodo Payments**, not Stripe.

## Product IDs (env)

Set in `.dev.vars` / Cloudflare Worker secrets:

| Env var | Plan | Interval |
|---------|------|----------|
| `DODO_PRODUCT_SOLO` | Solo $5/mo | monthly |
| `DODO_PRODUCT_PRO` | Pro $12/mo | monthly |
| `DODO_PRODUCT_TEAM` | Team $29/mo | monthly |
| `DODO_PRODUCT_SCALE` | Scale $2.50/mailbox/mo | monthly |
| `DODO_PRODUCT_SOLO_ANNUAL` | Solo $50/yr | annual (10×) |
| `DODO_PRODUCT_PRO_ANNUAL` | Pro $120/yr | annual |
| `DODO_PRODUCT_TEAM_ANNUAL` | Team $290/yr | annual |
| `DODO_PRODUCT_SCALE_ANNUAL` | Scale $25/mailbox/yr | annual |

Also required: `DODO_PAYMENTS_API_KEY`, webhook secret as already documented in README / `.dev.vars.example`.

Legacy aliases still map: `DODO_PRODUCT_BUILDER`→Pro, `DODO_PRODUCT_STUDIO`/`BUSINESS`→Team, `DODO_PRODUCT_STARTER`→Solo.

Checkout POST `/api/billing/checkout` body: `{ "plan": "solo"|"pro"|"team"|"scale", "interval": "month"|"year" }`.
If an annual product ID is missing, Flap falls back to the monthly product ID.

## Catalog (2026-09-07, docs/shipmail-redesign.md §3.3)

| Plan | Monthly | Annual | Domains | Mailboxes | Notes |
|------|---------|--------|---------|-----------|-------|
| Free | $0 | — | 2 | 2 | 500MB, 200 sends, footer |
| Solo | $5 | $50 | 5 | 4 | catch-all, no footer |
| Pro | $12 | $120 | 15 | 12 | hero; up to 5 seats |
| Team | $29 | $290 | 40 | 30 | unlimited seats |
| Scale | $2.50/mailbox | $25/mailbox | 50 | 13–300 | per-mailbox |
