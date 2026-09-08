import {
  canActorManageTarget,
  hashInviteToken,
  inviteRoleFromInput,
  mergeUniqueIds,
  normalizeWorkspaceRole,
  shouldKeepExistingMembershipRole,
  type WorkspaceRole,
} from "../../shared/agency-authz";
import { mailboxAccessSql } from "../../shared/security-guards";
import { assertWithinLimit, getEffectivePlan } from "./billing";
import { randomId, nowMs } from "./ids";
import { EMAIL_RE, extractEmail } from "./mailutil";
import { writeAuditLog } from "./plan-guard";

export type { WorkspaceRole };

export type WorkspaceCtx = {
  userId: string;
  /** Billing / data owner — resources are stored under this user_id */
  workspaceId: string;
  role: WorkspaceRole;
  isOwner: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
  /** null = all mailboxes in the workspace; otherwise granted ids only */
  mailboxIds: string[] | null;
  /** null = all domains; otherwise granted domain ids (plus domains of granted mailboxes) */
  domainIds: string[] | null;
};

export async function ensureOwnerMembership(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at, status)
       VALUES (?, ?, 'owner', ?, 'active')`,
    )
    .bind(userId, userId, nowMs())
    .run();
}

export async function requireWorkspaceRole(
  ctx: WorkspaceCtx,
  min: WorkspaceRole,
): Promise<{ ok: true } | { ok: false; error: string; status: 403 }> {
  const rank = { member: 1, admin: 2, owner: 3 };
  if (rank[ctx.role] < rank[min]) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }
  return { ok: true };
}

export async function resolveWorkspace(
  db: D1Database,
  userId: string,
  preferredWorkspaceId?: string | null,
): Promise<WorkspaceCtx> {
  const memberships = await db
    .prepare(
      `SELECT workspace_id, role FROM workspace_members
       WHERE user_id = ? AND COALESCE(status, 'active') = 'active'
       ORDER BY CASE WHEN workspace_id = user_id THEN 0 ELSE 1 END, created_at ASC`,
    )
    .bind(userId)
    .all<{ workspace_id: string; role: string }>();

  let rows = memberships.results ?? [];
  if (!rows.some((r) => r.workspace_id === userId)) {
    await ensureOwnerMembership(db, userId);
    const again = await db
      .prepare(
        `SELECT workspace_id, role FROM workspace_members
         WHERE user_id = ? AND COALESCE(status, 'active') = 'active'
         ORDER BY CASE WHEN workspace_id = user_id THEN 0 ELSE 1 END, created_at ASC`,
      )
      .bind(userId)
      .all<{ workspace_id: string; role: string }>();
    rows = again.results ?? [];
  }

  let pick = rows.find((r) => r.workspace_id === preferredWorkspaceId) ?? rows[0];
  if (!pick) {
    pick = { workspace_id: userId, role: "owner" };
  }

  const role = normalizeWorkspaceRole(pick.role);
  const isOwner = pick.workspace_id === userId && role === "owner";
  const canManageTeam = role === "owner" || role === "admin";
  const canManageSettings = role === "owner" || role === "admin";

  let mailboxIds: string[] | null = null;
  let domainIds: string[] | null = null;
  if (!isOwner && role !== "admin") {
    const grants = await loadMemberGrants(db, pick.workspace_id, userId);
    mailboxIds = grants.mailboxIds;
    domainIds = grants.domainIds;
  }

  return {
    userId,
    workspaceId: pick.workspace_id,
    role,
    isOwner,
    canManageTeam,
    canManageSettings,
    mailboxIds,
    domainIds,
  };
}

export async function loadMemberGrants(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<{ mailboxIds: string[]; domainIds: string[] }> {
  const grantedMailboxes = await db
    .prepare(
      `SELECT mm.mailbox_id AS id
       FROM mailbox_members mm
       JOIN mailboxes m ON m.id = mm.mailbox_id
       WHERE mm.user_id = ? AND m.user_id = ?`,
    )
    .bind(userId, workspaceId)
    .all<{ id: string }>();

  const grantedDomains = await db
    .prepare(
      `SELECT wmd.domain_id AS id
       FROM workspace_member_domains wmd
       JOIN domains d ON d.id = wmd.domain_id
       WHERE wmd.workspace_id = ? AND wmd.user_id = ? AND d.user_id = ?`,
    )
    .bind(workspaceId, userId, workspaceId)
    .all<{ id: string }>()
    .catch(() => ({ results: [] as { id: string }[] }));

  const domainIds = (grantedDomains.results ?? []).map((r) => r.id);
  let domainMailboxes: string[] = [];
  if (domainIds.length) {
    const placeholders = domainIds.map(() => "?").join(", ");
    const rows = await db
      .prepare(
        `SELECT id FROM mailboxes WHERE user_id = ? AND domain_id IN (${placeholders})`,
      )
      .bind(workspaceId, ...domainIds)
      .all<{ id: string }>();
    domainMailboxes = (rows.results ?? []).map((r) => r.id);
  }

  const fromMailboxes = (grantedMailboxes.results ?? []).map((r) => r.id);
  const mailboxIds = mergeUniqueIds(fromMailboxes, domainMailboxes);

  const mailboxDomainRows = mailboxIds.length
    ? await db
        .prepare(
          `SELECT DISTINCT domain_id AS id FROM mailboxes
           WHERE user_id = ? AND id IN (${mailboxIds.map(() => "?").join(", ")})`,
        )
        .bind(workspaceId, ...mailboxIds)
        .all<{ id: string }>()
    : { results: [] as { id: string }[] };

  return {
    mailboxIds,
    domainIds: mergeUniqueIds(domainIds, (mailboxDomainRows.results ?? []).map((r) => r.id)),
  };
}

export function mailboxAccessClause(
  ctx: WorkspaceCtx,
  column = "mailbox_id",
): { sql: string; binds: unknown[] } {
  return mailboxAccessSql({ mailboxIds: ctx.mailboxIds }, column);
}

export async function listAccessibleMailboxes(db: D1Database, ctx: WorkspaceCtx) {
  if (ctx.mailboxIds === null) {
    return db
      .prepare(
        `SELECT m.id, m.domain_id, m.local_part, m.address, m.display_name, m.is_shared, m.created_at, d.name AS domain,
                'owner' AS access_role
         FROM mailboxes m
         JOIN domains d ON d.id = m.domain_id
         WHERE m.user_id = ?
         ORDER BY m.created_at ASC`,
      )
      .bind(ctx.workspaceId)
      .all();
  }
  if (ctx.mailboxIds.length === 0) {
    return { results: [] as unknown[] };
  }
  const placeholders = ctx.mailboxIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT m.id, m.domain_id, m.local_part, m.address, m.display_name, m.is_shared, m.created_at, d.name AS domain,
              COALESCE(mm.role, 'member') AS access_role
       FROM mailboxes m
       JOIN domains d ON d.id = m.domain_id
       LEFT JOIN mailbox_members mm ON mm.mailbox_id = m.id AND mm.user_id = ?
       WHERE m.user_id = ? AND m.id IN (${placeholders})
       ORDER BY m.created_at ASC`,
    )
    .bind(ctx.userId, ctx.workspaceId, ...ctx.mailboxIds)
    .all();
}

export async function assertMailboxAccess(
  db: D1Database,
  ctx: WorkspaceCtx,
  mailboxId: string,
): Promise<{ ok: true; mailbox: { id: string; address: string; display_name: string; user_id: string } } | { ok: false }> {
  const mailbox = await db
    .prepare(
      "SELECT id, address, display_name, user_id FROM mailboxes WHERE id = ? AND user_id = ?",
    )
    .bind(mailboxId, ctx.workspaceId)
    .first<{ id: string; address: string; display_name: string; user_id: string }>();
  if (!mailbox) return { ok: false };
  if (ctx.mailboxIds === null) return { ok: true, mailbox };
  if (!ctx.mailboxIds.includes(mailboxId)) return { ok: false };
  return { ok: true, mailbox };
}

export async function assertDomainAccess(
  ctx: WorkspaceCtx,
  domainId: string,
): Promise<{ ok: true } | { ok: false }> {
  if (ctx.domainIds === null) return { ok: true };
  if (ctx.domainIds.includes(domainId)) return { ok: true };
  return { ok: false };
}

export async function countTeamSeats(db: D1Database, workspaceId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM workspace_members
       WHERE workspace_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(workspaceId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

function parseIdList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && !!id) : [];
  } catch {
    return [];
  }
}

async function filterOwnedMailboxIds(db: D1Database, workspaceId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const owned = await db
    .prepare(`SELECT id FROM mailboxes WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(workspaceId, ...ids)
    .all<{ id: string }>();
  const ok = new Set((owned.results ?? []).map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

async function filterOwnedDomainIds(db: D1Database, workspaceId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const owned = await db
    .prepare(`SELECT id FROM domains WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(workspaceId, ...ids)
    .all<{ id: string }>();
  const ok = new Set((owned.results ?? []).map((r) => r.id));
  return ids.filter((id) => ok.has(id));
}

/** Abuse cap: pending+revoked creates in the last hour (seats still apply separately). */
export const INVITE_HOURLY_CAP = 25;

export async function createInvite(
  db: D1Database,
  ctx: WorkspaceCtx,
  input: { email: string; role?: string; mailbox_ids?: string[]; domain_ids?: string[] },
): Promise<
  | { ok: true; invite: { id: string; email: string; role: string; token: string; status: string; expires_at: number; accept_path: string } }
  | { ok: false; error: string; status: 400 | 402 | 403 }
> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only workspace owners and admins can invite teammates.", status: 403 };
  }

  const { plan_id, limits } = await getEffectivePlan(db, ctx.workspaceId);
  if (limits.team_seats <= 1) {
    return {
      ok: false,
      status: 402,
      error: `Team invites require the Team plan. Your ${plan_id} plan is solo-only — upgrade to Team to invite members.`,
    };
  }

  const email = extractEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid invite email.", status: 400 };
  }
  if (input.role === "owner") {
    return { ok: false, error: "Cannot invite someone as workspace owner.", status: 400 };
  }

  const existingUser = await db
    .prepare("SELECT id FROM users WHERE lower(email) = ?")
    .bind(email)
    .first<{ id: string }>();
  if (existingUser) {
    const already = await db
      .prepare(
        `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
      )
      .bind(ctx.workspaceId, existingUser.id)
      .first();
    if (already) {
      return { ok: false, error: "That person is already a workspace member.", status: 400 };
    }
  }

  const role = inviteRoleFromInput(input.role);
  if (role === "admin" && ctx.role !== "owner") {
    return { ok: false, error: "Only the workspace owner can invite admins.", status: 403 };
  }

  const recentInvites = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM workspace_invites
       WHERE workspace_id = ? AND created_at > ?`,
    )
    .bind(ctx.workspaceId, nowMs() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if (Number(recentInvites?.n ?? 0) >= INVITE_HOURLY_CAP) {
    return { ok: false, error: "Too many invites created in the last hour. Try again later.", status: 400 };
  }

  const seats = await countTeamSeats(db, ctx.workspaceId);
  const pending = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM workspace_invites
       WHERE workspace_id = ? AND status = 'pending' AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .bind(ctx.workspaceId, nowMs())
    .first<{ n: number }>();
  const projected = seats + Number(pending?.n ?? 0);
  const seatLimit = await assertWithinLimit(db, ctx.workspaceId, "team_seats", projected);
  if (!seatLimit.ok) return { ok: false, error: seatLimit.error, status: seatLimit.status };

  const mailboxIds = await filterOwnedMailboxIds(
    db,
    ctx.workspaceId,
    Array.isArray(input.mailbox_ids) ? input.mailbox_ids.filter(Boolean) : [],
  );
  const domainIds = await filterOwnedDomainIds(
    db,
    ctx.workspaceId,
    Array.isArray(input.domain_ids) ? input.domain_ids.filter(Boolean) : [],
  );

  const id = randomId("inv");
  const token = randomId("itk");
  const tokenHash = await hashInviteToken(token);
  const expires = nowMs() + 14 * 24 * 60 * 60 * 1000;
  try {
    await db
      .prepare(
        `INSERT INTO workspace_invites
         (id, invited_by, email, role, status, created_at, token, token_hash, workspace_id, expires_at, mailbox_ids, domain_ids)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        ctx.userId,
        email,
        role,
        nowMs(),
        token,
        tokenHash,
        ctx.workspaceId,
        expires,
        JSON.stringify(mailboxIds),
        JSON.stringify(domainIds),
      )
      .run();
  } catch {
    await db
      .prepare(
        `INSERT INTO workspace_invites
         (id, invited_by, email, role, status, created_at, token, workspace_id, expires_at, mailbox_ids)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
      )
      .bind(id, ctx.userId, email, role, nowMs(), token, ctx.workspaceId, expires, JSON.stringify(mailboxIds))
      .run();
  }

  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "team.invite_created", id, {
    email,
    role,
    mailbox_count: mailboxIds.length,
    domain_count: domainIds.length,
  });

  return {
    ok: true,
    invite: {
      id,
      email,
      role,
      token,
      status: "pending",
      expires_at: expires,
      accept_path: `/invite/${token}`,
    },
  };
}

async function lookupInviteByToken(db: D1Database, token: string) {
  const hashed = await hashInviteToken(token);
  const byHash = await db
    .prepare(
      `SELECT id, email, role, status, workspace_id, expires_at, mailbox_ids, domain_ids, invited_by, token
       FROM workspace_invites WHERE token_hash = ?`,
    )
    .bind(hashed)
    .first<{
      id: string;
      email: string;
      role: string;
      status: string;
      workspace_id: string | null;
      expires_at: number | null;
      mailbox_ids: string;
      domain_ids?: string;
      invited_by: string;
      token: string | null;
    }>()
    .catch(() => null);
  if (byHash) return byHash;
  return db
    .prepare(
      `SELECT id, email, role, status, workspace_id, expires_at, mailbox_ids, invited_by, token
       FROM workspace_invites WHERE token = ?`,
    )
    .bind(token)
    .first<{
      id: string;
      email: string;
      role: string;
      status: string;
      workspace_id: string | null;
      expires_at: number | null;
      mailbox_ids: string;
      domain_ids?: string;
      invited_by: string;
      token: string | null;
    }>();
}

export async function acceptInvite(
  db: D1Database,
  token: string,
  acceptingUserId: string,
): Promise<{ ok: true; workspace_id: string } | { ok: false; error: string; status: 401 | 403 | 404 | 410 | 402 }> {
  const invite = await lookupInviteByToken(db, token);

  if (!invite || !invite.workspace_id) {
    return { ok: false, error: "Invite not found.", status: 404 };
  }
  if (invite.status !== "pending") {
    return { ok: false, error: "This invite is no longer valid.", status: 410 };
  }
  if (invite.expires_at && invite.expires_at < nowMs()) {
    await db.prepare("UPDATE workspace_invites SET status = 'expired' WHERE id = ?").bind(invite.id).run();
    return { ok: false, error: "This invite has expired.", status: 410 };
  }

  const inviter = await db
    .prepare(
      `SELECT role FROM workspace_members
       WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(invite.workspace_id, invite.invited_by)
    .first<{ role: string }>();
  const inviterRole = inviter ? normalizeWorkspaceRole(inviter.role) : null;
  if (!inviterRole || (inviterRole !== "owner" && inviterRole !== "admin")) {
    return { ok: false, error: "This invite is no longer valid.", status: 410 };
  }

  const user = await db
    .prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(acceptingUserId)
    .first<{ id: string; email: string }>();
  if (!user) return { ok: false, error: "Sign in required.", status: 401 };
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: `Sign in as ${invite.email} to accept this invite.`,
      status: 403,
    };
  }

  const existing = await db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(invite.workspace_id, acceptingUserId)
    .first<{ role: string }>();

  const seats = await countTeamSeats(db, invite.workspace_id);
  if (!existing) {
    const seatLimit = await assertWithinLimit(db, invite.workspace_id, "team_seats", seats);
    if (!seatLimit.ok) return { ok: false, error: seatLimit.error, status: seatLimit.status };
  }

  const incoming = invite.role === "admin" && inviterRole === "owner" ? "admin" : "member";
  const now = nowMs();
  if (!existing) {
    await db
      .prepare(
        `INSERT INTO workspace_members (workspace_id, user_id, role, created_at, status, invited_by, accepted_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      )
      .bind(invite.workspace_id, acceptingUserId, incoming, now, invite.invited_by, now)
      .run()
      .catch(async () => {
        await db
          .prepare(
            `INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(invite.workspace_id, acceptingUserId, incoming, now)
          .run();
      });
  } else {
    const keep = shouldKeepExistingMembershipRole(normalizeWorkspaceRole(existing.role), incoming);
    if (!keep) {
      // Never escalate or overwrite via accept when already a member.
    }
    await writeAuditLog(db, invite.workspace_id, acceptingUserId, "team.invite_accepted_existing", invite.id, {
      kept_role: existing.role,
    });
  }

  let mailboxIds = parseIdList(invite.mailbox_ids);
  const domainIds = parseIdList(invite.domain_ids);

  if (!mailboxIds.length && !domainIds.length) {
    const shared = await db
      .prepare("SELECT id FROM mailboxes WHERE user_id = ? AND is_shared = 1")
      .bind(invite.workspace_id)
      .all<{ id: string }>();
    mailboxIds = (shared.results ?? []).map((r) => r.id);
  }

  mailboxIds = await filterOwnedMailboxIds(db, invite.workspace_id, mailboxIds);
  const ownedDomains = await filterOwnedDomainIds(db, invite.workspace_id, domainIds);

  for (const mailboxId of mailboxIds) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO mailbox_members (mailbox_id, user_id, role, created_at)
         VALUES (?, ?, 'member', ?)`,
      )
      .bind(mailboxId, acceptingUserId, now)
      .run();
  }
  for (const domainId of ownedDomains) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO workspace_member_domains (workspace_id, user_id, domain_id, permission_level, created_at)
         VALUES (?, ?, ?, 'send', ?)`,
      )
      .bind(invite.workspace_id, acceptingUserId, domainId, now)
      .run()
      .catch(() => undefined);
  }

  await db
    .prepare(
      `UPDATE workspace_invites SET status = 'accepted', accepted_by = ?, accepted_at = ?, token = NULL WHERE id = ?`,
    )
    .bind(acceptingUserId, now, invite.id)
    .run();

  await writeAuditLog(db, invite.workspace_id, acceptingUserId, "team.invite_accepted", invite.id, {
    role: existing ? existing.role : incoming,
  });

  return { ok: true, workspace_id: invite.workspace_id };
}

export async function setMailboxShared(
  db: D1Database,
  ctx: WorkspaceCtx,
  mailboxId: string,
  isShared: boolean,
  opts?: { revokeMembers?: boolean },
): Promise<{ ok: true } | { ok: false; error: string; status: 402 | 403 | 404 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only owners and admins can mark shared mailboxes.", status: 403 };
  }
  const { limits } = await getEffectivePlan(db, ctx.workspaceId);
  if (isShared && limits.team_seats <= 1) {
    return { ok: false, error: "Shared mailboxes require a Team plan.", status: 402 };
  }
  const res = await db
    .prepare("UPDATE mailboxes SET is_shared = ? WHERE id = ? AND user_id = ?")
    .bind(isShared ? 1 : 0, mailboxId, ctx.workspaceId)
    .run();
  if (!res.meta.changes) return { ok: false, error: "Mailbox not found.", status: 404 };
  if (!isShared && opts?.revokeMembers) {
    await db
      .prepare(
        `DELETE FROM mailbox_members WHERE mailbox_id = ? AND user_id != ?`,
      )
      .bind(mailboxId, ctx.workspaceId)
      .run();
  }
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, isShared ? "mailbox.shared" : "mailbox.unshared", mailboxId, {
    revoke_members: !!opts?.revokeMembers,
  });
  return { ok: true };
}

export async function grantMailboxMember(
  db: D1Database,
  ctx: WorkspaceCtx,
  mailboxId: string,
  memberUserId: string,
  role: string = "member",
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 403 | 404 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only owners and admins can delegate mailboxes.", status: 403 };
  }
  const mailbox = await db
    .prepare("SELECT id FROM mailboxes WHERE id = ? AND user_id = ?")
    .bind(mailboxId, ctx.workspaceId)
    .first();
  if (!mailbox) return { ok: false, error: "Mailbox not found.", status: 404 };
  const member = await db
    .prepare(
      `SELECT user_id, role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(ctx.workspaceId, memberUserId)
    .first<{ user_id: string; role: string }>();
  if (!member) return { ok: false, error: "User is not a workspace member.", status: 400 };
  if (memberUserId === ctx.userId && ctx.role === "member") {
    return { ok: false, error: "You cannot grant yourself mailbox access.", status: 403 };
  }
  await db
    .prepare(
      `INSERT INTO mailbox_members (mailbox_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mailbox_id, user_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(mailboxId, memberUserId, role === "admin" ? "admin" : "member", nowMs())
    .run();
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "mailbox.grant", mailboxId, { member_user_id: memberUserId });
  return { ok: true };
}

export async function revokeMailboxMember(
  db: D1Database,
  ctx: WorkspaceCtx,
  mailboxId: string,
  memberUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 403 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only owners and admins can revoke mailbox access.", status: 403 };
  }
  await db
    .prepare("DELETE FROM mailbox_members WHERE mailbox_id = ? AND user_id = ?")
    .bind(mailboxId, memberUserId)
    .run();
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "mailbox.revoke", mailboxId, { member_user_id: memberUserId });
  return { ok: true };
}

export async function grantDomainMember(
  db: D1Database,
  ctx: WorkspaceCtx,
  domainId: string,
  memberUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 403 | 404 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only owners and admins can grant domain access.", status: 403 };
  }
  const domain = await db
    .prepare("SELECT id FROM domains WHERE id = ? AND user_id = ?")
    .bind(domainId, ctx.workspaceId)
    .first();
  if (!domain) return { ok: false, error: "Domain not found.", status: 404 };
  const member = await db
    .prepare(
      `SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(ctx.workspaceId, memberUserId)
    .first();
  if (!member) return { ok: false, error: "User is not a workspace member.", status: 400 };
  await db
    .prepare(
      `INSERT INTO workspace_member_domains (workspace_id, user_id, domain_id, permission_level, created_at)
       VALUES (?, ?, ?, 'send', ?)
       ON CONFLICT(workspace_id, user_id, domain_id) DO UPDATE SET permission_level = 'send'`,
    )
    .bind(ctx.workspaceId, memberUserId, domainId, nowMs())
    .run();
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "domain.grant", domainId, { member_user_id: memberUserId });
  return { ok: true };
}

export async function revokeDomainMember(
  db: D1Database,
  ctx: WorkspaceCtx,
  domainId: string,
  memberUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 403 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Only owners and admins can revoke domain access.", status: 403 };
  }
  await db
    .prepare(
      "DELETE FROM workspace_member_domains WHERE workspace_id = ? AND user_id = ? AND domain_id = ?",
    )
    .bind(ctx.workspaceId, memberUserId, domainId)
    .run();
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "domain.revoke", domainId, { member_user_id: memberUserId });
  return { ok: true };
}

export async function changeMemberRole(
  db: D1Database,
  ctx: WorkspaceCtx,
  memberUserId: string,
  nextRoleRaw: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 403 | 404 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }
  if (nextRoleRaw === "owner") {
    return { ok: false, error: "Cannot assign workspace ownership this way.", status: 400 };
  }
  const nextRole = inviteRoleFromInput(nextRoleRaw);
  if (nextRole === "admin" && ctx.role !== "owner") {
    return { ok: false, error: "Only the workspace owner can promote admins.", status: 403 };
  }
  if (memberUserId === ctx.userId) {
    return { ok: false, error: "You cannot change your own role.", status: 403 };
  }
  const target = await db
    .prepare(
      `SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(ctx.workspaceId, memberUserId)
    .first<{ role: string }>();
  if (!target) return { ok: false, error: "Member not found.", status: 404 };
  const targetRole = normalizeWorkspaceRole(target.role);
  if (!canActorManageTarget(ctx.role, targetRole)) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }
  await db
    .prepare("UPDATE workspace_members SET role = ? WHERE workspace_id = ? AND user_id = ?")
    .bind(nextRole, ctx.workspaceId, memberUserId)
    .run();
  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "team.role_changed", memberUserId, {
    from: targetRole,
    to: nextRole,
  });
  return { ok: true };
}

export async function removeWorkspaceMember(
  db: D1Database,
  ctx: WorkspaceCtx,
  memberId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 403 }> {
  if (!ctx.canManageTeam) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }
  if (memberId === ctx.workspaceId) {
    return { ok: false, error: "Cannot remove the workspace owner.", status: 400 };
  }
  const target = await db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(ctx.workspaceId, memberId)
    .first<{ role: string }>();
  if (target && !canActorManageTarget(ctx.role, normalizeWorkspaceRole(target.role))) {
    return { ok: false, error: "Forbidden.", status: 403 };
  }

  await db.batch([
    db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(ctx.workspaceId, memberId),
    db.prepare(
      `DELETE FROM mailbox_members WHERE user_id = ? AND mailbox_id IN
       (SELECT id FROM mailboxes WHERE user_id = ?)`,
    ).bind(memberId, ctx.workspaceId),
    db.prepare("DELETE FROM workspace_member_domains WHERE workspace_id = ? AND user_id = ?").bind(
      ctx.workspaceId,
      memberId,
    ),
    db.prepare("DELETE FROM thread_presence WHERE workspace_id = ? AND user_id = ?").bind(ctx.workspaceId, memberId),
    db
      .prepare(
        `UPDATE workspace_invites SET status = 'revoked', revoked_at = ?
         WHERE workspace_id = ? AND invited_by = ? AND status = 'pending'`,
      )
      .bind(nowMs(), ctx.workspaceId, memberId),
    db
      .prepare(
        `UPDATE messages SET folder = 'drafts', scheduled_at = NULL, snippet = ?
         WHERE user_id = ? AND folder = 'scheduled' AND scheduled_by_user_id = ?`,
      )
      .bind("Send cancelled: member removed.", ctx.workspaceId, memberId),
    db.prepare("DELETE FROM api_keys WHERE user_id = ? AND created_by_user_id = ?").bind(ctx.workspaceId, memberId),
  ]);

  await writeAuditLog(db, ctx.workspaceId, ctx.userId, "team.member_removed", memberId, {});
  return { ok: true };
}

export async function actorMayDispatchScheduled(
  db: D1Database,
  workspaceId: string,
  actorUserId: string | null | undefined,
  mailboxId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; reason: "removed_member" | "mailbox_revoked" }> {
  if (!actorUserId) return { ok: true };
  const ctx = await resolveWorkspace(db, actorUserId, workspaceId);
  if (ctx.workspaceId !== workspaceId) {
    return { ok: false, reason: "removed_member" };
  }
  const member = await db
    .prepare(
      `SELECT role FROM workspace_members
       WHERE workspace_id = ? AND user_id = ? AND COALESCE(status, 'active') = 'active'`,
    )
    .bind(workspaceId, actorUserId)
    .first();
  if (!member) return { ok: false, reason: "removed_member" };
  if (!mailboxId) return { ok: true };
  const access = await assertMailboxAccess(db, ctx, mailboxId);
  if (!access.ok) return { ok: false, reason: "mailbox_revoked" };
  return { ok: true };
}
