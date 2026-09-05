# Flap mail architecture (Amazon SES)

## Decision

**Chosen: Amazon SES** for all customer-domain send + receive (Free, Solo, Builder, Studio).

| Layer | Transport |
|--------|-----------|
| System (`useflap.online`) | Cloudflare Email Routing inbound + Email Sending (SEB) outbound |
| Customer domains | Amazon SES (identity/DKIM/MX + SendRawEmail) |

Plans differ only in entitlements/quotas — **not** DNS or provider. Upgrades never require MX/DKIM cutover.

Cloudflare remains Flap infrastructure. Customers may keep DNS at Namecheap, GoDaddy, Route 53, Cloudflare DNS-only, etc.

| Option | Verdict |
|--------|---------|
| **Amazon SES** | **Selected** — DNS-anywhere, low COGS, scales Free without a separate Free=CF path |
| Mailgun | Legacy only during migration |
| Cloudflare Email Routing for customers | Rejected as product prerequisite (zone + Worker rules) |
| Hybrid Free=CF / Paid=Mailgun | Superseded — see `docs/hybrid-product.md` |

## Flow

```
Any DNS host
  MX → inbound-smtp.<region>.amazonaws.com
  TXT _amazonses + Easy DKIM CNAMEs + SPF include:amazonses.com
        │
        ▼
SES receipt rule → private S3 raw MIME → SQS → Lambda
  → POST /api/inbound/ses (HMAC) → ingestRawEmail() → D1 / R2

Compose
  → sending-ready domain check + quota + suppression
  → SES SendRawEmail (Worker SigV4)

System mail (auth@ / notifications@ / billing@ useflap.online)
  → SEB preferred; never customer SES sending config

Legacy Mailgun webhook + CF email handler
  → same ingestRawEmail() until MX cutover
```

## DNS users add

Exact values come from Settings after SES identity provisioning:

| Type | Name | Value (typical) |
|------|------|-----------------|
| TXT | `_amazonses.example.com` | Verification token |
| CNAME | `{token}._domainkey.example.com` | `{token}.dkim.amazonses.com` |
| MX | `example.com` | `10 inbound-smtp.us-east-1.amazonaws.com` |
| TXT | `example.com` | `v=spf1 include:amazonses.com ~all` |
| TXT | `_dmarc.example.com` | `v=DMARC1; p=none; …` |

Creating `support@` after the domain is ready is in-app only — no new DNS or receipt rule.

## Readiness (distinct)

`identity_verified` ≠ `mx_verified` ≠ `inbound_rule_ready` ≠ `receiving_ready` ≠ `sending_ready`

Never mark fully ready from a DNS lookup alone.

## Env / secrets

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES API from Worker |
| `AWS_SES_REGION` | Receiving + sending region |
| `SES_RECEIPT_RULE_SET` / `SES_INBOUND_BUCKET` | Inbound infra |
| `SES_INBOUND_WEBHOOK_SECRET` | Lambda → Worker HMAC |
| `SES_CONFIGURATION_SET` | Bounce/complaint events |
| `SYSTEM_FROM_EMAIL` + `SEB` | System mail on Cloudflare |
| `MAILGUN_*` | Legacy domains only |

Founder setup (IAM, secrets, activate rule set, first domain test): [aws-ses-setup.md](./aws-ses-setup.md).  
CloudFormation details: [`infra/ses-inbound/README.md`](../infra/ses-inbound/README.md).

## Migrations

- `0012_mailgun_provider.sql` — provider columns (still used)
- `0013_ses_provider.sql` — SES readiness timestamps, idempotency, suppressions

Existing domains stay on their `mail_provider` until **Migrate to SES** + MX cutover.
