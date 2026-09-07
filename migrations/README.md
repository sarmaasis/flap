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
| `0010_better_auth.sql` | Historical Better Auth tables + id-preserving backfill (no longer written by app code) |
| `0011_auth_email_rate_limit.sql` | Historical D1 counters for Flap-sent auth mail (Clerk now sends auth mail) |
| `0012_mailgun_provider.sql` | `mail_provider`, `provider_state`, `provider_dns_json` on domains |
| `0013_ses_provider.sql` | SES readiness timestamps, inbound idempotency, suppressions, `provider_message_id` |
| `0014_product_features.sql` | Labels, notes, domain color/mute, undo-send prefs |
| `0015_webhook_deliveries.sql` | Webhook delivery attempt log |
| `0016_domain_controls.sql` | Domain park/reputation/retention, deliverability events, health badges |
| `0017_saved_views.sql` | Saved inbox views |
| `0018_disposables_notify.sql` | Disposable addresses, notify channels, push, digests |
| `0019_collaboration.sql` | Presence, audit log, portals, VA invites, holding workspaces |
| `0020_forms_embed.sql` | Contact forms and embed widgets |
| `0021_rules_automation.sql` | Rule templates, parse rules, message extras, theme/AI prefs |
| `0022_clerk.sql` | `users.clerk_user_id` for Clerk → Flap identity mapping |

If a database already applied the old umbrella file `0016_mega_features.sql`, remap the journal once (schema is identical):

```sql
DELETE FROM d1_migrations WHERE name = '0016_mega_features.sql';
INSERT INTO d1_migrations (name) VALUES
  ('0016_domain_controls.sql'),
  ('0017_saved_views.sql'),
  ('0018_disposables_notify.sql'),
  ('0019_collaboration.sql'),
  ('0020_forms_embed.sql'),
  ('0021_rules_automation.sql');
```

**Launch note:** Apply through `0022_clerk` on remote D1 before relying on Clerk sessions. Existing Better Auth tables are left in place (not dropped). Existing Flap `users` rows are linked on first Clerk sign-in by email (`clerk_user_id`). Enable Google/GitHub and Email link in the Clerk Dashboard; set redirect URLs to `/sso-callback` and `/auth/verify`.

### Auth identity (Clerk)

| Table / column | Owner | Notes |
|-------|--------|-------|
| `users.id` | Flap product | Workspace id everywhere (billing, domains, inbox) |
| `users.clerk_user_id` | Flap ↔ Clerk | Linked on first successful Clerk session |
| Legacy `user`/`session`/`account`/`verification` | Unused | Historical Better Auth tables; do not drop casually |
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
