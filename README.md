# Flap

**One inbox for every startup you build** - hosted custom-domain email at [useflap.online](https://useflap.online).

Flap targets indie hackers and serial founders who own multiple domains and do not want a separate Google Workspace (or similar) for every project.

## Plans (domain-first)

Source of truth: `shared/plans.ts`.

| Plan | Price | Domains | Seats | Notes |
|------|-------|---------|-------|-------|
| Free | $0 | 2 | 1 | Trial + “Sent with Flap” footer |
| Solo | $5 | 5 | 1 | Catch-all; no Flap footer |
| Pro | $12 | 15 | 5 | Highlighted; API + seats |
| Team | $29 | 40 | unlimited | Shared inboxes |
| Scale | $2.50/mailbox | 50 | unlimited | 13–300 mailboxes |

Annual billing is **10× monthly** (2 months free). Referrals: invite a founder → both get **+1 domain permanently** after the invitee connects a domain.

## Product surface

- Marketing: `/`, `/pricing`, SEO pages, `/guides`, `/tools`, `/docs`, `/blog`, `/for`, `/vs`, `/research`, `/security`, `/status`, `/support`
- Auth: `/signup`, `/login`, first-boot `/setup`
- App: `/app` (inbox), `/app/settings` (setup, billing, referrals, team)
- Health: `GET /api/health`

Support: [support@useflap.online](mailto:support@useflap.online)

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY at minimum
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
DODO_PRODUCT_PRO=pdt_…
DODO_PRODUCT_TEAM=pdt_…
DODO_PRODUCT_SCALE=pdt_…
# Legacy aliases still work: DODO_PRODUCT_BUILDER→Pro, DODO_PRODUCT_STUDIO→Team, DODO_PRODUCT_STARTER→Solo
```

## Production deploy checklist

1. Set Worker secrets (see `.dev.vars.example`):
   - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (optional `CLERK_JWT_KEY` for networkless JWT verify), `APP_URL=https://useflap.online`, `SAAS_MODE=true`
   - `SYSTEM_FROM_EMAIL=noreply@useflap.online`
   - **Amazon SES (required for customer domains):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`, `SES_INBOUND_WEBHOOK_SECRET` (plus `SES_RECEIPT_RULE_SET` / `SES_INBOUND_BUCKET` after deploying `infra/ses-inbound`)
   - Mailgun secrets optional (legacy domains only during migration)
   - Dodo live: `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT=live_mode`
   - Products: `DODO_PRODUCT_SOLO`, `DODO_PRODUCT_BUILDER`, `DODO_PRODUCT_STUDIO`
   - OAuth / magic link: enable Email link + Google/GitHub in the Clerk Dashboard (allowed origins + redirect URLs `/sso-callback`, `/auth/verify`)
2. Point Dodo webhook to `https://useflap.online/api/billing/webhook`
3. Deploy SES inbound stack (`infra/ses-inbound`) and set Worker webhook `https://useflap.online/api/inbound/ses` — full steps in [docs/aws-ses-setup.md](docs/aws-ses-setup.md)
4. `npm run deploy` — builds, applies pending remote D1 migrations (`migrations/` via `wrangler.jsonc`, including **0013_ses_provider** and **0022_clerk**), then deploys the Worker/assets. Durable Object migration tag **`v1-inbox-hub`** registers `InboxHub` (`INBOX_HUB` binding); do not add a `deleted_classes` migration while that binding exists (CF error 10061).
5. Confirm Clerk auth mail delivers (Clerk sends magic-link / verification email; Flap SEB is for product/system mail)

**SPA note:** `/app` and other app shells are served by the Worker (`serveSpaShell` → `/spa-shell` asset). Do not fetch `/index.html` for those routes - Assets `html_handling` redirects `/index.html` → `/`, which used to bounce hard-refresh of `/app` to the marketing homepage.

**Inbox updates:** authenticated clients open `wss://…/api/events/ws` to a per-workspace `InboxHub` Durable Object. Inbound mail broadcasts `mail.received`; the DO uses **WebSocket hibernation** (`ctx.acceptWebSocket`) so idle connections stay open without GB-sec duration charges. Focus/visibility still refetch counts as a light safety net - there is no interval `/api/counts` polling.

To apply remote migrations without deploying: `npm run db:migrate:remote`. Local Miniflare D1 stays separate: `npm run db:migrate:local`.

### Mail architecture (DNS-agnostic)

Customer domains use **Amazon SES** on every plan (any DNS host → SES MX/DKIM → S3/queue → Worker → D1/R2). Outbound compose uses SES `SendRawEmail`. System mail for `useflap.online` stays on Cloudflare SEB. See [docs/mail-architecture.md](docs/mail-architecture.md), the founder AWS walkthrough [docs/aws-ses-setup.md](docs/aws-ses-setup.md), and [infra/ses-inbound/README.md](infra/ses-inbound/README.md).

**Cost note:** SES is metered but inexpensive at early volume; Free is limited by Flap quotas and anti-abuse, not by a separate Free=Cloudflare transport.

### Outbound system mail — useflap.online

Product/system mail uses `SYSTEM_FROM_EMAIL` via **SEB** when the `send_email` binding is configured. **Clerk** sends account magic-link and verification email from your Clerk instance (configure the from-address in the Clerk Dashboard).

#### Option A - SEB (Cloudflare Email Sending) for system mail

1. **Workers Paid** - required to send to arbitrary recipients.
2. **`wrangler.jsonc`** - unrestricted `SEB` binding (no destination allowlist).
3. **Secret** - `SYSTEM_FROM_EMAIL=noreply@useflap.online`.
4. Onboard `useflap.online` for Email Sending in the Cloudflare dashboard; publish MX/SPF/DKIM for that domain as Cloudflare documents.
5. Ensure Email Routing has a domain-level catch-all (or address routes) to Worker `flap` for inbound system replies if needed.

#### Option B - Temporary fallback

If SEB is unbound in local/dev, configure a verified system From elsewhere; production should use SEB for `useflap.online`.

### Auth

Flap uses **Clerk** (`@clerk/clerk-react` + `@clerk/backend`). The SPA sends Clerk session JWTs as `Authorization: Bearer …` on `/api/*`; the Worker verifies with `authenticateRequest` and maps `clerk_user_id` → Flap `users.id` (create-on-first-auth, or link by email for existing workspaces).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run check` | Typecheck app + worker + unit tests |
| `npm run build` | Production frontend build + marketing HTML prerender |
| `npm run prerender` | Write SEO HTML shells into `dist/client` (after vite build) |
| `npm run deploy` | Build → remote D1 migrations → Wrangler deploy |
| `npm run db:migrate:local` / `remote` | Apply D1 migrations (local Miniflare / production) |

## SEO / prerender

This is a Vite SPA on Cloudflare Assets - not full React SSR. Build-time prerender injects meta + crawlable HTML for landing, SEO pages, guides, tools, blog, and legal; regenerates `sitemap.xml`. Static `robots.txt`, `llms.txt`, and `llms-full.txt` ship from `public/`. See [docs/ssr-prerender.md](docs/ssr-prerender.md).

## Notes

- Sign-in is **email one-time code** via **Clerk** (no password / no Google/GitHub / no magic links in the Flap UI). Clerk sends the code email; Flap SEB is for product/system mail via `SYSTEM_FROM_EMAIL`.
- `/auth/verify` remains for any old Clerk email links and directs users back to sign in with a code.
- Customer domains send/receive on **Amazon SES**; the Flap app runs on Cloudflare Workers (D1/R2). DNS stays at any registrar.
- Referral rewards require verified email + a connected domain; self/disposable emails and shared Dodo customer / payment fingerprints are blocked.

## Legacy rename note (`inlet` → `flap`)

Older Cloudflare resources may still be named `inlet`. Current Wrangler names are **flap** (`DB`, `ATTACHMENTS`, `SEB`, `ASSETS`). If you still have an `inlet` Worker or bucket, migrate secrets/routes/objects once, then retire the old resources. Prefer keeping the existing D1 `database_id` over recreating empty.


## Dodo billing product IDs

See `docs/dodo-billing.md`. Annual products use `DODO_PRODUCT_*_ANNUAL` (10× monthly).
Customer mail is **Amazon SES**. Cloudflare runs the app (Workers / D1 / R2), not customer mailbox transport.
IMAP is deferred to **2026-10-15** (`docs/imap-decision.md`).
