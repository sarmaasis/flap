# Production cost guardrails

Numeric **plan limits are unchanged** (see `shared/plans.ts`). Enforcement is server-side (`assertWithinLimit`, `assertSendRoom`).

| Lever | Control today |
|---|---|
| SES sends | Monthly send room per workspace |
| Newsletter volume | Plan caps + blast hard cap (500) |
| Domains / mailboxes / aliases / seats | Plan limits |
| API keys / webhooks | Plan counts |
| Attachment size | Storage room + R2 |
| D1 / Worker CPU | Cloudflare account limits; no per-tenant CPU meter in-app |
| Invite spam | Pending invites count toward seats; 25 invite creates per workspace per hour |

**Not invented this wave:** automatic SES reputation suspend, per-member burst distinct from workspace send room.

Agencies share one SES reputation: one workspace cannot be allowed unlimited send without the existing monthly cap.
