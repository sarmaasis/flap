# AWS SES production readiness (Flap)

**Date:** 2026-09-09  
**Do not commit AWS secrets.**

| Item | Value / status |
|------|----------------|
| AWS account region (intended) | `us-east-1` (operator confirm live `AWS_SES_REGION`) |
| SES identities | Per-customer domains via Worker provision (Easy DKIM) |
| Production-access status | **Denied / sandbox until operator reconsideration is approved** |
| Inbound architecture | SES receipt → S3 → SQS → Lambda → HMAC `/api/inbound/ses` |
| Outbound architecture | Auth workspace → send policy → `SendRawEmail` (+ optional configuration set) |
| Configuration set | Code supports `SES_CONFIGURATION_SET`. **Live wiring is operator-required** |
| Event destinations | Intended: SEND, DELIVERY, BOUNCE, COMPLAINT, REJECT → SNS → `/api/inbound/ses/events` |
| Open/click | Not enabled (not required) |
| Bounce handling | Workspace-attributed; hard bounce → Flap suppression; 72h soft-bounce TTL |
| Complaint handling | Workspace-attributed suppression + newsletter unsubscribe |
| Suppression | `mail_suppressions.user_id` scoped; SES account-level suppression is separate |
| Send limits | Plan `send_per_month` + newsletter caps + workspace/domain suspend |
| IAM | `docs/iam/flap-worker-ses-policy.json` |
| Domain verification | DNS + SES identity + `sending_ready_at` before send |
| Custom MAIL FROM | **Not implemented** |
| DKIM | SES Easy DKIM CNAMEs |
| Expected initial volume | **[INSERT REALISTIC MESSAGES/DAY OR MONTH]** (product owner) |
| AWS Support case ID(s) | **[INSERT]** |

## Worker env (names only)

See `.dev.vars.example`. Production: `wrangler secret put` for keys and `SES_INBOUND_WEBHOOK_SECRET`.

## Scripts

- `npx tsx scripts/ses-production-status.ts`
- `npx tsx scripts/ses-configure-events.ts`

## Related

- [aws-ses-setup.md](./aws-ses-setup.md)
- [aws-ses-inbound-security-review.md](./aws-ses-inbound-security-review.md)
- [aws-ses-iam-review.md](./aws-ses-iam-review.md)
- [sns-webhook-trust-model.md](./sns-webhook-trust-model.md)
