import { messageAuthzWhere } from "./security-guards.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import {
  grantDomainMember,
  grantMailboxMember,
  resolveWorkspace,
  revokeDomainMember,
  revokeMailboxMember,
} from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function visible(db: AgencyDb, workspaceId: string, mailboxIds: string[] | null, messageId: string) {
  const authz = messageAuthzWhere(workspaceId, { mailboxIds });
  return db.prepare(`SELECT id FROM messages WHERE id = ? AND ${authz.sql}`).bind(messageId, ...authz.binds).first();
}

type AgencyDb = Awaited<ReturnType<typeof seedAgencyFixture>>["db"];

async function main() {
  const f = await seedAgencyFixture();
  const a1 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  const a2 = await resolveWorkspace(f.db as unknown as D1Database, f.memberA2, f.wsA);
  const owner = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);
  const ownerB = await resolveWorkspace(f.db as unknown as D1Database, f.ownerB, f.wsB);

  assert(await visible(f.db, a1.workspaceId, a1.mailboxIds, f.msgClientA), "A1 sees granted domain mail");
  assert(!(await visible(f.db, a1.workspaceId, a1.mailboxIds, f.msgClientB)), "A1 denied other domain mailbox");
  assert(!(await visible(f.db, a1.workspaceId, a1.mailboxIds, f.msgForeign)), "A1 denied foreign workspace");
  assert(await visible(f.db, a2.workspaceId, a2.mailboxIds, f.msgClientB), "A2 sees mailbox grant");
  assert(!(await visible(f.db, a2.workspaceId, a2.mailboxIds, f.msgClientA)), "A2 denied other mailbox same workspace");
  assert(await visible(f.db, owner.workspaceId, owner.mailboxIds, f.msgClientA), "owner sees all A");
  assert(await visible(f.db, owner.workspaceId, owner.mailboxIds, f.msgClientB), "owner sees client-b");
  assert(!(await visible(f.db, owner.workspaceId, owner.mailboxIds, f.msgForeign)), "owner A denied B");
  assert(await visible(f.db, ownerB.workspaceId, ownerB.mailboxIds, f.msgForeign), "owner B sees B");

  const att = await f.db
    .prepare(
      `SELECT a.id FROM attachments a JOIN messages m ON m.id = a.message_id WHERE a.id = ? AND m.user_id = ?`,
    )
    .bind(f.attClientB, a1.workspaceId)
    .first();
  const attOk = att && a1.mailboxIds?.includes(f.mbClientB);
  assert(!attOk, "A1 cannot treat client-b attachment as granted");

  const selfGrant = await grantMailboxMember(f.db as unknown as D1Database, a1, f.mbClientB, f.memberA1);
  assert(!selfGrant.ok, "member cannot grant self another mailbox");

  const ownerGrant = await grantMailboxMember(f.db as unknown as D1Database, owner, f.mbClientB, f.memberA1);
  assert(ownerGrant.ok, "owner can grant");
  const a1b = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  assert(await visible(f.db, a1b.workspaceId, a1b.mailboxIds, f.msgClientB), "after grant A1 sees B mailbox");
  await revokeMailboxMember(f.db as unknown as D1Database, owner, f.mbClientB, f.memberA1);
  const a1c = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  assert(!(await visible(f.db, a1c.workspaceId, a1c.mailboxIds, f.msgClientB)), "after revoke denied");

  const selfDomain = await grantDomainMember(f.db as unknown as D1Database, a1, f.domainClientB, f.memberA1);
  assert(!selfDomain.ok, "member cannot grant self a domain");
  const ownerDomain = await grantDomainMember(f.db as unknown as D1Database, owner, f.domainClientB, f.memberA1);
  assert(ownerDomain.ok, "owner grants domain");
  const a1d = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  assert(await visible(f.db, a1d.workspaceId, a1d.mailboxIds, f.msgClientB), "domain grant expands mailbox access");
  await revokeDomainMember(f.db as unknown as D1Database, owner, f.domainClientB, f.memberA1);
  const a1e = await resolveWorkspace(f.db as unknown as D1Database, f.memberA1, f.wsA);
  assert(!(await visible(f.db, a1e.workspaceId, a1e.mailboxIds, f.msgClientB)), "domain revoke removes access");

  console.log("agency-mailbox-permissions.test.ts ok");
}

await main();
