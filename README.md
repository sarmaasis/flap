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

1. Set Worker secrets (see `.dev.vars.example`):
   - `BETTER_AUTH_SECRET` (or `SESSION_SECRET`), `APP_URL=https://useflap.online`, `SAAS_MODE=true`
   - `SYSTEM_FROM_EMAIL=noreply@useflap.online`
   - **Amazon SES (required for customer domains):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`, `SES_INBOUND_WEBHOOK_SECRET` (plus `SES_RECEIPT_RULE_SET` / `SES_INBOUND_BUCKET` after deploying `infra/ses-inbound`)
   - Mailgun secrets optional (legacy domains only during migration)
   - Dodo live: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`
   - Products: `DODO_PRODUCT_SOLO`, `DODO_PRODUCT_BUILDER`, `DODO_PRODUCT_STUDIO`
   - OAuth optional: Google / GitHub client IDs + secrets
2. Point Dodo webhook to `https://useflap.online/api/billing/webhook`
3. Deploy SES inbound stack (`infra/ses-inbound`) and set Worker webhook `https://useflap.online/api/inbound/ses` — full steps in [docs/aws-ses-setup.md](docs/aws-ses-setup.md)
4. `npm run deploy` — builds, applies pending remote D1 migrations (`migrations/` via `wrangler.jsonc`, including **0013_ses_provider**), then deploys the Worker/assets
5. Complete **Outbound auth mail** below so magic-link / verify emails deliver

To apply remote migrations without deploying: `npm run db:migrate:remote`. Local Miniflare D1 stays separate: `npm run db:migrate:local`.

### Mail architecture (DNS-agnostic)

Customer domains use **Amazon SES** on every plan (any DNS host → SES MX/DKIM → S3/queue → Worker → D1/R2). Outbound compose uses SES `SendRawEmail`. System mail for `useflap.online` stays on Cloudflare SEB. See [docs/mail-architecture.md](docs/mail-architecture.md), the founder AWS walkthrough [docs/aws-ses-setup.md](docs/aws-ses-setup.md), and [infra/ses-inbound/README.md](infra/ses-inbound/README.md).

**Cost note:** SES is metered but inexpensive at early volume; Free is limited by Flap quotas and anti-abuse, not by a separate Free=Cloudflare transport.

### Outbound auth mail — useflap.online

Magic-link and verification mail use `SYSTEM_FROM_EMAIL` via **SEB** when the `send_email` binding is configured. Do not send critical auth mail through the customer SES configuration.

#### Option A — SEB (Cloudflare Email Sending) for system mail

1. **Workers Paid** — required to send to arbitrary recipients.
2. **`wrangler.jsonc`** — unrestricted `SEB` binding (no destination allowlist).
3. **Secret** — `SYSTEM_FROM_EMAIL=noreply@useflap.online`.
4. Onboard `useflap.online` for Email Sending in the Cloudflare dashboard; publish MX/SPF/DKIM for that domain as Cloudflare documents.
5. Ensure Email Routing has a domain-level catch-all (or address routes) to Worker `flap` for inbound system replies if needed.
6. Verify with a magic link to a non-verified destination address.

#### Option B — Temporary fallback

If SEB is unbound in local/dev, configure a verified system From elsewhere; production should use SEB for `useflap.online`.

### Auth email rate limits

Magic-link and verification sends are throttled in D1 (`auth_email_rate_log`, migration **0011**) to protect sending quotas. Fail closed with HTTP **429**.

| Scope | Limit |
|-------|--------|
| Per email + kind (`magic_link` / `verify_email`) | **3 / 15 min**, **10 / rolling 24h** |
| Per IP + kind | **10 / hour** |

Enforced on `/sign-in/magic-link` (before hook) and inside `sendVerificationEmail` (covers `/send-verification-email`, Settings resend, and `sendOnSignUp`). See `worker/lib/auth-email-rate-limit.ts`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run check` | Typecheck app + worker + unit tests |
| `npm run build` | Production frontend build + marketing HTML prerender |
| `npm run prerender` | Write SEO HTML shells into `dist/client` (after vite build) |
| `npm run deploy` | Build → remote D1 migrations → Wrangler deploy |
| `npm run db:migrate:local` / `remote` | Apply D1 migrations (local Miniflare / production) |

## SEO / prerender

This is a Vite SPA on Cloudflare Assets — not full React SSR. Build-time prerender injects meta + crawlable HTML for landing, SEO pages, guides, tools, blog, and legal; regenerates `sitemap.xml`. Static `robots.txt`, `llms.txt`, and `llms-full.txt` ship from `public/`. See [docs/ssr-prerender.md](docs/ssr-prerender.md).

## Notes

- Password reset is not shipped yet; support resets are manual.
- Password signups / magic links need `SYSTEM_FROM_EMAIL` plus SEB (see checklist above). OAuth accounts are verified on first login.
- Referral rewards require verified email + a connected domain; self/disposable emails and shared Dodo customer / payment fingerprints are blocked.

## Cloudflare rename: `inlet` → `flap`

Repo folder on disk may stay `inlet`; product / Wrangler names are **flap**. Bindings stay stable: `DB`, `ATTACHMENTS`, `SEB`, `ASSETS`.

| Resource | Old | New |
|----------|-----|-----|
| Worker `name` | `inlet` | `flap` |
| D1 `database_name` | `inlet` | `flap` |
| D1 binding | `DB` | `DB` (unchanged) |
| R2 `bucket_name` | `inlet-attachments` | `flap-attachments` |
| R2 binding | `INLET_ATTACHMENTS` | `ATTACHMENTS` |
| Migrate CLI | `wrangler d1 migrations apply inlet` | `… apply flap` |
| CI concurrency | `inlet-production` | `flap-production` |

### Manual steps (required before first successful deploy)

Changing `wrangler.jsonc` `name` deploys a **new** Worker script named `flap`. Secrets and custom domains do **not** move automatically. SEB stays configured as `send_email` name `SEB` — do not rename that binding.

**1. Worker**

1. Deploy once after this rename (`npm run deploy`) so Worker `flap` exists.
2. Re-put every secret on the new Worker (`wrangler secret put …`), matching `.dev.vars.example` / production checklist above.
3. In Dashboard → Workers → `flap`: attach custom domains / routes previously on `inlet` (e.g. `useflap.online`).
4. Move Email Routing “Send to Worker” rules from Worker `inlet` to `flap`.
5. When traffic is confirmed on `flap`, delete or disable the old `inlet` Worker.

**2. D1 (pick one — data loss risk if you recreate empty)**

- **Prefer rename / keep ID:** In Dashboard, rename database `inlet` → `flap` if available, **or** leave the existing UUID in `wrangler.jsonc` `database_id` and only ensure CLI lookup by name works (`wrangler d1 list`). `npm run db:migrate:remote` uses the name `flap`.
- **Or create new:** `wrangler d1 create flap`, export/import data from the old DB, then set `database_id` in `wrangler.jsonc` to the new UUID. Recreating without a dump **wipes users, mail, billing state**.

**3. R2**

- Create bucket `flap-attachments` (`wrangler r2 bucket create flap-attachments`).
- Copy objects from `inlet-attachments` → `flap-attachments` (Dashboard / rclone / script). Binding is now `ATTACHMENTS`.
- After verification, retire `inlet-attachments`. Skipping the copy **loses attachment blobs** (DB rows will 404).

**4. Verify**

- `GET /api/health` → `name: "Flap"`
- Magic-link / verify mail (SEB) still sends
- Open an existing message with attachments
- `npm run db:migrate:remote` succeeds against D1 named `flap`
