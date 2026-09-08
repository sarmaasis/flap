import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const member = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  const ownerB = await resolveWorkspace(f.db as unknown as D1Database, f.ownerB, f.wsB);

  assert(member.canManageSettings === false, "member cannot manage keys/webhooks");
  assert(ownerB.workspaceId === f.wsB, "B isolated");

  const foreignKey = await f.db
    .prepare("SELECT id FROM api_keys WHERE id = ? AND user_id = ?")
    .bind(f.keyA, ownerB.workspaceId)
    .first();
  assert(!foreignKey, "workspace B cannot see A key");

  const foreignHook = await f.db
    .prepare("SELECT id FROM webhooks WHERE id = ? AND user_id = ?")
    .bind(f.hookA, ownerB.workspaceId)
    .first();
  assert(!foreignHook, "workspace B cannot see A webhook");

  const wsKey = await f.db.prepare("SELECT user_id FROM api_keys WHERE id = ?").bind(f.keyA).first<{ user_id: string }>();
  assert(wsKey?.user_id === f.wsA, "key belongs to workspace owner id");

  const contactB = await f.db
    .prepare("SELECT id FROM contacts WHERE user_id = ? AND email = 'friend@client-a.com'")
    .bind(f.wsB)
    .first();
  assert(!contactB, "contacts are workspace-scoped");

  console.log("agency-api-key-webhook.test.ts ok");
}

await main();
