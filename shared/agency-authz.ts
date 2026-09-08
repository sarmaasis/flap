/**
 * Central agency authorization helpers (pure — safe for `tsx` tests).
 * Worker routes should go through these instead of ad hoc role strings.
 */

export type WorkspaceRole = "owner" | "admin" | "member";

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

export function normalizeWorkspaceRole(role: string): WorkspaceRole {
  if (role === "owner" || role === "admin") return role;
  return "member";
}

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Owner/admin manage team; only owner may change or remove admins; nobody targets owner. */
export function canActorManageTarget(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  if (target === "owner") return false;
  if (target === "admin") return actor === "owner";
  return actor === "owner" || actor === "admin";
}

export function inviteRoleFromInput(role?: string): "admin" | "member" {
  return role === "admin" ? "admin" : "member";
}

/** Accepting an invite must not overwrite a higher (or equal) existing role. */
export function shouldKeepExistingMembershipRole(
  existing: WorkspaceRole,
  incoming: WorkspaceRole,
): boolean {
  return ROLE_RANK[existing] >= ROLE_RANK[incoming];
}

export function mergeUniqueIds(...lists: Array<string[] | null | undefined>): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const id of list) {
      if (id) out.add(id);
    }
  }
  return [...out];
}

export async function hashInviteToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`flap-invite:${token}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ScheduledSendDeny =
  | "removed_member"
  | "mailbox_revoked"
  | "domain_not_ready"
  | null;

export function scheduledSendDeniedReason(opts: {
  actorStillMember: boolean;
  mailboxGranted: boolean;
  domainReady: boolean;
}): ScheduledSendDeny {
  if (!opts.actorStillMember) return "removed_member";
  if (!opts.mailboxGranted) return "mailbox_revoked";
  if (!opts.domainReady) return "domain_not_ready";
  return null;
}

export function memberCanAccessMailbox(
  mailboxIds: string[] | null,
  mailboxId: string,
): boolean {
  if (mailboxIds === null) return true;
  return mailboxIds.includes(mailboxId);
}

export function memberCanAccessDomain(
  domainIds: string[] | null,
  domainId: string,
): boolean {
  if (domainIds === null) return true;
  return domainIds.includes(domainId);
}
