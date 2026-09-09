# AWS SES production-access audit (Flap)

**Date:** 2026-09-09  
**Rule:** Do not claim a control exists in the AWS case unless it is actually deployed.

## Domain verification

| Field | Notes |
|-------|--------|
| Current state | SES identity + DKIM + `sending_ready_at` required. `evaluateOutboundDomainPolicy` + `domainIsSendingReady`. |
| Relevant files | `shared/ses-dns.ts`, `shared/outbound-send-policy.ts`, `worker/lib/workspace.ts`, `worker/lib/ses.ts` |
| Already implemented? | Yes (this wave: public lifecycle labels) |
| Production deployed? | **Unknown — operator confirm Worker + D1 migration 0034** |
| Evidence | Unit tests `ses-dns`, `security-authz`, `ses-production-access` |
| Missing | Live AWS identity list not in-repo |
| Tests needed | Covered |
| Website copy | `/docs/domain-verification` |
| AWS case evidence | Only after production deploy |

## Sender-address enforcement

| Field | Notes |
|-------|--------|
| Current state | Compose/reply pick workspace mailboxes; dispatch re-checks mailbox From; API requires mailbox row; newsletters use mailbox address |
| Relevant files | `worker/index.ts`, `worker/lib/workspace.ts`, `worker/lib/newsletters.ts` |
| Already implemented? | Yes; this wave adds explicit `evaluateOutboundSenderIdentity` at dispatch |
| Production deployed? | Unknown |
| Evidence | Tests + send paths |
| Missing | None in-repo |
| Tests needed | Covered |
| Website copy | Docs + AUP |
| AWS case evidence | After deploy |

## Outbound SES events

| Field | Notes |
|-------|--------|
| Current state | Handler supports bounce/complaint/send/delivery/reject; attaches `SES_CONFIGURATION_SET` if set |
| Relevant files | `worker/lib/inbound-webhook.ts`, `worker/lib/ses-delivery.ts`, `worker/lib/ses.ts` |
| Already implemented? | Code yes |
| Production deployed? | **No unless operator created config set + SNS** (historically manual) |
| Evidence | `ses-production-access.test.ts` |
| Missing | Live SNS subscription |
| Tests needed | Covered |
| Website copy | `/docs/deliverability` |
| AWS case evidence | **Do not claim deployed events until SNS is live** |

## Hard / soft bounce / complaint / suppression

| Field | Notes |
|-------|--------|
| Current state | Workspace-scoped suppressions; soft bounce 72h TTL; unattributed events do not write Flap suppressions |
| Relevant files | `worker/lib/ses-delivery.ts`, `worker/lib/suppressions.ts`, `shared/security-guards.ts` |
| Already implemented? | Yes (this wave: idempotency + more event kinds) |
| Production deployed? | Depends on event pipeline |
| Evidence | Tests: A bounce ≠ B; duplicate idempotent |
| Missing | Live SES events |
| Tests needed | Covered |
| Website copy | `/docs/bounces-and-complaints` |
| AWS case evidence | Safe to describe code path; “deployed processing” only if SNS live |

## Send limits / suspension / outbound access

| Field | Notes |
|-------|--------|
| Current state | Plan monthly send room; newsletter caps; domain `SUSPENDED`; this wave: `send_status`, `outbound_access_status` |
| Relevant files | `worker/lib/billing.ts`, `worker/lib/workspace-send.ts`, `migrations/0034_ses_production_access.sql` |
| Already implemented? | Yes in-repo |
| Production deployed? | After remote D1 migrate + Worker deploy |
| Evidence | Tests + `POST /api/ops/workspace-send` |
| Missing | Operator token in production |
| Tests needed | Covered |
| Website copy | `/docs/sending-limits` |
| AWS case evidence | After migrate |

## Website / AUP / abuse

| Field | Notes |
|-------|--------|
| Current state | `/security` `/privacy` `/terms` `/status` existed; this wave adds `/acceptable-use` `/abuse` + docs routes |
| Relevant files | `src/pages/AcceptableUsePage.tsx`, `AbusePage.tsx`, Legal, Security, MarketingShell |
| Already implemented? | In-repo |
| Production deployed? | After `npm run deploy` |
| Evidence | Routes + footer |
| Missing | Live crawl after deploy |
| Tests needed | SEO registry |
| Website copy | Done |
| AWS case evidence | After public deploy |

## Newsletter unsubscribe

| Field | Notes |
|-------|--------|
| Current state | Active-only recipients; token unsubscribe; List-Unsubscribe header; bounce/complaint scoped unsubscribe |
| Relevant files | `worker/lib/newsletters.ts` |
| Already implemented? | Yes |
| Production deployed? | With Worker |
| Evidence | Tests |
| Missing | None material |
| Tests needed | Covered |
| Website copy | Pricing + sending-limits |
| AWS case evidence | Yes after deploy |

## Inbound / S3 / IAM / MAIL FROM

| Field | Notes |
|-------|--------|
| Current state | Inbound stack + HMAC + SNS verify. S3 policy template updated to SourceAccount/SourceArn. Easy DKIM. **No custom MAIL FROM.** |
| Relevant files | `infra/ses-inbound/template.yaml`, `docs/aws-ses-iam-review.md` |
| Already implemented? | In-repo |
| Production deployed? | Stack update **operator-required** |
| Evidence | Template + reviews |
| Missing | Confirm live bucket policy |
| Tests needed | Inbound security notes |
| Website copy | Privacy retention caveats |
| AWS case evidence | Describe actual stack after confirm |

## Custom MAIL FROM

| Field | Notes |
|-------|--------|
| Current state | Not implemented |
| Already implemented? | No |
| Production deployed? | No |
| AWS case evidence | **Do not claim** |
