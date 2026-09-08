import { INVITE_HOURLY_CAP, createInvite, resolveWorkspace } from "../worker/lib/team.ts";
import { revokeClerkSessionsForFlapUser } from "../worker/lib/clerk.ts";
import { formatOperatorAlert, postWorkspaceOperatorAlert, slackOrDiscordBody } from "../worker/lib/workspace-notify.ts";
import { seedAgencyFixture } from "./agency-test-fixture.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const f = await seedAgencyFixture();
  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);

  await f.db.prepare("UPDATE users SET clerk_user_id = 'clerk_a2' WHERE id = ?").bind(f.memberA2).run();
  const revokedIds: string[] = [];
  const revoke = await revokeClerkSessionsForFlapUser(
    { CLERK_SECRET_KEY: "", CLERK_PUBLISHABLE_KEY: "" } as Env,
    f.db as unknown as D1Database,
    f.memberA2,
    {
      listActiveSessionIds: async (id) => {
        assert(id === "clerk_a2", "lists sessions for mapped Clerk user");
        return ["sess_1", "sess_2"];
      },
      revokeSession: async (id) => {
        revokedIds.push(id);
      },
    },
  );
  assert(revoke.revoked === 2 && revokedIds.join(",") === "sess_1,sess_2", "Clerk sessions revoked");

  const skip = await revokeClerkSessionsForFlapUser(
    { CLERK_SECRET_KEY: "", CLERK_PUBLISHABLE_KEY: "" } as Env,
    f.db as unknown as D1Database,
    f.memberA1,
  );
  assert(skip.skipped === "no_clerk_user", "no Clerk id skips revoke");

  await f.db
    .prepare(
      "INSERT INTO notify_channels (id, user_id, kind, webhook_url, muted, created_at) VALUES ('ntf_ops', ?, 'slack', 'https://hooks.slack.test/x', 0, ?)",
    )
    .bind(f.wsA, f.now)
    .run();
  const posted: string[] = [];
  const sent = await postWorkspaceOperatorAlert(
    f.db as unknown as D1Database,
    f.wsA,
    "member_removed",
    f.memberA2,
    async (url, body) => {
      posted.push(`${url} ${body}`);
    },
  );
  assert(sent === 1 && posted[0].includes("hooks.slack.test"), "ops alert uses notify_channels");
  assert(formatOperatorAlert("scheduled_denied", "msg").includes("scheduled_denied"), "alert text");
  const discord = slackOrDiscordBody("discord", "hi");
  assert(discord.body.includes("content"), "discord payload");

  const hourAgo = f.now - 30 * 60 * 1000;
  for (let i = 0; i < INVITE_HOURLY_CAP; i++) {
    await f.db
      .prepare(
        `INSERT INTO workspace_invites (id, invited_by, email, role, status, created_at, token, workspace_id, expires_at, mailbox_ids, domain_ids)
         VALUES (?, ?, ?, 'member', 'pending', ?, 'tok', ?, ?, '[]', '[]')`,
      )
      .bind(`inv_flood_${i}`, f.ownerA, `flood${i}@agency.test`, hourAgo, f.wsA, f.now + 86_400_000)
      .run();
  }
  const flood = await createInvite(f.db as unknown as D1Database, ownerCtx, { email: "one-more@agency.test" });
  assert(!flood.ok, "hourly invite cap blocks flood");

  console.log("agency-operator-alerts.test.ts ok");
}

await main();
