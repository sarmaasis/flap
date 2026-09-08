import { scheduledSendDeniedReason } from "./agency-authz.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { actorMayDispatchScheduled, removeWorkspaceMember, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);

  const allowed = await actorMayDispatchScheduled(f.db as unknown as D1Database, f.wsA, f.memberA2, f.mbClientB);
  assert(allowed.ok, "member with mailbox grant may dispatch");

  const deniedMb = await actorMayDispatchScheduled(f.db as unknown as D1Database, f.wsA, f.memberA2, f.mbClientA);
  assert(!deniedMb.ok && deniedMb.reason === "mailbox_revoked", "cannot send from ungranted mailbox");

  const deniedWs = await actorMayDispatchScheduled(f.db as unknown as D1Database, f.wsB, f.memberA2, f.mbForeign);
  assert(!deniedWs.ok, "cannot dispatch in foreign workspace");

  await removeWorkspaceMember(f.db as unknown as D1Database, ownerCtx, f.memberA2);
  const after = await actorMayDispatchScheduled(f.db as unknown as D1Database, f.wsA, f.memberA2, f.mbClientB);
  assert(!after.ok && after.reason === "removed_member", "removed member cannot dispatch scheduled");

  assert(
    scheduledSendDeniedReason({ actorStillMember: true, mailboxGranted: true, domainReady: false }) === "domain_not_ready",
    "domain readiness rechecked at dispatch",
  );

  console.log("agency-send-policy.test.ts ok");
}

await main();
