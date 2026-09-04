# Flap

**Hosted custom-domain email at [useflap.online](https://useflap.online).**

Flap is a mailbox product: inbox, send, aliases, rules, drafts/scheduled mail, API keys, and webhooks — with Free / Starter / Pro / Business plans billed through Dodo Payments.

## Product surface

- Marketing site: `/` (features, pricing, FAQ)
- Auth: `/signup`, `/login`, first-boot `/setup`
- Legal: `/terms`, `/privacy`, `/billing-terms`
- App: `/app` (inbox), `/app/settings` (domain setup, billing, developers)
- Health: `GET /api/health`

Support: [support@useflap.online](mailto:support@useflap.online)

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill SESSION_SECRET at minimum
npm run db:migrate:local
npm run dev
```

Open the Vite URL, create an account, then Settings → Setup to add a domain and mailbox.

## Production deploy checklist

1. Apply D1 migrations: `npm run db:migrate:remote` (see `migrations/README.md` — **0005_billing** + **0007_quota_enforcement** for plans/quotas).
2. Set Worker secrets (see `.dev.vars.example`):
   - `SESSION_SECRET`, `APP_URL=https://useflap.online`, `SAAS_MODE=true`
   - Dodo: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`
   - Product IDs: `DODO_PRODUCT_PRO`, `DODO_PRODUCT_TEAM` (legacy aliases: `DODO_PRODUCT_STARTER`→Pro, `DODO_PRODUCT_BUSINESS`→Team)
   - OAuth (optional): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; GitHub: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - Callbacks: `/api/auth/google/callback`, `/api/auth/github/callback`
3. Point Dodo webhook to `https://useflap.online/api/billing/webhook`
4. `npm run deploy`
5. Configure Cloudflare Email Routing → Send to Worker for each mailbox address

If Dodo keys or product IDs are missing, the app stays usable on Free and shows clear “contact support / configure” messaging instead of broken checkout.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run check` | Typecheck app + worker |
| `npm run build` | Production frontend build |
| `npm run deploy` | Build + Wrangler deploy |
| `npm run db:migrate:local` / `remote` | Apply D1 migrations |

## Notes

- Internal Cloudflare resource names may still say `inlet` (Worker/D1/R2 bindings). That is infrastructure naming, not the product brand.
- Shared team inboxes are roadmap (Business) — Settings → Team records interest only.
- Password reset is not shipped yet; support resets are manual.
