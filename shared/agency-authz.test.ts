import {
  canActorManageTarget,
  hashInviteToken,
  inviteRoleFromInput,
  memberCanAccessMailbox,
  mergeUniqueIds,
  normalizeWorkspaceRole,
  scheduledSendDeniedReason,
  shouldKeepExistingMembershipRole,
} from "./agency-authz.ts";
import { messageAuthzWhere } from "./security-guards.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(normalizeWorkspaceRole("ADMIN" as string) === "member", "unknown roles collapse to member");
  assert(inviteRoleFromInput("owner") === "member", "cannot invite owner via input helper");
  assert(inviteRoleFromInput("admin") === "admin", "admin invite allowed in helper");
  assert(canActorManageTarget("admin", "owner") === false, "admin cannot target owner");
  assert(canActorManageTarget("admin", "admin") === false, "admin cannot manage admin");
  assert(canActorManageTarget("owner", "admin") === true, "owner can manage admin");
  assert(shouldKeepExistingMembershipRole("owner", "member") === true, "keep owner on accept");
  assert(shouldKeepExistingMembershipRole("member", "admin") === false, "do not auto-upgrade via accept helper");
  assert(mergeUniqueIds(["a"], ["a", "b"]).join(",") === "a,b", "merge unique");
  assert(memberCanAccessMailbox(null, "x") === true, "owner all mailboxes");
  assert(memberCanAccessMailbox(["mb"], "other") === false, "restricted deny");
  assert(scheduledSendDeniedReason({ actorStillMember: false, mailboxGranted: true, domainReady: true }) === "removed_member", "removed");
  assert(scheduledSendDeniedReason({ actorStillMember: true, mailboxGranted: false, domainReady: true }) === "mailbox_revoked", "revoke");
  const h1 = await hashInviteToken("itk_abc");
  const h2 = await hashInviteToken("itk_abc");
  const h3 = await hashInviteToken("itk_other");
  assert(h1 === h2 && h1 !== h3 && h1.length === 64, "invite hash stable");

  const f = await seedAgencyFixture();
  const a1 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  assert(a1.workspaceId === f.wsA, "A1 workspace");
  assert(a1.mailboxIds?.includes(f.mbClientA) === true, "A1 has client-a via domain grant");
  assert(a1.mailboxIds?.includes(f.mbClientB) === false, "A1 no client-b mailbox");
  assert(a1.domainIds?.includes(f.domainClientA) === true, "A1 domain grant");

  const a2 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA2, f.wsA);
  assert(a2.mailboxIds?.includes(f.mbClientB) === true, "A2 mailbox grant");
  assert(a2.mailboxIds?.includes(f.mbClientA) === false, "A2 no client-a");

  const foreign = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsB);
  assert(foreign.workspaceId !== f.wsB, "cannot select foreign workspace via preferred id");

  const authz = messageAuthzWhere(f.wsA, { mailboxIds: a1.mailboxIds });
  const row = await f.db
    .prepare(`SELECT subject FROM messages WHERE id = ? AND ${authz.sql}`)
    .bind(f.msgClientB, ...authz.binds)
    .first();
  assert(!row, "A1 cannot read client-b message via authz SQL");

  const ok = await f.db
    .prepare(`SELECT subject FROM messages WHERE id = ? AND ${authz.sql}`)
    .bind(f.msgClientA, ...authz.binds)
    .first<{ subject: string }>();
  assert(ok?.subject === "Secret A1", "A1 reads granted message");

  console.log("agency-authz.test.ts ok");
}

await main();
