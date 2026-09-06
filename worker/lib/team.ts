import { assertWithinLimit, getEffectivePlan } from "./billing";
import { randomId, nowMs } from "./ids";
import { EMAIL_RE, extractEmail } from "./mailutil";

export type WorkspaceRole = "owner" | "admin" | "member";

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
};

export async function ensureOwnerMembership(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at)
       VALUES (?, ?, 'owner', ?)`,
    )
    .bind(userId, userId, nowMs())
    .run();
}

export async function resolveWorkspace(
  db: D1Database,
  userId: string,
  preferredWorkspaceId?: string | null,
): Promise<WorkspaceCtx> {
  const memberships = await db
    .prepare(
      `SELECT workspace_id, role FROM workspace_members WHERE user_id = ? ORDER BY
         CASE WHEN workspace_id = user_id THEN 0 ELSE 1 END, created_at ASC`,
    )
    .bind(userId)
    .all<{ workspace_id: string; role: string }>();

  let rows = memberships.results ?? [];
  // Avoid INSERT OR IGNORE on every request — only provision self-membership when missing.
  if (!rows.some((r) => r.workspace_id === userId)) {
    await ensureOwnerMembership(db, userId);
    const again = await db
      .prepare(
        `SELECT workspace_id, role FROM workspace_members WHERE user_id = ? ORDER BY
           CASE WHEN workspace_id = user_id THEN 0 ELSE 1 END, created_at ASC`,
      )
      .bind(userId)
      .all<{ workspace_id: string; role: string }>();
    rows = again.results ?? [];
  }

  let pick = rows.find((r) => r.workspace_id === preferredWorkspaceId) ?? rows[0];
  if (!pick) {
    pick = { workspace_id: userId, role: "owner" };
  }

  const role = normalizeRole(pick.role);
  const isOwner = pick.workspace_id === userId && role === "owner";
  const canManageTeam = role === "owner" || role === "admin";
  const canManageSettings = role === "owner" || role === "admin";

  let mailboxIds: string[] | null = null;
  if (!isOwner && role !== "admin") {
    const granted = await db
      .prepare("SELECT mailbox_id FROM mailbox_members WHERE user_id = ?")
      .bind(userId)
      .all<{ mailbox_id: string }>();
    mailboxIds = (granted.results ?? []).map((r) => r.mailbox_id);
  } else if (!isOwner && role === "admin") {
    // Admins see all workspace mailboxes
    mailboxIds = null;
  }

  return {
    userId,
    workspaceId: pick.workspace_id,
    role,
    isOwner,
    canManageTeam,
    canManageSettings,
    mailboxIds,
  };
}

function normalizeRole(role: string): WorkspaceRole {
  if (role === "owner" || role === "admin") return role;
  return "member";
}

/** SQL fragment helpers for message queries scoped to accessible mailboxes */
export function mailboxAccessClause(
  ctx: WorkspaceCtx,
  column = "mailbox_id",
): { sql: string; binds: unknown[] } {
  if (ctx.mailboxIds === null) {
    return { sql: "", binds: [] };
  }
  if (ctx.mailboxIds.length === 0) {
    return { sql: ` AND 1 = 0`, binds: [] };
  }
  const placeholders = ctx.mailboxIds.map(() => "?").join(", ");
  return { sql: ` AND ${column} IN (${placeholders})`, binds: [...ctx.mailboxIds] };
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
              mm.role AS access_role
       FROM mailboxes m
       JOIN domains d ON d.id = m.domain_id
       JOIN mailbox_members mm ON mm.mailbox_id = m.id AND mm.user_id = ?
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

export async function countTeamSeats(db: D1Database, workspaceId: string): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ?")
    .bind(workspaceId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function createInvite(
  db: D1Database,
  ctx: WorkspaceCtx,
  input: { email: string; role?: string; mailbox_ids?: string[] },
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

  const role = input.role === "admin" ? "admin" : "member";
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

  let mailboxIds = Array.isArray(input.mailbox_ids) ? input.mailbox_ids.filter(Boolean) : [];
  if (mailboxIds.length) {
    const placeholders = mailboxIds.map(() => "?").join(", ");
    const owned = await db
      .prepare(
        `SELECT id FROM mailboxes WHERE user_id = ? AND id IN (${placeholders})`,
      )
      .bind(ctx.workspaceId, ...mailboxIds)
      .all<{ id: string }>();
    const ok = new Set((owned.results ?? []).map((r) => r.id));
    mailboxIds = mailboxIds.filter((id) => ok.has(id));
  }

  const id = randomId("inv");
  const token = randomId("itk");
  const expires = nowMs() + 14 * 24 * 60 * 60 * 1000;
  await db
    .prepare(
      `INSERT INTO workspace_invites
       (id, invited_by, email, role, status, created_at, token, workspace_id, expires_at, mailbox_ids)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
    .bind(id, ctx.userId, email, role, nowMs(), token, ctx.workspaceId, expires, JSON.stringify(mailboxIds))
    .run();

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

export async function acceptInvite(
  db: D1Database,
  token: string,
  acceptingUserId: string,
): Promise<{ ok: true; workspace_id: string } | { ok: false; error: string; status: 401 | 403 | 404 | 410 | 402 }> {
  const invite = await db
    .prepare(
      `SELECT id, email, role, status, workspace_id, expires_at, mailbox_ids, invited_by
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
      invited_by: string;
    }>();

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

  const seats = await countTeamSeats(db, invite.workspace_id);
  const seatLimit = await assertWithinLimit(db, invite.workspace_id, "team_seats", seats);
  if (!seatLimit.ok) return { ok: false, error: seatLimit.error, status: seatLimit.status };

  const role = invite.role === "admin" ? "admin" : "member";
  const now = nowMs();
  await db
    .prepare(
      `INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(invite.workspace_id, acceptingUserId, role, now)
    .run();

  let mailboxIds: string[] = [];
  try {
    mailboxIds = JSON.parse(invite.mailbox_ids || "[]") as string[];
  } catch {
    mailboxIds = [];
  }

  if (!mailboxIds.length) {
    // Default: grant all shared mailboxes in the workspace
    const shared = await db
      .prepare("SELECT id FROM mailboxes WHERE user_id = ? AND is_shared = 1")
      .bind(invite.workspace_id)
      .all<{ id: string }>();
    mailboxIds = (shared.results ?? []).map((r) => r.id);
  }

  for (const mailboxId of mailboxIds) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO mailbox_members (mailbox_id, user_id, role, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(mailboxId, acceptingUserId, role === "admin" ? "admin" : "member", now)
      .run();
  }

  await db
    .prepare(
      `UPDATE workspace_invites SET status = 'accepted', accepted_by = ?, accepted_at = ? WHERE id = ?`,
    )
    .bind(acceptingUserId, now, invite.id)
    .run();

  return { ok: true, workspace_id: invite.workspace_id };
}

export async function setMailboxShared(
  db: D1Database,
  ctx: WorkspaceCtx,
  mailboxId: string,
  isShared: boolean,
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
    .prepare("SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(ctx.workspaceId, memberUserId)
    .first();
  if (!member) return { ok: false, error: "User is not a workspace member.", status: 400 };
  await db
    .prepare(
      `INSERT INTO mailbox_members (mailbox_id, user_id, role, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(mailbox_id, user_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(mailboxId, memberUserId, role === "admin" ? "admin" : "member", nowMs())
    .run();
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
  return { ok: true };
}
