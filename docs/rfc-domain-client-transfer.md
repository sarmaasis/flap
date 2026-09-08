# RFC: Domain / client transfer

**Status:** Design only — **do not implement** until membership + grants are stable in production and this RFC is approved.  
**Depends on:** `docs/rfc-agency-workspaces.md` §7, `docs/agency-production-master-plan.md` P2-40.

## Problem

Agency owns `client.com` and mail history. Client leaves and must take the domain without informal export/recreate.

## Authorization

- Initiate: **Owner only** (not Admin).
- Accept: authenticated user matching invite email; destination workspace they own.
- Cancel: initiating Owner while pending; expire 7–14 days.
- Reject concurrent transfers; lock domain mutations while pending.

## Moves vs stays

| Asset | Default |
|---|---|
| Domain + SES identity linkage | Move |
| Mailboxes + messages + aliases | Move |
| mailbox_members | Drop (receiving Owner clean) |
| workspace API keys / webhooks / transactional secrets | Stay on source |
| Billing | Stay on source; enforce destination plan limits on accept |
| Audit | Summary event both sides; do not copy webhook secrets |

## Irreversible

Typed domain confirmation from source **and** destination. Fail closed if SES identity reassignment fails (no split-brain).

## Non-goals

Marketplace, automated escrow, partial “metadata only” move in v1 (can be a later option).
