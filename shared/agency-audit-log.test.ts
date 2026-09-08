import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { createInvite, grantMailboxMember, removeWorkspaceMember, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const owner = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);
  const member = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);

  await createInvite(f.db as unknown as D1Database, owner, { email: "audit@agency.test", role: "member" });
  await grantMailboxMember(f.db as unknown as D1Database, owner, f.mbAgency, f.memberA1);
  await removeWorkspaceMember(f.db as unknown as D1Database, owner, f.memberA1);

  const rows = await f.db
    .prepare("SELECT action, meta_json FROM audit_log WHERE user_id = ?")
    .bind(f.wsA)
    .all<{ action: string; meta_json: string }>();
  const actions = new Set((rows.results ?? []).map((r) => r.action));
  assert(actions.has("team.invite_created"), "invite audited");
  assert(actions.has("mailbox.grant"), "grant audited");
  assert(actions.has("team.member_removed"), "remove audited");
  assert((rows.results ?? []).every((r) => !/SECRET/i.test(r.meta_json)), "no message body in audit");

  assert(member.canManageTeam === false, "members cannot read audit in product (role gate)");

  const leak = await f.db.prepare("SELECT id FROM audit_log WHERE user_id = ?").bind(f.wsB).first();
  assert(!leak, "no audit rows on foreign workspace");

  console.log("agency-audit-log.test.ts ok");
}

await main();
