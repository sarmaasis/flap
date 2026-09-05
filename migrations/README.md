# Database migrations

Flap uses Cloudflare D1. Apply migrations in order before marketing or billing demos.

## Local

```bash
npm run db:migrate:local
```

## Production / remote

```bash
npm run db:migrate:remote
```

`npm run deploy` runs `db:migrate:remote` automatically before `wrangler deploy`, so pending files in `migrations/` (configured as `migrations_dir` on the `flap` D1 binding) are applied to production as part of deploy. Use `db:migrate:remote` alone when you need schema without a Worker publish.

## Files

| Migration | Purpose |
|-----------|---------|
| `0001_init.sql` | Users, sessions, domains, mailboxes, messages, attachments |
| `0002_single_admin.sql` | First-boot setup state |
| `0003_product.sql` | Contacts, templates, signatures, filters, prefs |
| `0004_ops.sql` | Threads, aliases, webhooks, catch-all, team invites |
| `0005_billing.sql` | Subscriptions, billing events, plan columns |
| `0006_teams_oauth.sql` | Workspace members, invites, OAuth accounts |
| `0007_quota_enforcement.sql` | `messages.storage_bytes`, monthly send counters on users |
| `0008_growth_referrals.sql` | Referral codes/rewards, activation timestamps, DNS check rate-limit log |
| `0009_analytics_verify_abuse.sql` | First-party `analytics_events`, email verify tokens, payment identity columns for referral abuse |
| `0010_better_auth.sql` | Better Auth `user`/`session`/`account`/`verification` tables + id-preserving backfill from Flap `users` |
| `0011_auth_email_rate_limit.sql` | D1 counters for magic-link / verification email rate limits |
| `0012_mailgun_provider.sql` | `mail_provider`, `provider_state`, `provider_dns_json` on domains |
| `0013_ses_provider.sql` | SES readiness timestamps, inbound idempotency, suppressions, `provider_message_id` |

**Launch note:** Apply through `0013_ses_provider` on remote D1 before relying on SES customer-domain mail. Existing password hashes are **not** migrated — users sign in with magic link or password reset after cutover. Update Google/GitHub OAuth redirect URIs to `/api/auth/callback/{provider}`.

### Better Auth coexistence

| Table | Owner | Notes |
|-------|--------|-------|
| `user`, `session`, `account`, `verification` | Better Auth | Singular names; no clash with Flap `users` / `sessions` |
| `users` | Flap product | Workspace id = `users.id` = Better Auth `user.id` |
| Legacy `sessions` / `oauth_accounts` | Deprecated | No longer written by app code |

**Launch note (pre-auth):** Apply through `0009_analytics_verify_abuse` on remote D1 before relying on analytics ingest, legacy password email verification, or payment-identity referral blocks.

### analytics_events schema (privacy-light)

| Column | Purpose |
|--------|---------|
| `id` | Event row id |
| `event` | Named funnel event (allowlisted) |
| `user_id` | Optional; set when session known or server-emitted |
| `session_id` | Optional anonymous client session key |
| `props_json` | Small sanitized JSON (no bulk PII) |
| `path` | Optional page path |
| `created_at` | Unix ms |
