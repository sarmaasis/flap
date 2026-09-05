# AWS SES setup for Flap (founder guide)

End-to-end setup so customer domains can **receive** and **send** mail through Amazon SES. System mail for `useflap.online` stays on Cloudflare and is out of scope here.

**Related:** [mail architecture](./mail-architecture.md) · [inbound stack README](../infra/ses-inbound/README.md) · template [`infra/ses-inbound/template.yaml`](../infra/ses-inbound/template.yaml)

---

## TL;DR

1. Pick a **receiving-capable** region (recommend `us-east-1`).
2. Request SES **production access** (leave sandbox) before real customers.
3. Deploy `infra/ses-inbound/template.yaml` with CloudFormation; **activate** the receipt rule set.
4. Create a least-privilege IAM user; put secrets on the Worker (`wrangler secret put` / `.dev.vars`).
5. (Manual, not in IaC) Optional configuration set → SNS → `POST /api/inbound/ses/events` for bounces/complaints.
6. Add a test domain in Flap → publish DNS → Check setup → send/receive.

---

## Prerequisites

| Requirement | Why |
|-------------|-----|
| AWS account with billing enabled | SES + S3 + Lambda + SQS |
| AWS CLI v2 configured (`aws sts get-caller-identity` works) | Deploy stack, activate rules, create IAM |
| Region that supports **SES email receiving** | Inbound MX only works in receiving regions |
| Cloudflare Worker already deployable | Lambda POSTs to `https://useflap.online/api/inbound/ses` |
| D1 migration `0013_ses_provider` applied (remote) | Readiness + suppressions + idempotency |

### SES production access (do early)

New accounts start in the **SES sandbox**: you can only send to verified identities, and daily send quotas are tiny.

1. In the AWS console: **SES → Account dashboard → Request production access** (or Support case “Service limit increase” for SES).
2. Describe Flap: transactional/app mail for customer domains, bounce/complaint handling planned, no purchased lists.
3. Do **not** open Free signups at scale until production access is approved.

Sandbox is fine for a single verified test domain while you wire infra.

---

## Region recommendation

Use **one** region for inbound stack **and** Worker `AWS_SES_REGION` (sending + identity APIs).

| Priority | Region | Notes |
|----------|--------|--------|
| **Recommended** | `us-east-1` | Broad SES receiving support; matches Flap docs/examples |
| Good alternatives | `us-west-2`, `eu-west-1` | Also commonly used for receiving |
| Avoid for Flap inbound | Regions **without** SES receiving | Worker will refuse provision (`SES_RECEIVING_REGIONS` in `worker/lib/ses.ts`) |

Customer MX will be:

```text
10 inbound-smtp.<AWS_SES_REGION>.amazonaws.com
```

Changing region later means new stack, new MX, and re-verifying identities. Pick once.

---

## What the CloudFormation template creates

Stack name example: `flap-ses-inbound`. Template path: `infra/ses-inbound/template.yaml`.

| Resource | Purpose |
|----------|---------|
| **S3 bucket** | Private raw MIME under `raw/`; AES256; public access blocked |
| **S3 lifecycle** | Expire objects under `raw/` after `RawMailRetentionDays` (default **7**) |
| **SQS queue + DLQ** | S3 `ObjectCreated` on `raw/` → queue; DLQ after 5 receives |
| **NotifyFunction** | Custom resource that attaches S3→SQS notification |
| **IngestFunction** | Reads MIME from S3, HMAC-signs JSON, `POST` to Flap webhook |
| **ReceiptRuleSet** | Named rule set (default `flap-inbound`) |
| **CatchAllRule** | `flap-catchall-store` → S3 prefix `raw/catchall/` |

**Not in the template** (manual steps below):

- Activating the receipt rule set (required for inbound)
- IAM user/keys for the Cloudflare Worker
- SES configuration set / SNS for bounce & complaint
- SES production access request

The catch-all rule stores mail for any recipient; Flap validates mailboxes on ingest. At domain provision time the Worker also calls `CreateReceiptRule` for `raw/{domain}/` when `SES_RECEIPT_RULE_SET` + `SES_INBOUND_BUCKET` are set.

---

## Deploy the inbound stack

From the repo root (or pass an absolute path to the template):

```bash
# Generate a webhook HMAC secret once; reuse as SES_INBOUND_WEBHOOK_SECRET on the Worker
export FLAP_WEBHOOK_SECRET="$(openssl rand -hex 32)"
echo "Save this: $FLAP_WEBHOOK_SECRET"

aws cloudformation deploy \
  --stack-name flap-ses-inbound \
  --template-file infra/ses-inbound/template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FlapWebhookUrl=https://useflap.online/api/inbound/ses \
    FlapWebhookSecret="$FLAP_WEBHOOK_SECRET" \
    RuleSetName=flap-inbound \
    RawMailRetentionDays=7 \
  --region us-east-1
```

### Parameters

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `FlapWebhookUrl` | `https://useflap.online/api/inbound/ses` | Worker ingest URL |
| `FlapWebhookSecret` | *(required)* | Shared HMAC; must match Worker `SES_INBOUND_WEBHOOK_SECRET` |
| `RuleSetName` | `flap-inbound` | SES receipt rule set name |
| `RawMailRetentionDays` | `7` | S3 lifecycle expiry for `raw/` (1–90) |

### Activate the receipt rule set (required)

CloudFormation creates the rule set but **does not** make it active. Only one rule set is active per account/region:

```bash
aws ses set-active-receipt-rule-set \
  --rule-set-name flap-inbound \
  --region us-east-1
```

Confirm:

```bash
aws ses describe-active-receipt-rule-set --region us-east-1
```

### Verify stack outputs

```bash
aws cloudformation describe-stacks \
  --stack-name flap-ses-inbound \
  --region us-east-1 \
  --query 'Stacks[0].Outputs' \
  --output table
```

| Output | Use as |
|--------|--------|
| `InboundBucketName` | Worker `SES_INBOUND_BUCKET` |
| `ReceiptRuleSetName` | Worker `SES_RECEIPT_RULE_SET` |
| `InboundQueueUrl` | Ops monitoring (depth / age) |
| `IngestFunctionName` | CloudWatch logs for ingest failures |
| `NextSteps` | Reminder checklist |

---

## IAM credentials for the Worker (least privilege)

Create an IAM **user** (or role + static keys if you prefer) used only by the Cloudflare Worker. Do **not** use root keys.

Example inline policy (SES identity + send + receipt rules the app manages):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SesIdentityAndSend",
      "Effect": "Allow",
      "Action": [
        "ses:VerifyDomainIdentity",
        "ses:VerifyDomainDkim",
        "ses:GetIdentityVerificationAttributes",
        "ses:GetIdentityDkimAttributes",
        "ses:SetIdentityDkimEnabled",
        "ses:SendRawEmail",
        "ses:DeleteIdentity"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SesReceiptRules",
      "Effect": "Allow",
      "Action": [
        "ses:CreateReceiptRule",
        "ses:DeleteReceiptRule"
      ],
      "Resource": "*"
    }
  ]
}
```

Notes:

- SES v1 identity APIs often require `Resource: "*"`; scope further only if your org’s IAM patterns allow identity ARNs and you have verified them.
- The Worker does **not** need S3/SQS/Lambda permissions — the ingest Lambda role covers that.
- Create an access key; store `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` only as Worker secrets.

---

## Worker secrets and vars

Env names match `.dev.vars.example` and `worker/lib/ses.ts` (`AWS_SES_REGION`, **not** `AWS_REGION`).

### Production (`wrangler secret put`)

```bash
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
npx wrangler secret put AWS_SES_REGION          # e.g. us-east-1
npx wrangler secret put SES_INBOUND_WEBHOOK_SECRET   # same as FlapWebhookSecret
npx wrangler secret put SES_RECEIPT_RULE_SET   # e.g. flap-inbound
npx wrangler secret put SES_INBOUND_BUCKET     # stack output InboundBucketName
# Optional — only after you create the configuration set (manual):
# npx wrangler secret put SES_CONFIGURATION_SET   # e.g. flap-outbound
```

Alternatively set non-secret vars in the Cloudflare dashboard / `wrangler` vars if you prefer; treat access keys and the webhook secret as secrets always.

### Local (`.dev.vars`)

Copy from `.dev.vars.example`. For local webhook tests without Lambda signing:

```bash
# SES_INBOUND_ALLOW_UNSIGNED=true   # local only — never in production
```

### Variable cheat sheet

| Name | Required | Purpose |
|------|----------|---------|
| `AWS_ACCESS_KEY_ID` | Yes (prod mail) | SES API from Worker |
| `AWS_SECRET_ACCESS_KEY` | Yes | SES API |
| `AWS_SES_REGION` | Yes | Same as inbound stack |
| `SES_INBOUND_WEBHOOK_SECRET` | Yes (prod inbound) | HMAC for Lambda → Worker |
| `SES_RECEIPT_RULE_SET` | Yes (per-domain rules) | e.g. `flap-inbound` |
| `SES_INBOUND_BUCKET` | Yes (per-domain rules) | Stack `InboundBucketName` |
| `SES_CONFIGURATION_SET` | Optional | Attach on `SendRawEmail` for events |
| `SES_INBOUND_ALLOW_UNSIGNED` | Local only | Skip HMAC verify |

Inbound URL (Lambda parameter / ops check): `https://useflap.online/api/inbound/ses`  
Events URL (manual SNS): `https://useflap.online/api/inbound/ses/events`

---

## Configuration set for bounce / complaint (manual — not in IaC)

The Worker already:

- Accepts `SES_CONFIGURATION_SET` on `SendRawEmail`
- Exposes `POST /api/inbound/ses/events` (SNS subscription confirm + bounce/complaint → `mail_suppressions`)

The **CloudFormation template does not** create a configuration set, event destination, or SNS topic. Do this in the console or CLI when you are ready:

1. Create an SES **configuration set** (e.g. `flap-outbound`) in the same region.
2. Add event destinations for **Bounce** and **Complaint** (and optionally Delivery) → **SNS topic**.
3. Subscribe the SNS topic to HTTPS endpoint  
   `https://useflap.online/api/inbound/ses/events`  
   Confirm the subscription (Worker auto-fetches `SubscribeURL` on `SubscriptionConfirmation`).
4. Set Worker secret/var `SES_CONFIGURATION_SET=flap-outbound`.

Until this is done, Flap still sends mail; suppressions from SES events simply will not populate automatically.

---

## S3 lifecycle for raw MIME

Already in the template:

- Prefix: `raw/`
- Rule id: `ExpireRawMime`
- Default retention: **7 days** (`RawMailRetentionDays`)

Canonical mail lives in Flap (D1/R2) after ingest. Lengthen retention only if you need longer forensic copies; watch S3 cost.

---

## First customer domain test

1. Ensure Worker secrets are set and the Worker is deployed (`npm run deploy`).
2. In Flap: add domain (or **Migrate to SES** for a legacy Mailgun/CF domain).
3. Settings shows DNS — publish at your DNS host (any provider; no Cloudflare zone required):

   | Type | Name | Value |
   |------|------|--------|
   | TXT | `_amazonses.example.com` | SES verification token |
   | CNAME | `{token}._domainkey.example.com` | `{token}.dkim.amazonses.com` (×3 Easy DKIM) |
   | MX | `example.com` | `10 inbound-smtp.<region>.amazonaws.com` |
   | TXT | `example.com` | `v=spf1 include:amazonses.com ~all` |
   | TXT | `_dmarc.example.com` | `v=DMARC1; p=none; …` (recommended) |

4. Click **Check setup** until identity / DKIM / MX / inbound readiness look good.  
   Remember: `identity_verified` ≠ `mx_verified` ≠ `inbound_rule_ready` ≠ `receiving_ready` ≠ `sending_ready`.
5. Create a mailbox in Flap (extra addresses need **no** new DNS).
6. **Receive:** send mail from an external account → expect S3 object → Lambda → inbox.  
   Check CloudWatch logs on `IngestFunctionName` and SQS DLQ if nothing arrives.
7. **Send:** compose from the verified domain. In sandbox, destination must be a verified identity.

Rollback tip: keep old MX until SES receive works; Flap dedupes by `provider_message_id` during dual delivery.

---

## Sandbox vs production pitfalls

| Pitfall | What happens | Fix |
|---------|--------------|-----|
| Still in sandbox | Cannot send to arbitrary recipients | Production access |
| Rule set not active | SES accepts MX but drops / no S3 store | `set-active-receipt-rule-set` |
| Region mismatch | Wrong MX host / API calls fail | One region for stack + `AWS_SES_REGION` |
| Webhook secret mismatch | Lambda gets non-2xx; retries → DLQ | Same secret in CFN param and Worker |
| Missing `SES_INBOUND_BUCKET` / rule set | Catch-all may still store; per-domain rules skipped | Set both from stack outputs |
| Unsigned inbound in prod | Anyone can POST fake mail | Never set `SES_INBOUND_ALLOW_UNSIGNED` in prod |
| Expecting config set from stack | No bounce auto-suppress | Manual SNS wiring above |
| Dedicated IPs | Unnecessary cost/complexity at launch | Stay on shared IP; do not buy dedicated IPs |

---

## Cost notes (PAYG)

Early Flap volume is usually cents-to-low-dollars:

| Service | Rough role |
|---------|------------|
| SES inbound | Per message received |
| SES outbound | Per message sent (+ attachments size) |
| S3 | Storage of raw MIME until lifecycle expiry (default 7d) |
| SQS / Lambda | Per ingest invocation |
| Data transfer | Usually small |

Free-plan COGS is gated by **Flap quotas and anti-abuse**, not by a second mail provider. Do not buy dedicated IPs at launch. Monitor SQS depth, DLQ, S3 growth, and SES send quotas in CloudWatch / SES console.

---

## Troubleshooting

| Symptom | Checks |
|---------|--------|
| Domain won’t verify | `_amazonses` TXT exact; wait for DNS TTL; `GetIdentityVerificationAttributes` in same region |
| DKIM pending | All three CNAMEs; no proxy/orange-cloud on DKIM at Cloudflare |
| MX green but no inbox | Active rule set? S3 objects under `raw/`? Ingest Lambda errors? HMAC secret? |
| Lambda `Flap ingest 401` | `SES_INBOUND_WEBHOOK_SECRET` ≠ `FlapWebhookSecret` |
| Lambda `406` | Flap rejected recipient (no mailbox) — expected for junk; Lambda treats 406 as non-fatal |
| Messages in DLQ | Fix Worker/Lambda, then redrive or resend test mail |
| Send fails sandbox | Verify recipient identity or exit sandbox |
| `CreateReceiptRule` errors in logs | IAM missing `ses:CreateReceiptRule` or wrong rule set name; catch-all may still work |
| Wrong region in Settings MX | Fix `AWS_SES_REGION` and redeploy Worker |

Useful commands:

```bash
aws ses describe-active-receipt-rule-set --region us-east-1
aws logs tail "/aws/lambda/<IngestFunctionName>" --follow --region us-east-1
aws sqs get-queue-attributes \
  --queue-url "<InboundQueueUrl>" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  --region us-east-1
```

---

## Ops checklist

- [ ] Receiving region chosen and documented
- [ ] SES production access approved
- [ ] Stack `flap-ses-inbound` deployed; outputs saved
- [ ] Receipt rule set **active**
- [ ] Worker IAM + secrets set; webhook secret matches
- [ ] Optional: configuration set + SNS → `/api/inbound/ses/events`
- [ ] First domain DNS + Check setup + send/receive
- [ ] Alarms or weekly glance at SQS DLQ / SES reputation

---

## Rollback / dual provider

Legacy Mailgun and Cloudflare Email Routing paths remain until each domain migrates. Use Settings → **Migrate to SES**, verify SES DNS, then cut MX. See [mail-architecture.md](./mail-architecture.md).
