# Release rollback runbook

## Code rollback

Redeploy the previous Worker + assets artifact. Safe if schema is additive.

## `0033_agency_production.sql`

| Question | Answer |
|---|---|
| Code rollback safe? | Yes — old code ignores new tables/columns. |
| Schema additive? | Yes. |
| Constraint irreversible? | No new unique constraints. |
| Data backfill? | Invite hashes only on **new** invites. |
| Manual remediation? | Leave tables/columns in place. |

Do **not** DROP `workspace_member_domains` if any grants were issued in production.

## Earlier migrations

`0030`–`0032`: see `docs/next-security-core-results.md`. `0031` unique domain index is the only painful rollback (do not reintroduce duplicate domains).

## Local rehearsal (can run without staging)

```bash
npx tsx scripts/agency-rollback-rehearsal.ts
```

This applies 0033-shaped additive columns in memory and asserts pre-0033 membership SELECTs still work. It is **not** a remote D1 restore drill.

## Failed deploy

1. Stop traffic to the new Worker if possible.  
2. Redeploy last known-good.  
3. Leave D1 as-is unless data corruption is proven.  
4. If `0033` applied and new Worker is live with grants, rolling back code only: new grants sit unused; membership still uses old tables.
