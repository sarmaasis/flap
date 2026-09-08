/**
 * Agency cases on the HTTP harness (production resolveWorkspace + mailbox/domain grants).
 */
import { seedAgencyFixture } from "./agency-test-fixture.ts";
import { createIdorTestApp, createTestAttachmentsBucket } from "./http-tenant-isolation-harness.ts";
import { removeWorkspaceMember, resolveWorkspace } from "../worker/lib/team.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertDenied(status: number, body: string, label: string) {
  assert(status === 403 || status === 404, `${label}: expected 403/404, got ${status}`);
  assert(!/SECRET A2/i.test(body), `${label}: must not leak client-b`);
  assert(!/SECRET B/i.test(body), `${label}: must not leak workspace B`);
}

async function main() {
  const f = await seedAgencyFixture();
  const app = createIdorTestApp();
  const env = {
    DB: f.db,
    ATTACHMENTS: createTestAttachmentsBucket(new Map([["r2/b", new TextEncoder().encode("SECRET_B_BYTES")]])),
  };

  async function as(userId: string, path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("x-flap-test-user-id", userId);
    headers.set("x-flap-workspace", f.wsA);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const res = await app.request(path, { ...init, headers }, env);
    const text = await res.text();
    return { status: res.status, text };
  }

  const a1ok = await as(f.memberA1, `/api/mail/${f.msgClientA}`);
  assert(a1ok.status === 200 && /SECRET A1/.test(a1ok.text), "A1 reads granted domain mail");

  const a1deny = await as(f.memberA1, `/api/mail/${f.msgClientB}`);
  assertDenied(a1deny.status, a1deny.text, "A1 ungranted mailbox");

  const a1att = await as(f.memberA1, `/api/mail/${f.msgClientB}/attachments/${f.attClientB}`);
  assertDenied(a1att.status, a1att.text, "A1 ungranted attachment");
  assert(!/SECRET_B_BYTES/.test(a1att.text), "no attachment bytes");

  const a1mb = await as(f.memberA1, `/api/mailboxes/${f.mbClientB}`);
  assertDenied(a1mb.status, a1mb.text, "A1 ungranted mailbox GET");

  const a1pres = await as(f.memberA1, `/api/presence/${f.msgClientB}`, { method: "POST", body: "{}" });
  assertDenied(a1pres.status, a1pres.text, "A1 presence ungranted");

  const a1send = await as(f.memberA1, "/api/mail/send-as-check", {
    method: "POST",
    body: JSON.stringify({ mailbox_id: f.mbClientB }),
  });
  assertDenied(a1send.status, a1send.text, "A1 send ungranted");

  const ev = await as(f.memberA1, "/api/delivery-events");
  assert(ev.status === 200, "A1 delivery list");
  assert(/del_a/.test(ev.text), "A1 sees granted-domain delivery");
  assert(!/del_bdom/.test(ev.text), "A1 does not see other-domain delivery");

  const exp = await as(f.memberA1, "/api/export");
  assert(exp.status === 200, "A1 export");
  assert(/SECRET A1/.test(exp.text), "export includes granted mail");
  assert(!/SECRET A2/.test(exp.text), "export omits ungranted mail");
  assert(!/SECRET B/.test(exp.text), "export omits foreign workspace");

  const foreign = await as(f.ownerB, `/api/mail/${f.msgClientA}`);
  assertDenied(foreign.status, foreign.text, "owner B cannot read A even with flap_ws header");

  const ownerCtx = await resolveWorkspace(f.db as unknown as D1Database, f.ownerA, f.wsA);
  await removeWorkspaceMember(f.db as unknown as D1Database, ownerCtx, f.memberA2);
  const gone = await as(f.memberA2, `/api/mail/${f.msgClientB}`);
  assertDenied(gone.status, gone.text, "removed member mail");
  const goneExp = await as(f.memberA2, "/api/export");
  assert(!/SECRET A2/.test(goneExp.text), "removed member export empty of agency mail");

  console.log("agency-http-isolation.test.ts ok");
}

await main();
