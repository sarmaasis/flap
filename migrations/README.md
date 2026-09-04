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

**Launch note:** Apply through `0009_analytics_verify_abuse` on remote D1 before relying on analytics ingest, password email verification, or payment-identity referral blocks.

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
