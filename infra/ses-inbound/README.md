# Flap SES inbound (AWS)

Customer-domain mail uses **Amazon SES** for all plans. System mail (`useflap.online`) stays on Cloudflare.

**Founder end-to-end setup** (prereqs, IAM, Worker secrets, activate rule set, first domain test, troubleshooting): [docs/aws-ses-setup.md](../../docs/aws-ses-setup.md).

## Architecture

```text
Internet
  → MX inbound-smtp.<region>.amazonaws.com
  → SES receipt rule (per domain or catch-all store)
  → private S3 raw MIME (lifecycle expiry)
  → S3 event → SQS
  → Lambda reads object, HMAC-signs JSON
  → POST https://useflap.online/api/inbound/ses
  → ingestRawEmail() → D1 / R2
```

Outbound: Worker SigV4 `SendRawEmail` (see `worker/lib/ses.ts`).

## Deploy (CloudFormation)

Pick a **receiving-capable** region (`us-east-1`, `us-west-2`, or `eu-west-1` recommended).

```bash
aws cloudformation deploy \
  --stack-name flap-ses-inbound \
  --template-file infra/ses-inbound/template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FlapWebhookUrl=https://useflap.online/api/inbound/ses \
    FlapWebhookSecret="$(openssl rand -hex 32)" \
    RuleSetName=flap-inbound \
  --region us-east-1
```

Activate the rule set:

```bash
aws ses set-active-receipt-rule-set --rule-set-name flap-inbound --region us-east-1
```

## Worker secrets / vars

| Name | Purpose |
|------|---------|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES identity + send + optional CreateReceiptRule |
| `AWS_SES_REGION` | Same region as inbound stack |
| `SES_RECEIPT_RULE_SET` | e.g. `flap-inbound` |
| `SES_INBOUND_BUCKET` | Stack output `InboundBucketName` |
| `SES_INBOUND_WEBHOOK_SECRET` | Same as `FlapWebhookSecret` |
| `SES_CONFIGURATION_SET` | Optional bounce/complaint events |

IAM least privilege for the Worker user: `ses:VerifyDomainIdentity`, `ses:VerifyDomainDkim`, `ses:GetIdentity*`, `ses:SetIdentityDkimEnabled`, `ses:SendRawEmail`, `ses:CreateReceiptRule`, `ses:DeleteReceiptRule`, `ses:DeleteIdentity`.

## Customer DNS (shown in Settings)

| Type | Name | Value |
|------|------|--------|
| TXT | `_amazonses.example.com` | SES verification token |
| CNAME | `{token}._domainkey.example.com` | `{token}.dkim.amazonses.com` (×3 Easy DKIM) |
| MX | `example.com` | `10 inbound-smtp.<region>.amazonaws.com` |
| TXT | `example.com` | `v=spf1 include:amazonses.com ~all` |
| TXT | `_dmarc.example.com` | `v=DMARC1; p=none; …` (recommended) |

No Cloudflare zone required. Extra mailboxes need **no** new DNS.

## Lambda → Worker payload

```json
{
  "provider_message_id": "ses-message-id",
  "recipients": [],
  "raw_mime_base64": "…"
}
```

Headers: `X-Flap-Timestamp`, `X-Flap-Signature: sha256=<hmac_hex(timestamp + "." + body)>`.

## Production blockers (ops)

- [ ] SES **production access** (exit sandbox) before Free-scale sending
- [ ] Bounce/complaint → configuration set → `/api/inbound/ses/events`
- [ ] Monitor SQS depth, DLQ, S3 growth, SES send quotas
- [ ] Do not buy dedicated IPs at launch

## Rollback

Keep legacy Mailgun/CF domains live until per-domain SES receiving test succeeds. Use Settings → **Migrate to SES**, then replace MX. Bounded dual-delivery: Flap dedupes by `provider_message_id`.
