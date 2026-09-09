# AWS SES production-access results

**Date:** 2026-09-09

## Executive summary

In-repo controls now match the production-access playbook: verified-domain send policy, workspace/domain suspension, workspace-scoped bounce/complaint/suppression with idempotency, public AUP/abuse/docs, IAM/inbound reviews, and operator scripts. **SES production access and live configuration-set/SNS wiring remain operator AWS console work.** Do not submit reconsideration until the Worker + D1 migration + public pages are deployed and event destinations are live if the case claims them.

## Controls already present

- Authenticated workspaces; SES identity/DKIM readiness; centralized domain send policy
- Plan send quotas; newsletter caps; unsubscribe + List-Unsubscribe
- HMAC inbound ingest; SNS signature verify; suppressions tenancy
- Settings deliverability + reputation counts

## Controls implemented this wave

- `outbound_access_status` / `send_status` + operator `POST /api/ops/workspace-send`
- Dispatch-time sender identity + workspace policy (compose, scheduled, API, newsletters, vacation, forwards, calendar)
- SES event kinds: send, delivery, bounce, soft bounce, complaint, reject; idempotent ingest
- Reputation warning timestamp (counts/rates only; no fake scores)
- Flap vs provider suppression copy in Settings
- Public `/acceptable-use`, `/abuse`, deliverability docs
- S3 template condition `aws:SourceAccount` + `aws:SourceArn`
- IAM policy JSON + status/configure scripts

## Website pages added/updated

Added: `/acceptable-use`, `/abuse`, `/docs/domain-verification`, `/docs/deliverability`, `/docs/bounces-and-complaints`, `/docs/sending-limits`, `/docs/acceptable-use`.  
Updated: Security, Privacy, Terms, footer, homepage trust, pricing FAQ.

## Outbound event architecture

Worker attaches `SES_CONFIGURATION_SET` when set. HTTPS: `/api/inbound/ses/events`. Live SNS is **operator-required**.

## Bounce / complaint / suppression

Hard bounce and complaint → workspace suppression + newsletter unsubscribe for that workspace only. Soft bounce TTL 72h. Unattributed events do not create Flap suppressions. SES account-level suppression may still apply.

## Domain verification / sender identity / rate limits / suspension

Unverified domains cannot send. Foreign domain/mailbox From rejected. Plan caps + workspace/domain suspend re-checked at dispatch (including scheduled).

## Newsletter/unsubscribe review

Active subscribers only; token unsubscribe; bounce/complaint scoped; suppression skip.

## Inbound / S3 / IAM

Reviewed. Catch-all kept. Custom MAIL FROM **not** implemented. Worker policy is least-privilege SES, not admin.

## Production tests

See `docs/ses-production-access-results.md` for commands run this wave.

## Items still not deployed (operator)

- Leave SES sandbox / production access request
- Confirm region, case ID, realistic volume
- Configuration set + SNS if not already live
- CloudFormation stack update for new S3 condition
- Remote D1 `0034_ses_production_access`
- Worker secrets (`SES_CONFIGURATION_SET`, `FLAP_OPERATOR_TOKEN` as needed)
- Public deploy of new pages

## Claims safe to include in AWS case (after deploy)

Domain verification required; sender identity enforced; plan send limits; multi-tenant isolation; AUP/anti-spam public; inbound HMAC ingest; Easy DKIM. Bounce/complaint processing **if** SNS is live.

## Claims NOT safe to include

Custom MAIL FROM; open/click tracking; unlimited sending; fake volume/metrics; “events deployed” without SNS; certifications; `abuse@useflap.online` (use `support@useflap.online` / `/abuse`).

## Final AWS case draft

`docs/aws-ses-production-access-case.md`

## Recommended console flow

Reply to existing denial case if possible. Else SES Account dashboard → Request production access, mail type **Transactional**, website `https://useflap.online`. Do not file parallel duplicates.

## GO / NO-GO for submitting reconsideration

**NO-GO until:** production Worker+pages deployed, D1 0034 applied, no unsigned inbound in prod, configuration set/SNS live if the case describes event processing, and a realistic volume + prior case ID are filled in.
