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

**Launch note:** Apply through `0007_quota_enforcement` on remote D1 before relying on Billing usage or storage/send hard limits.
