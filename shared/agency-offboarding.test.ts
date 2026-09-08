import { messageAuthzWhere } from "./security-guards.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { removeWorkspaceMember, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);
  const adminCtx = await resolveWorkspace(f.db as unknown as D1Database, f.adminA, f.wsA);

  await f.db
    .prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, scheduled_at, scheduled_by_user_id, created_at, date_ms)
       VALUES ('sched_a2', ?, ?, 'scheduled', 'support@client-b.com', 'out@example.com', 'Later', '', ?, ?, ?, ?)`,
    )
    .bind(f.wsA, f.mbClientB, f.now + 60_000, f.memberA2, f.now, f.now)
    .run();
  await f.db
    .prepare("INSERT INTO thread_presence (thread_key, workspace_id, user_id, display_name, last_seen_at) VALUES (?, ?, ?, 'A2', ?)")
    .bind(f.msgClientB, f.wsA, f.memberA2, f.now)
    .run();
  await f.db
    .prepare("INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at, created_by_user_id) VALUES ('key_a2', ?, 'rogue', 'hash_a2', 'flap_a2', ?, ?)")
    .bind(f.wsA, f.now, f.memberA2)
    .run();

  const adminRemoveAdmin = await removeWorkspaceMember(f.db as unknown as D1Database, adminCtx, f.adminA);
  assert(!adminRemoveAdmin.ok, "admin cannot remove self/admin via manage-target");

  const removed = await removeWorkspaceMember(f.db as unknown as D1Database, ownerCtx, f.memberA2);
  assert(removed.ok, "owner removes member");

  const after = await resolveWorkspace(f.db as unknown as D1Database, f.memberA2, f.wsA);
  assert(after.workspaceId !== f.wsA, "removed user cannot resolve agency workspace");
  const stillMember = await f.db
    .prepare("SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind(f.wsA, f.memberA2)
    .first();
  assert(!stillMember, "membership row deleted");

  const grant = await f.db
    .prepare("SELECT mailbox_id FROM mailbox_members WHERE user_id = ? AND mailbox_id = ?")
    .bind(f.memberA2, f.mbClientB)
    .first();
  assert(!grant, "mailbox grant deleted");

  const presence = await f.db
    .prepare("SELECT user_id FROM thread_presence WHERE workspace_id = ? AND user_id = ?")
    .bind(f.wsA, f.memberA2)
    .first();
  assert(!presence, "presence deleted");

  const key = await f.db.prepare("SELECT id FROM api_keys WHERE id = 'key_a2'").first();
  assert(!key, "member-created API key revoked");

  const sched = await f.db.prepare("SELECT folder FROM messages WHERE id = 'sched_a2'").first<{ folder: string }>();
  assert(sched?.folder === "drafts", "scheduled send cancelled");

  const authz = messageAuthzWhere(after.workspaceId, { mailboxIds: after.mailboxIds });
  const mail = await f.db
    .prepare(`SELECT id FROM messages WHERE id = ? AND ${authz.sql}`)
    .bind(f.msgClientB, ...authz.binds)
    .first();
  assert(!mail, "removed member cannot read agency mail under resolved workspace");

  const ownerStay = await removeWorkspaceMember(f.db as unknown as D1Database, ownerCtx, f.ownerA);
  assert(!ownerStay.ok, "cannot remove owner");

  const history = await f.db.prepare("SELECT id FROM messages WHERE id = ?").bind(f.msgClientB).first();
  assert(!!history, "history remains on workspace");

  console.log("agency-offboarding.test.ts ok");
}

await main();
