# Dodo Payments wiring (Flap)

Billing is **Dodo Payments**, not Stripe.

## Product IDs (env)

Set in `.dev.vars` / Cloudflare Worker secrets:

| Env var | Plan | Interval |
|---------|------|----------|
| `DODO_PRODUCT_SOLO` | Solo $7/mo | monthly |
| `DODO_PRODUCT_BUILDER` | Builder $19/mo | monthly |
| `DODO_PRODUCT_STUDIO` | Studio $39/mo | monthly |
| `DODO_PRODUCT_SOLO_ANNUAL` | Solo $67/yr | annual (−20%) |
| `DODO_PRODUCT_BUILDER_ANNUAL` | Builder $182/yr | annual |
| `DODO_PRODUCT_STUDIO_ANNUAL` | Studio $374/yr | annual |

Also required: `DODO_PAYMENTS_API_KEY`, webhook secret as already documented in README / `.dev.vars.example`.

Legacy aliases still map: `DODO_PRODUCT_STARTER`→Solo, `DODO_PRODUCT_PRO`→Builder, `DODO_PRODUCT_TEAM`/`BUSINESS`→Studio.

Checkout POST `/api/billing/checkout` body: `{ "plan": "solo"|"builder"|"studio", "interval": "month"|"year" }`.
If an annual product ID is missing, Flap falls back to the monthly product ID.

## Catalog (2026-09-06)

| Plan | Monthly | Annual | Domains | Notes |
|------|---------|--------|---------|-------|
| Free | $0 | — | 2 | 500MB, 400 sends, footer |
| Solo | $7 | $67 | 5 | catch-all, no footer |
| Builder | $19 | $182 | 20 | API + webhooks, hero |
| Studio | $39 | $374 | 40 | up to 10 seats |
