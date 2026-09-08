# RFC: Agency workspaces

**Status:** Draft (design only — no production schema migration in this phase)  
**Phase:** E — Agency capabilities (audit §§19–21, 35 P2, §36)  
**Date:** 2026-09-09  
**Primary files today:** `worker/lib/team.ts`, `worker/lib/workspace.ts` (`/api/team*`), `worker/lib/collaboration-extras.ts`, `src/pages/settings/SettingsApp.tsx` (Team tab), `src/pages/InviteAccept.tsx`, migrations `0004_ops.sql` / `0006_teams_oauth.sql` / `0019_collaboration.sql`

---

## 1. Purpose

Agencies and small studios need to run **many client domains in one Flap workspace**, invite staff with limited access, clarify shared inboxes, and eventually **hand a domain to a client** without standing up a new Google Workspace tenant per brand.

This RFC freezes the target model and phased plan. It intentionally **does not** ship enterprise RBAC, domain IAM, or ownership transfer in this phase.

---

## 2. Current state (what already exists)

### 2.1 Workspace identity

- A **workspace is the billing/data owner user**: `workspace_id` equals the owner’s `users.id`.
- Resources (`domains`, `mailboxes`, messages, aliases, API keys, webhooks, etc.) are stored under that `user_id` / workspace id.
- Members join via `workspace_members (workspace_id, user_id, role)`.
- Active workspace is selected with cookie `flap_ws`; `resolveWorkspace()` picks preferred membership or defaults to self-owned workspace.

### 2.2 Roles today

| Role | Code | Capabilities today |
|------|------|--------------------|
| **Owner** | `owner` | Full access; seat that owns billing resources; cannot be removed via team API |
| **Admin** | `admin` | `canManageTeam` + `canManageSettings`; sees **all** workspace mailboxes |
| **Member** | `member` | No settings/domain/mailbox CRUD; mailbox access only via `mailbox_members` (or empty) |

There is **no first-class `read-only` workspace role**. Domain settings endpoints return `{ domains: [], read_only: true }` for non-admin members (UI hint only — not a mailbox send/receive ACL).

Mailbox membership stores a `role` (`admin` | `member`) but **send/read enforcement does not distinguish read-only**; access is effectively binary (has mailbox grant or not).

### 2.3 Invitation workflow (shipped)

1. Owner/admin on Pro/Team (`team_seats > 1`) creates invite: `POST /api/team/invites` → `createInvite()`.
2. Invite stores email, role (`admin`|`member`), optional `mailbox_ids` JSON, 14-day expiry, token.
3. Seat limits count current members + pending invites.
4. Accept at `/invite/:token` (`InviteAccept.tsx`) → must sign in as the invited email → `acceptInvite()`.
5. On accept: upsert `workspace_members`; grant listed mailboxes, or **default to all `is_shared = 1` mailboxes**.
6. Revoke pending invite / remove member APIs exist; removing a member also clears their `mailbox_members` for that workspace’s mailboxes.

**Gaps:** no email delivery of invites (link copy in Settings); no role change UI after join; no per-mailbox member picker in Settings UI (API `POST /api/team/mailboxes/:id/members` exists but is not exposed in the Team tab).

### 2.4 Shared inboxes

- Flag: `mailboxes.is_shared`.
- Toggle: Settings → Team → “Make shared” / API share endpoint; requires Team-capable plan when enabling.
- Mental model today: shared flag ≈ “include in default invite grants,” not a full Front/Missive-style shared queue product.
- Thread assignment / notes exist elsewhere (collaboration); presence is Team-gated.

**Clarity gap:** private vs shared vs “granted to this member” is easy to confuse. Unsharing does not automatically revoke existing `mailbox_members` rows.

### 2.5 Domain-level permissions

- **Not implemented.** Domains are wholly owned by the workspace user id.
- Stub only: `GET /api/domain-iam` returns static role labels (`send_all`, `send_mapped`, `read_only`) with a note — no persistence or enforcement.

### 2.6 Audit log

- Table `audit_log` + `GET /api/audit-log` (Team plan, last 200, 90-day retention claim).
- Writer: `writeAuditLog()` — used sparsely (e.g. domain park/unpark). **Team invite/accept/remove/share are not audited.**
- No Settings UI surface for audit log found.

### 2.7 Agency-adjacent stubs (not productized)

| Feature | Status |
|---------|--------|
| Client portals (`client_portals`) | Create API stub; public portal UX incomplete |
| VA invites (`va_invites`) | Create API stub |
| Holding workspaces (`workspaces_extra`) | List/create stub; not wired into `resolveWorkspace` |
| Domain ownership transfer | **Not implemented** |
| Client/domain grouping labels | **Not implemented** |

### 2.8 Marketing / positioning surfaces

- **`/for/agencies` exists** (hub content in `src/content/hubs.ts`): short ICP page — multi-domain org, Team seats/shared inboxes, deliverability. Quality: **adequate ICP stub**, not a dedicated agency product story.
- **`/email-for-agencies` does not exist.** Audit suggestion remains optional SEO alias; do not build a full agency product UI in Phase E.
- Pricing already positions Team for “studios and agencies.”

### 2.9 Classification (audit style)

| Capability | Status |
|------------|--------|
| Multi-seat workspace + invites | `ALREADY IMPLEMENTED + WELL EXPOSED` (Settings Team tab) |
| Shared mailbox flag | `ALREADY IMPLEMENTED + POORLY EXPOSED` (flag vs grants unclear) |
| Mailbox-level grants | `PARTIALLY IMPLEMENTED` (API + invite path; weak UI / no read-only) |
| Domain-level permissions | `NOT IMPLEMENTED` (stub only) |
| Read-only role | `NOT IMPLEMENTED` |
| Audit trail for team actions | `PARTIALLY IMPLEMENTED` |
| Client grouping | `NOT IMPLEMENTED` |
| Domain transfer | `NOT IMPLEMENTED` |
| Agency landing depth | `PARTIALLY IMPLEMENTED` (`/for/agencies` only) |

---

## 3. Target model

### 3.1 Workspace roles

Keep **four** workspace roles — no custom permission matrices in v1:

```text
Owner
  → billing, destructive ops, transfer initiation, everything Admin can do

Admin
  → manage team, domains, mailboxes, shares, non-billing settings
  → all mailboxes in workspace (unless future domain scope is added)

Member
  → read/send on granted mailboxes only
  → no domain DNS, billing, API keys, webhooks, or team admin

Read-only
  → read (and search/label as allowed) on granted mailboxes
  → cannot send, delete permanently, or change mailbox settings
```

**Mapping from today:** `owner` / `admin` / `member` stay; add `read-only` (or `readonly`) as a fourth `workspace_members.role` value. Until then, treat “client observer” as out of band (export / future portal).

### 3.2 Capability matrix (target)

| Action | Owner | Admin | Member | Read-only |
|--------|:-----:|:-----:|:------:|:---------:|
| Billing / plan change | ✓ | | | |
| Invite / remove members | ✓ | ✓ | | |
| Add/remove domains & DNS | ✓ | ✓ | | |
| Create mailboxes / aliases | ✓ | ✓ | | |
| Mark shared / grant mailbox | ✓ | ✓ | | |
| API keys & webhooks | ✓ | ✓* | | |
| Read mail (granted) | ✓ | ✓ | ✓ | ✓ |
| Send / reply | ✓ | ✓ | ✓ | |
| Initiate domain transfer | ✓ | | | |
| Accept domain transfer | receiving Owner | | | |

\*Prefer Owner-only for creating API keys/webhooks if agencies want stronger blast-radius control; Admin may manage if product prefers parity with today’s `canManageSettings`.

### 3.3 Permission boundaries

Three nested scopes — implement only as far as demand requires:

```text
Workspace
  └─ Domain          (future: domain_members or domain allow-list on member)
       └─ Mailbox    (today: mailbox_members)
```

**Rules of thumb:**

1. **Workspace role** gates admin surfaces (settings, billing, team).
2. **Mailbox grant** gates mail data for Member / Read-only.
3. **Domain scope** (future) means “all current and future mailboxes on domain X” without listing each mailbox — critical for agencies, not required for founder-solo.

**Do not** introduce ABAC, resource tags, or per-action policy documents in P2.

---

## 4. Invitation workflow (target)

### Happy path

1. Admin/Owner invites email + role + optional mailbox set (and later optional domain set).
2. System emails invite link (in addition to copyable link).
3. Invitee authenticates as that email; accept is idempotent.
4. Seat check at create **and** accept; expired/revoked invites fail closed.
5. Acceptance writes audit: `team.invite_accepted`.
6. Default grants: if no mailboxes selected → **shared mailboxes only** (keep current behavior); document this in UI copy.

### UX clarity (small, high value)

- Show “This person will see: …” preview before send.
- Distinguish **Admin (full workspace)** vs **Member (selected inboxes)**.
- After join: Settings → Members → edit grants / role (missing today).
- Unshare mailbox → prompt: revoke access for existing members?

---

## 5. Shared inbox clarity

**Definition (product copy):**

> A **shared mailbox** is a team address (e.g. `support@client.com`) that multiple workspace members can read and reply from. Sharing is a property of the mailbox; **who** can access it is controlled by membership grants.

**Private mailbox:** only Owner/Admin (and explicitly granted members) — default for personal `you@` addresses.

**Implementation guidance (no schema change required for clarity):**

- Inbox UI: badge “Shared” vs “Private”; filter “Shared inboxes.”
- Team settings: for each shared mailbox, list members with access (use existing `member_ids` / grant APIs).
- Invite default copy: “Defaults to all shared inboxes.”
- Optional later: assignment queues, collision presence (partially present) — not blocking agency MVP.

---

## 6. Client / domain grouping (future)

Agencies think in **clients**, not flat domain lists.

**Future (P2 late / P3):**

- Soft grouping: `client_groups` or tags on domains (`client_id`, display name, color).
- Filters: inbox + settings by client.
- Not a separate billing tenant; still one workspace.
- Holding / multi-billing workspaces (`workspaces_extra`) stay **non-goals** until a paying Studio asks for brand walls + separate invoices.

---

## 7. Domain ownership transfer workflow

### 7.1 Problem

Agency controls `client.com` under agency workspace → client leaves → domain (and chosen mail data) must move to client’s Flap account **without** informal “we’ll export and recreate DNS.”

### 7.2 Proposed flow

```text
Agency Owner initiates transfer of domain D → Client email
        ↓
Pending transfer record (expires, e.g. 7–14 days)
        ↓
Client accepts (must be Owner of their own workspace / create account)
        ↓
Atomic cutover of domain-scoped resources
        ↓
Audit + irreversible confirmation artifacts
```

### 7.3 Authorization

- **Initiate:** workspace Owner only (not Admin — irreversible + billing impact).
- **Accept:** authenticated user matching invite email; becomes Owner of receiving workspace (or specified target workspace they own).
- **Cancel:** initiating Owner while pending; auto-expire.
- Reject concurrent transfers on same domain; lock domain mutations while pending.

### 7.4 What moves vs stays

| Asset | Default on accept |
|-------|-------------------|
| Domain row + DNS/SES identity linkage | **Move** to receiving `user_id` |
| Mailboxes on that domain | **Move** |
| Messages / threads for those mailboxes | **Move** (or offer “metadata only” later — default full move) |
| Aliases tied to domain | **Move** |
| Catch-all / domain settings | **Move** |
| Mailbox_members for moved mailboxes | **Drop** agency members; receiving Owner starts clean |
| Workspace-level API keys | **Stay** on agency (do not transfer secrets) |
| Webhooks | **Stay** on agency; warn if events were domain-filtered |
| Transactional credentials / API keys | **Stay**; client must create own keys |
| Billing / plan seats | **Stay** on agency; domain count decrements agency / increments client (enforce plan limits on accept) |
| Newsletters / booking / calendars bound to domain | Define per-feature; prefer move if domain-scoped, else warn & detach |
| Audit history | **Copy summary** event to both workspaces; full historical rows remain on agency or dual-write transfer id |

### 7.5 Irreversible actions & confirmation

- Typed confirmation: domain name string.
- Checklist UI: DNS remains client’s responsibility; MX/DKIM already on domain so mail continues if identities reassigned correctly in SES.
- Cool-down: optional 24h cancel window **or** immediate cutover with strong confirm (pick one in implementation RFC; prefer immediate + dual confirm for email products).
- Post-transfer: agency loses read access immediately.

### 7.6 SES / infra notes (design constraint)

Transfer must update app ownership **and** any SES receipt-rule / identity ownership assumptions tied to `user_id`. Treat as a coordinated worker job, not a single SQL `UPDATE`. Fail closed: if infra step fails, do not leave split-brain ownership.

### 7.7 Audit logs (required for transfer)

Minimum events: `transfer.created`, `transfer.cancelled`, `transfer.expired`, `transfer.accepted`, `transfer.completed`, `transfer.failed` with actor, domain, source/target workspace ids, resource counts.

---

## 8. Migration risks

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| `workspace_id === user_id` coupling | Hard to rename orgs / multi-workspace | Keep model; don’t introduce org table until holding workspaces are real |
| Members with empty mailbox grants | Invite with no shared mailboxes → empty inbox | UI warning; require ≥1 grant for Member/Read-only |
| Unshare without revoke | Lingering access | Cascade revoke option |
| Admin = all mailboxes | Too broad for multi-client agencies | Future domain scope; until then educate / use Member |
| Read-only not enforced on send paths | Role name without teeth | Gate compose/send APIs on role before marketing Read-only |
| Transfer + SES | Split brain / lost inbound | Transactional job + reconciliation |
| Plan limits on accept | Client Free plan can’t hold domain | Preflight limits; block accept with upgrade CTA |
| Stub tables (portals, VA, holding) | Dead product surface | Leave stubs; don’t market; fold or delete later |
| Premature `domain_members` schema | Costly migrations | Ship clarity + read-only + audit first |

**This phase:** no large production schema changes. Additive columns (e.g. `read-only` role string) only when implementation starts and can be backward-compatible.

---

## 9. Phased implementation plan (P2 tasks)

### P2-E0 — Design (this RFC) ✅

Ship `docs/rfc-agency-workspaces.md`; no behavior change.

### P2-E1 — Clarity & hygiene (safe, small)

1. Shared-inbox copy + member grant list in Team settings (wire existing grant/revoke APIs).
2. Audit team lifecycle: invite, accept, revoke, remove, share/unshare.
3. Invite email delivery (transactional system mail).
4. Optional: redirect or alias `/email-for-agencies` → `/for/agencies` with slightly richer copy — **not** a full product UI.

### P2-E2 — Read-only role (small schema-tolerant)

1. Allow `role = 'read-only'` on invites/members.
2. Enforce no-send / no-destructive mail actions in worker.
3. Settings + Invite UI options.

### P2-E3 — Domain-scoped grants (medium)

1. Design `domain_members` **or** invite `domain_ids` expanded to all mailboxes on accept + “include future mailboxes” flag.
2. Prefer expand-on-accept + re-sync job before new tables if possible.
3. Domain IAM stub either implemented or removed from public API.

### P2-E4 — Client grouping (medium, optional)

Tags/groups for domains; inbox filters; no RBAC change.

### P2-E5 — Domain transfer (large — separate implementation RFC)

1. Transfer tables + state machine.
2. SES/identity ownership runbook.
3. Billing limit preflight.
4. Dual audit + confirmation UX.
5. Hardening tests: concurrent transfer, partial failure, cross-tenant access.

**Complex RBAC / transfer implementation is out of scope for Phase E execution beyond this design**, unless a trivial gap (e.g. audit on invite) is safe.

---

## 10. Explicit non-goals

- Enterprise SSO / SAML / SCIM
- Custom roles and per-action permission editors
- Per-folder or per-label ACLs
- White-label client portals as a launch requirement (stub may remain dark)
- Multi-workspace holding companies with separate billing walls
- Guaranteed legal “data residency” / client isolation SKUs
- Automatic offboarding workflows beyond transfer + revoke
- Building a full agency dashboard or MSP console in Phase E
- Large production schema rewrites of `user_id` ownership model

---

## 11. Recommended first three implementation steps

When leaving design and entering build (still prefer additive, reversible changes):

1. **Team Settings: shared-inbox membership UI** — list who can access each shared mailbox; call existing grant/revoke APIs; fix unshare → revoke prompt. Highest agency clarity per line of code.
2. **Audit team actions** via `writeAuditLog` on invite/accept/revoke/remove/share. Unblocks trust for transfer later and costs almost no schema.
3. **Add `read-only` role end-to-end** (invite → member → send guards). Delivers the fourth role from the target model without domain IAM.

Defer domain transfer and `domain_members` until the above is stable and a real agency customer needs handoff.

---

## 12. Open questions

1. Should Admins create API keys/webhooks, or Owner-only?
2. Transfer: move full message history by default, or offer “DNS + empty mailboxes” for cheaper handoff?
3. Is `/email-for-agencies` worth a distinct SEO page vs strengthening `/for/agencies`?
4. When a Member is granted a private (non-shared) mailbox via invite, should the mailbox auto-flip `is_shared`?

---

## 13. References

- Product audit §§19–21, 35 P2, §36 Phase E — `FLAP_CURSOR_PRODUCT_AUDIT.md`
- `worker/lib/team.ts` — membership, invites, mailbox ACL helpers
- `worker/lib/collaboration-extras.ts` — audit log, portals, VA, holding stubs
- `worker/lib/domain-controls.ts` — domain IAM stub
- `src/content/hubs.ts` — `/for/agencies`
- Plans: `shared/plans.ts` (Pro seats, Team unlimited seats)
