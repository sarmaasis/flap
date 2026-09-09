# AWS SES inbound security review

**Date:** 2026-09-09  
**Code:** `infra/ses-inbound/template.yaml`, `worker/lib/inbound-webhook.ts`, `worker/lib/sns-verify.ts`

## Current inbound path

```text
SES receipt rule → private S3 (raw/) → SQS (+ DLQ after 5 receives) → Lambda → HMAC POST /api/inbound/ses
```

Outbound events (separate): SES configuration set → SNS HTTPS → `POST /api/inbound/ses/events`.

## S3 bucket policy

### Previous in-repo policy

`aws:Referer` equal to the AWS account id (legacy SES-to-S3 sample).

### Recommended / now in template

```yaml
Condition:
  StringEquals:
    aws:SourceAccount: !Ref AWS::AccountId
  ArnLike:
    aws:SourceArn: !Sub "arn:aws:ses:${AWS::Region}:${AWS::AccountId}:receipt-rule-set/${RuleSetName}:*"
```

### Change required?

**Yes for new/updated stacks.** Existing production stacks still have the old condition until an operator runs CloudFormation update. Do not assume the live bucket already uses `SourceAccount`/`SourceArn`.

### Test plan

1. Update stack in a non-prod account or after a maintenance window.
2. Send a test message to a verified Flap mailbox.
3. Confirm S3 object under `raw/`, Lambda ingest 2xx, message in inbox.
4. Confirm unauthorized `s3:PutObject` without SES source conditions still fails.

## Catch-all receipt rule

`flap-catchall-store` stores inbound MIME broadly; Flap rejects unknown mailboxes (`406`). **Do not remove** until per-domain `CreateReceiptRule` coverage is complete for every live domain (`SES_RECEIPT_RULE_SET` + `SES_INBOUND_BUCKET`). Preferred long-term: verified domains only.

## Raw MIME retention

Template: lifecycle `ExpireRawMime` on prefix `raw/`, default **7 days** (`RawMailRetentionDays` 1–90). Canonical mail is in D1/R2 after ingest. Public Privacy copy states the **deployed** lifecycle, not a guaranteed 7 days if the stack parameter was overridden.

## HMAC / SNS / replay

- Ingest: `X-Flap-Signature` + `X-Flap-Timestamp` (≤15 minute skew).
- Events: native SNS signature when envelope present; HMAC required when secret is set.
- `SES_INBOUND_ALLOW_UNSIGNED` must never be set in production.
- Inbound provider ids use claim lifecycle (processing → stored).

## Least privilege (inbound Lambda)

Ingest role: `s3:GetObject` on the inbound bucket, SQS receive/delete on the ingest queue, CloudWatch logs. Worker IAM is documented in `docs/aws-ses-iam-review.md` and does **not** need S3/SQS.
