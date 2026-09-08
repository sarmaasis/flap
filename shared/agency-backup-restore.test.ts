import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { buildJsonExport, restoreWorkspaceBackup } from "../worker/lib/workspace-backup.ts";
import { resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const a1 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  const ownerB = await resolveWorkspace(f.db as unknown as D1Database, f.ownerB, f.wsB);

  const expA1 = await buildJsonExport(
    f.db as unknown as D1Database,
    { userId: a1.userId, workspaceId: a1.workspaceId, mailboxIds: a1.mailboxIds },
    "a1@agency.test",
  );
  const messages = expA1.messages as Array<{ id: string; subject: string }>;
  assert(messages.some((m) => m.id === f.msgClientA), "A1 export includes granted message");
  assert(!messages.some((m) => m.id === f.msgClientB), "A1 export excludes ungranted");
  assert(!messages.some((m) => m.id === f.msgForeign), "A1 export excludes foreign");
  assert(expA1.workspace_id === f.wsA, "export records workspace");

  const contactsA = expA1.contacts as Array<{ email: string }>;
  assert(contactsA.some((c) => c.email === "friend@client-a.com"), "workspace contacts in export");

  const restored = await restoreWorkspaceBackup(
    f.db as unknown as D1Database,
    { userId: ownerB.userId, workspaceId: ownerB.workspaceId, mailboxIds: ownerB.mailboxIds },
    { contacts: [{ email: "friend@client-a.com", name: "Copied" }], templates: [{ name: "T", subject: "Hi", html_body: "", text_body: "" }] },
  );
  assert(restored === 2, "restore counts contacts + personal template");

  const stillOnA = await f.db
    .prepare("SELECT email FROM contacts WHERE user_id = ? AND email = ?")
    .bind(f.wsA, "friend@client-a.com")
    .first();
  assert(!!stillOnA, "restore into B does not delete A contact");

  const onB = await f.db
    .prepare("SELECT email FROM contacts WHERE user_id = ? AND email = ?")
    .bind(f.wsB, "friend@client-a.com")
    .first();
  assert(!!onB, "B received restored contact on B workspace");

  const tplB = await f.db.prepare("SELECT user_id FROM templates WHERE name = 'T'").first<{ user_id: string }>();
  assert(tplB?.user_id === f.ownerB, "template restore stays personal to actor");

  const members = await f.db.prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ?").bind(f.wsA).first<{ n: number }>();
  assert(Number(members?.n) >= 4, "restore does not rewrite membership");

  console.log("agency-backup-restore.test.ts ok");
}

await main();
