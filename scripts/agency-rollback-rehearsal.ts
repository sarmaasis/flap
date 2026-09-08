/**
 * Local additive-schema rollback rehearsal (no remote D1).
 * Proves old membership queries still work after 0033-shaped columns exist,
 * and that dropping Worker code (ignoring new tables) does not break owners.
 *
 * Run: npx tsx scripts/agency-rollback-rehearsal.ts
 */
import { MemoryD1Database } from "../shared/d1-memory.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const db = new MemoryD1Database();
  db.exec(`
    CREATE TABLE workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE TABLE mailboxes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL
    );
    CREATE TABLE mailbox_members (
      mailbox_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (mailbox_id, user_id)
    );
  `);

  await db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES ('ws', 'owner', 'owner', 1)").run();
  await db.prepare("INSERT INTO mailboxes (id, user_id) VALUES ('mb', 'ws')").run();
  await db.prepare("INSERT INTO mailbox_members (mailbox_id, user_id) VALUES ('mb', 'mem')").run();

  // Simulate applying 0033 (additive).
  db.exec(`
    ALTER TABLE workspace_members ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
    CREATE TABLE workspace_member_domains (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'send',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, user_id, domain_id)
    );
  `);
  await db
    .prepare(
      "INSERT INTO workspace_member_domains (workspace_id, user_id, domain_id, permission_level, created_at) VALUES ('ws', 'mem', 'dom', 'send', 1)",
    )
    .run();

  const oldStyle = await db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?")
    .bind("ws", "owner")
    .first<{ role: string }>();
  assert(oldStyle?.role === "owner", "pre-0033 SELECT still works after additive columns");

  const newStyle = await db
    .prepare("SELECT role FROM workspace_members WHERE workspace_id = ? AND COALESCE(status, 'active') = 'active'")
    .bind("ws")
    .first();
  assert(!!newStyle, "new status filter works");

  const grant = await db.prepare("SELECT domain_id FROM workspace_member_domains WHERE workspace_id = 'ws'").first();
  assert(!!grant, "new grants table present");

  // Code rollback: ignore workspace_member_domains; membership still authoritative.
  const members = await db.prepare("SELECT COUNT(*) AS n FROM workspace_members").first<{ n: number }>();
  assert(Number(members?.n) === 1, "rollback of Worker code leaves membership intact");

  console.log("agency-rollback-rehearsal.ts ok");
}

await main();
