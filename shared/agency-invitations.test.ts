import { hashInviteToken } from "./agency-authz.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { acceptInvite, createInvite, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);

  const created = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "joiner@agency.test",
    role: "member",
    mailbox_ids: [f.mbClientA],
  });
  assert(created.ok, "owner creates invite");
  if (!created.ok) return;
  const hash = await hashInviteToken(created.invite.token);
  const stored = await f.db
    .prepare("SELECT token_hash, role FROM workspace_invites WHERE id = ?")
    .bind(created.invite.id)
    .first<{ token_hash: string; role: string }>();
  assert(stored?.token_hash === hash, "token stored hashed");
  assert(stored?.role === "member", "role not owner");

  const wrongEmail = await acceptInvite(f.db as unknown as D1Database, created.invite.token, f.memberA1);
  assert(!wrongEmail.ok && wrongEmail.status === 403, "wrong email denied");

  await f.db.prepare("INSERT INTO users (id, email, created_at) VALUES ('user_joiner', 'joiner@agency.test', ?)").bind(f.now).run();
  const ok = await acceptInvite(f.db as unknown as D1Database, created.invite.token, "user_joiner");
  assert(ok.ok, "matching email accepts");

  const reuse = await acceptInvite(f.db as unknown as D1Database, created.invite.token, "user_joiner");
  assert(!reuse.ok && reuse.status === 410, "reuse denied");

  const expired = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "late@agency.test",
    role: "member",
  });
  assert(expired.ok, "second invite");
  if (expired.ok) {
    await f.db.prepare("UPDATE workspace_invites SET expires_at = 1 WHERE id = ?").bind(expired.invite.id).run();
    await f.db.prepare("INSERT INTO users (id, email, created_at) VALUES ('user_late', 'late@agency.test', ?)").bind(f.now).run();
    const late = await acceptInvite(f.db as unknown as D1Database, expired.invite.token, "user_late");
    assert(!late.ok && late.status === 410, "expired denied");
  }

  const revoked = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "revoked@agency.test",
    role: "member",
  });
  assert(revoked.ok, "revoked invite created");
  if (revoked.ok) {
    await f.db.prepare("UPDATE workspace_invites SET status = 'revoked' WHERE id = ?").bind(revoked.invite.id).run();
    await f.db.prepare("INSERT INTO users (id, email, created_at) VALUES ('user_rev', 'revoked@agency.test', ?)").bind(f.now).run();
    const r = await acceptInvite(f.db as unknown as D1Database, revoked.invite.token, "user_rev");
    assert(!r.ok && r.status === 410, "revoked denied");
  }

  const already = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "a1@agency.test",
    role: "admin",
  });
  assert(!already.ok, "cannot invite existing member");

  const lost = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "after-admin-gone@agency.test",
    role: "member",
  });
  assert(lost.ok, "invite by owner");
  if (lost.ok) {
    await f.db.prepare("UPDATE workspace_invites SET invited_by = ? WHERE id = ?").bind(f.adminA, lost.invite.id).run();
    await f.db.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(f.wsA, f.adminA).run();
    await f.db.prepare("INSERT INTO users (id, email, created_at) VALUES ('user_lost', 'after-admin-gone@agency.test', ?)").bind(f.now).run();
    const gone = await acceptInvite(f.db as unknown as D1Database, lost.invite.token, "user_lost");
    assert(!gone.ok && gone.status === 410, "accept denied after inviter lost permission");
  }

  const ownerInvite = await createInvite(f.db as unknown as D1Database, ownerCtx, {
    email: "owner-a@agency.test",
    role: "member",
  });
  assert(!ownerInvite.ok, "cannot invite existing owner email");

  console.log("agency-invitations.test.ts ok");
}

await main();
