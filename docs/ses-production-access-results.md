# SES production-access results (short)

**Date:** 2026-09-09  
**Full write-up:** [aws-ses-production-access-results.md](./aws-ses-production-access-results.md)

## Completed (in-repo)

- Outbound policy: verified domain, sender mailbox, workspace `send_status` / `outbound_access_status`, suppression, plan quotas
- SES event processor: send/delivery/bounce/soft-bounce/complaint/reject + idempotency + workspace tenancy
- Operator restrict/suspend: `POST /api/ops/workspace-send` (`FLAP_OPERATOR_TOKEN`)
- Public pages: `/acceptable-use`, `/abuse`, domain-verification / deliverability / bounces / sending-limits docs
- IAM JSON, inbound S3 policy recommendation, operator scripts, AWS case/audit/readiness docs
- Tests wired into `npm run check`

## Operator-required AWS console / account steps

1. Confirm SES region and existing denial **case ID**.
2. Create/confirm configuration set + SNS → `https://useflap.online/api/inbound/ses/events`; set Worker `SES_CONFIGURATION_SET`.
3. Update inbound CloudFormation if the live S3 policy still uses `aws:Referer`.
4. Apply remote D1 migration `0034_ses_production_access` and deploy the Worker/site.
5. Request **Transactional** production access for `https://useflap.online` (reply to the old case first). Do not invent volume — fill **[INSERT REALISTIC MESSAGES/DAY OR MONTH]**.
6. Create IAM user from `docs/iam/flap-worker-ses-policy.json` if credentials are still overly broad. Never commit keys.

## Leftover gaps

- Custom MAIL FROM not implemented (do not claim).
- Event pipeline not proven live until SNS is subscribed.
- `abuse@useflap.online` not published (mailbox not confirmed); reports go to `support@useflap.online`.
- Production-access approval itself cannot be automated.

## Tests run

- `npx tsx shared/ses-production-access.test.ts`
- `npx tsx shared/security-authz.test.ts`
- `npx tsx shared/ses-dns.test.ts`
- `npx tsx shared/security-phase-b.test.ts`
- `npx tsx shared/agency-send-policy.test.ts`
- `npx tsx scripts/seo.test.ts`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npx tsc --noEmit -p tsconfig.worker.json`

`npm run check` now includes `shared/ses-production-access.test.ts`. Full check suite was not re-run end-to-end this session.
