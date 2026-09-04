# Flap

**One inbox for every startup you build** — hosted custom-domain email at [useflap.online](https://useflap.online).

Flap targets indie hackers and serial founders who own multiple domains and do not want a separate Google Workspace (or similar) for every project.

## Plans (domain-first)

| Plan | Price | Domains | Seats | Notes |
|------|-------|---------|-------|-------|
| Free | $0 | 1 | 1 | Trial + “Sent with Flap” footer |
| Solo | $9 | 3 | 1 | Entry paid |
| Builder | $19 | 10 | 1 | Highlighted |
| Studio | $39 | 40 | up to 10 | Shared inboxes |

Referrals: invite a founder → both get **+1 domain permanently** after the invitee connects a domain.

## Product surface

- Marketing: `/` plus SEO pages, guides, DNS tools, Workspace cost calculator
- Auth: `/signup`, `/login`, first-boot `/setup`
- App: `/app` (inbox), `/app/settings` (setup, billing, referrals, team)
- Health: `GET /api/health`

Support: [support@useflap.online](mailto:support@useflap.online)

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill SESSION_SECRET at minimum
npm run db:migrate:local
npm run check                    # optional: pricing math self-test
npx tsx shared/calculator.test.ts
npm run dev
```

### Local Dodo test checkout

Checkout is enabled when `DODO_PAYMENTS_API_KEY` and at least one paid product ID are set.

```bash
DODO_PAYMENTS_API_KEY=your_test_api_key
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PRODUCT_SOLO=pdt_…
DODO_PRODUCT_BUILDER=pdt_…
DODO_PRODUCT_STUDIO=pdt_…
# Legacy aliases still work: DODO_PRODUCT_PRO→Builder, DODO_PRODUCT_TEAM→Studio, DODO_PRODUCT_STARTER→Solo
```

## Production deploy checklist

1. Apply D1 migrations through **0009_analytics_verify_abuse**: `npm run db:migrate:remote`
2. Set Worker secrets (see `.dev.vars.example`):
   - `SESSION_SECRET`, `APP_URL=https://useflap.online`, `SAAS_MODE=true`
   - `SYSTEM_FROM_EMAIL=noreply@useflap.online` (verification mail via SEB)
   - Dodo live: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`
   - Products: `DODO_PRODUCT_SOLO`, `DODO_PRODUCT_BUILDER`, `DODO_PRODUCT_STUDIO`
   - OAuth optional: Google / GitHub client IDs + secrets
3. Point Dodo webhook to `https://useflap.online/api/billing/webhook`
4. `npm run deploy`
5. Cloudflare Email Routing → Send to Worker for each mailbox; ensure `SYSTEM_FROM_EMAIL` can send via the SEB binding

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run check` | Typecheck app + worker |
| `npm run build` | Production frontend build |
| `npm run deploy` | Build + Wrangler deploy |
| `npm run db:migrate:local` / `remote` | Apply D1 migrations |

## Notes

- Internal Cloudflare resource names may still say `inlet` (Worker/D1/R2 bindings).
- Password reset is not shipped yet; support resets are manual.
- Password signups must click the verification email link (`SYSTEM_FROM_EMAIL` + SEB). OAuth accounts are verified on first login.
- Referral rewards require verified email + a connected domain; self/disposable emails and shared Dodo customer / payment fingerprints are blocked.
