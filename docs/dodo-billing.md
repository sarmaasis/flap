# Dodo Payments wiring (Flap)

Billing is **Dodo Payments**, not Stripe.

## Product IDs (env)

Set in `.dev.vars` / Cloudflare Worker secrets:

| Env var | Plan | Interval |
|---------|------|----------|
| `DODO_PRODUCT_SOLO` | Solo $6/mo | monthly |
| `DODO_PRODUCT_PRO` | Pro $15/mo | monthly |
| `DODO_PRODUCT_TEAM` | Team $35/mo | monthly |
| `DODO_PRODUCT_SCALE` | Scale $3/mailbox/mo | monthly |
| `DODO_PRODUCT_SOLO_ANNUAL` | Solo $60/yr | annual (10×) |
| `DODO_PRODUCT_PRO_ANNUAL` | Pro $150/yr | annual |
| `DODO_PRODUCT_TEAM_ANNUAL` | Team $350/yr | annual |
| `DODO_PRODUCT_SCALE_ANNUAL` | Scale $30/mailbox/yr | annual |

Also required: `DODO_PAYMENTS_API_KEY`, webhook secret as already documented in README / `.dev.vars.example`.

Legacy aliases still map: `DODO_PRODUCT_BUILDER`→Pro, `DODO_PRODUCT_STUDIO`/`BUSINESS`→Team, `DODO_PRODUCT_STARTER`→Solo.

Checkout POST `/api/billing/checkout` body: `{ "plan": "solo"|"pro"|"team"|"scale", "interval": "month"|"year" }`.
If an annual product ID is missing, Flap falls back to the monthly product ID.

## Catalog (authoritative: `shared/plans.ts`)

| Plan | Monthly | Annual | Domains | Mailboxes | Notes |
|------|---------|--------|---------|-----------|-------|
| Free | $0 | — | 2 | 2 | 500MB, 200 sends, footer |
| Solo | $6 | $60 | 25 | 3 | founder plan |
| Pro | $15 | $150 | 40 | 8 | highlighted; up to 5 seats |
| Team | $35 | $350 | 75 | 18 | studio and agency plan |
| Scale | $3/mailbox | $30/mailbox | 100 | 19–300 | per-mailbox |
