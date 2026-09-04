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
   - `BETTER_AUTH_SECRET` (or `SESSION_SECRET`), `APP_URL=https://useflap.online`, `SAAS_MODE=true`
   - `SYSTEM_FROM_EMAIL=noreply@useflap.online` (magic-link + verification via SEB)
   - Dodo live: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`
   - Products: `DODO_PRODUCT_SOLO`, `DODO_PRODUCT_BUILDER`, `DODO_PRODUCT_STUDIO`
   - OAuth optional: Google / GitHub client IDs + secrets
3. Point Dodo webhook to `https://useflap.online/api/billing/webhook`
4. `npm run deploy`
5. Complete **Outbound auth mail (SEB)** below so magic-link / verify emails deliver

### Outbound auth mail (SEB) — useflap.online

Magic-link and verification mail use the Worker `send_email` binding (`SEB`) and `SYSTEM_FROM_EMAIL`. Without Email Sending onboarding, Cloudflare only delivers to **verified destination addresses** in the account (not arbitrary user inboxes).

1. **Workers Paid** — required to send to arbitrary recipients (not only verified destinations).
2. **`wrangler.jsonc`** — keep an unrestricted binding (no `destination_address` / `allowed_destination_addresses` on `SEB`), or magic links to user Gmail/etc. will fail with `E_RECIPIENT_NOT_ALLOWED`.
3. **Secret** — `wrangler secret put SYSTEM_FROM_EMAIL` → `noreply@useflap.online` (or another mailbox on a Flap-managed / Email Routing domain). Envelope `from` must match this address.
4. **Domain onboarding** — Cloudflare Dashboard → Email → Email Routing (and Email Sending if shown): enable routing for `useflap.online`, then **onboard the domain for sending** so SEB may send to any recipient. Until onboarded, only Email Routing “Destination addresses” work.
5. **DNS** — MX to `route*.mx.cloudflare.net`; SPF includes `_spf.mx.cloudflare.net`; publish DKIM from Email Routing → Settings (often `cf2024-1`).
6. **Optional mailbox** — create `noreply@useflap.online` (or catch-all) and a routing rule → Send to Worker if you want replies/bounces visible in Flap; sending still needs the domain onboarded as above.
7. **Verify** — request a magic link to an address that is *not* a verified destination; Workers logs should no longer show `system email send failed`. On failure, logs now include `code=` / SEB detail (e.g. `E_SENDER_NOT_VERIFIED`, `E_RECIPIENT_NOT_ALLOWED`).

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
- Password signups / magic links need `SYSTEM_FROM_EMAIL` + SEB with Email Sending onboarded for `useflap.online` (see checklist above). OAuth accounts are verified on first login.
- Referral rewards require verified email + a connected domain; self/disposable emails and shared Dodo customer / payment fingerprints are blocked.
