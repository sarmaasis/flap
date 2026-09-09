# AWS SES IAM review (Flap Worker)

**Date:** 2026-09-09  
**Policy file:** `docs/iam/flap-worker-ses-policy.json`

## Principle

The Cloudflare Worker must not use root or administrator credentials. Use a dedicated IAM user (example name `flap-worker-ses`) with static keys stored only as Wrangler secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SES_REGION`

Never commit keys. `.dev.vars` / `.dev.vars.example` stay placeholder-only in git.

## Required Worker actions

| Action | Why |
|--------|-----|
| `ses:SendRawEmail` | Customer-domain outbound |
| `ses:VerifyDomainIdentity` / `VerifyDomainDkim` / Get*Attributes / `SetIdentityDkimEnabled` | Domain provision |
| `ses:DeleteIdentity` | Domain disconnect |
| `ses:CreateReceiptRule` / `DeleteReceiptRule` | Per-domain inbound prefixes |
| `ses:GetSendQuota` / `GetAccountSendingEnabled` | Optional operator status script |

SES v1 identity APIs typically require `Resource: "*"`. Do not attach `AdministratorAccess`.

## Not granted to the Worker

- S3 / SQS / Lambda (inbound stack roles only)
- IAM user management
- Organizations / billing
- `ses:SendEmail` is unused (Flap sends raw MIME)

## Inbound Lambda roles

See `infra/ses-inbound/template.yaml`: ingest function gets object get + queue consume only.

## Configuration set / SNS

Creating configuration sets and SNS topics is an **operator console/CLI** action (`scripts/ses-configure-events.ts`). Those IAM actions are not on the Worker user.

## Custom MAIL FROM

**Not implemented.** Flap uses SES Easy DKIM and default SES MAIL FROM. Do not claim custom MAIL FROM in the AWS case.

## Operator token

`FLAP_OPERATOR_TOKEN` is a Flap secret for `POST /api/ops/workspace-send`. It is not an AWS credential.
