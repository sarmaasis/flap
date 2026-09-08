# Flap Audit — Status & Review Board

**As of:** 2026-09-09  
**Repo:** `/Users/sarmaasis/Work/projects/flap`  
**Audience:** Product owner continuing the audit wave  
**Working tree note:** Most audit deliverables and code fixes are **uncommitted** (docs + Phase B/C/D + next security/core wave). Commit/review before treating anything as shipped to production.

---

## Snapshot

| Phase | Status | Owner deliverable | Needs human review? |
|-------|--------|-------------------|---------------------|
| **A — Inventory** | **COMPLETE** | `docs/flap-audit-findings.md` + `docs/flap-implementation-plan.md` | Yes — confirm P0/P1 priority order still matches product intent |
| **B — Security** | **COMPLETE** (B-R1…B-R4 done in next wave) | `docs/audit-phase-b-security.md` + `docs/next-security-core-results.md` | **Yes** — deploy migrations `0030`/`0031`/`0032` via staging |
| **Next — Security/Core** | **COMPLETE** (P0 + most P1; P2 deferred) | `docs/next-security-core-plan.md` + `docs/next-security-core-results.md` + `docs/audit-http-tenant-isolation.md` | **Yes** — staging migrate + smoke |
| **C — Positioning** | **COMPLETE** | `docs/audit-phase-c-positioning.md` + Landing / trust pages | Yes — copy, FAQ, migrate/why-not-SES claims |
| **D — SEO** | **COMPLETE** (reconciled; claim review before publish) | `docs/audit-phase-d-seo.md` + 7 landings/aliases | Yes — human review required for `/vs/*` claims before publish |
| **E — Agency RFC** | **COMPLETE** (design only) | `docs/rfc-agency-workspaces.md` | Superseded for build by agency production wave |
| **Agency / studio production** | **IN PROGRESS / NO-GO** | `docs/agency-production-master-plan.md` + `docs/agency-production-results.md` | Yes — not production-ready until live Gmail/Outlook, restore drill, alerts |

---

## Next wave — Security / reliability / core (2026-09-09)

- **Status: COMPLETE for P0 + most P1** — see **`docs/next-security-core-results.md`** (source of truth for this wave).
- **Plan:** `docs/next-security-core-plan.md`
- **IDOR:** `docs/audit-http-tenant-isolation.md` + `shared/http-tenant-isolation.test.ts` in `npm run check`
- **Also:** remote-image privacy, presence workspace scoping (`0032`), outbound policy helper, SNS trust model doc, deliverability/DNS/migrate/activation/identity polish.
- **Deferred:** P2 shared-inbox expansion; live Clerk+Wrangler boot suite; CA pin; IMAP import.

---

## Done (prior phases — summary)

### Phase A — Inventory
- `docs/flap-audit-findings.md`, `docs/flap-implementation-plan.md`; suppressions API tenancy fix.

### Phase B — Security / reliability
- See `docs/audit-phase-b-security.md`. B-R1…B-R4 **Done** (B-R4 via next-wave HTTP IDOR harness).
- Deploy needs: migrations `0030` + `0031` + `0032` via staging then prod.

### Phase C — Positioning
- See `docs/audit-phase-c-positioning.md`. Homepage, trust pages, `/migrate`, `/why-not-amazon-ses`, `/demo`, `/changelog`.

### Phase D — SEO
- See `docs/audit-phase-d-seo.md`. Landings + aliases complete; **human `/vs/*` claim review before publish**.

### Phase E — Agency
- `docs/rfc-agency-workspaces.md` design only (historical).
- **Build wave:** `docs/agency-production-master-plan.md` + `docs/agency-production-results.md` (P0–P2 code; **NO-GO** for 10/10 until live mail + restore + alerts).

---

## In progress / incomplete

- Automated IMAP/Takeout import — intentionally deferred.
- Next-wave residuals: see Deferred in `docs/next-security-core-results.md`.
- Agency implementation not started (RFC only).

---

## Requires your review

1. **Commit / deploy gate** — Review `docs/next-security-core-results.md` + migrations `0030`/`0031`/`0032` (staging then prod).
2. **Suppressions product rule** — Per-workspace `user_id`; unattributed bounce/complaint does not create Flap suppressions (SES account blocks may still apply).
3. Positioning + `/vs/*` claim review before publish freeze lift.
4. Plan numeric limits unchanged.
5. Agency RFC before E1 build.

---

## Recommended next work order

1. Human review + commit (migrations + IDOR harness).  
2. Staging migrate + two-account cross-tenant smoke → production migrate.  
3. `/vs/*` claim review.  
4. Later P2: E1 → E2 → E3 per RFC.

---

## Key artifacts

| Path | Role |
|------|------|
| `docs/next-security-core-plan.md` | Next-wave plan (§2–§21) |
| `docs/next-security-core-results.md` | **Next-wave results (read this)** |
| `docs/audit-http-tenant-isolation.md` | HTTP IDOR harness coverage |
| `docs/sns-webhook-trust-model.md` | SNS/HMAC trust model |
| `docs/audit-phase-b-security.md` | Phase B security audit |
| `docs/flap-audit-status-review.md` | This status board |
| `migrations/0030_suppressions_tenancy_inbound.sql` | Suppressions tenancy + inbound log |
| `migrations/0031_global_unique_domains.sql` | Global unique domains |
| `migrations/0032_presence_workspace.sql` | Presence workspace scoping |

---

## Known risks / do-not-do

- Do not change plan numeric limits without economics review.
- Do not fabricate metrics/certs; do not loosen MessageReader sandbox.
- Do not enable `SES_INBOUND_ALLOW_UNSIGNED` in production.
- Do not apply `0031` on production until duplicate audit is empty.
- Do not start enterprise RBAC / domain transfer before agency E1–E2.
