import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { changeMemberRole, createInvite, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const memberCtx = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  const adminCtx = await resolveWorkspace(f.db as unknown as D1Database, f.adminA, f.wsA);
  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);

  const selfAdmin = await changeMemberRole(f.db as unknown as D1Database, memberCtx, f.memberA1, "admin");
  assert(!selfAdmin.ok && selfAdmin.status === 403, "member cannot change own role");

  const inviteOwner = await createInvite(f.db as unknown as D1Database, memberCtx, {
    email: "new@agency.test",
    role: "owner",
  });
  assert(!inviteOwner.ok && inviteOwner.status === 403, "member cannot invite");

  const adminInviteOwner = await createInvite(f.db as unknown as D1Database, adminCtx, {
    email: "new-owner@agency.test",
    role: "owner",
  });
  assert(!adminInviteOwner.ok, "cannot invite owner role");

  const adminInviteAdmin = await createInvite(f.db as unknown as D1Database, adminCtx, {
    email: "peer-admin@agency.test",
    role: "admin",
  });
  assert(!adminInviteAdmin.ok && adminInviteAdmin.status === 403, "admin cannot invite admin");

  const promote = await changeMemberRole(f.db as unknown as D1Database, memberCtx, f.memberA2, "admin");
  assert(!promote.ok, "member cannot promote peer");

  const adminPromote = await changeMemberRole(f.db as unknown as D1Database, adminCtx, f.memberA2, "admin");
  assert(!adminPromote.ok && adminPromote.status === 403, "admin cannot promote to admin");

  const ownerDemoteOwner = await changeMemberRole(f.db as unknown as D1Database, ownerCtx, f.ownerA, "member");
  assert(!ownerDemoteOwner.ok, "cannot change own role even as owner");

  const ownerOk = await changeMemberRole(f.db as unknown as D1Database, ownerCtx, f.memberA2, "admin");
  assert(ownerOk.ok, "owner can promote member to admin");

  console.log("agency-role-escalation.test.ts ok");
}

await main();
