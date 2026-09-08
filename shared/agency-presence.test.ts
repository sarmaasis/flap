import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { assertMailboxAccess, removeWorkspaceMember, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const a1 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  const a2 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA2, f.wsA);
  const ownerB = await resolveWorkspace(f.db as unknown as D1Database, f.ownerB, f.wsB);
  const ownerA = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);

  assert(!(await assertMailboxAccess(f.db as unknown as D1Database, a1, f.mbClientB)).ok, "A1 cannot presence on ungranted mailbox");
  assert((await assertMailboxAccess(f.db as unknown as D1Database, a2, f.mbClientB)).ok, "A2 can presence on granted mailbox");
  assert(!(await assertMailboxAccess(f.db as unknown as D1Database, ownerB, f.mbClientB)).ok, "foreign owner denied");

  await f.db
    .prepare("INSERT INTO thread_presence (thread_key, workspace_id, user_id, display_name, last_seen_at) VALUES (?, ?, ?, 'A2', ?)")
    .bind(f.msgClientB, f.wsA, f.memberA2, f.now)
    .run();
  await removeWorkspaceMember(f.db as unknown as D1Database, ownerA, f.memberA2);
  const row = await f.db
    .prepare("SELECT user_id FROM thread_presence WHERE workspace_id = ? AND user_id = ?")
    .bind(f.wsA, f.memberA2)
    .first();
  assert(!row, "presence removed on offboard");

  console.log("agency-presence.test.ts ok");
}

await main();
