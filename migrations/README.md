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

**Launch note:** `0005_billing` must be applied on the remote D1 database before Settings → Billing or Dodo webhooks will work.
