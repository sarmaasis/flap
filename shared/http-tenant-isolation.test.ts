/**
 * HTTP/API tenant isolation (IDOR) integration tests.
 * Run: npx tsx shared/http-tenant-isolation.test.ts
 */
import { createIdorFixture } from "./http-tenant-isolation-harness.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertDenied(status: number, body: string, label: string) {
  assert(status === 403 || status === 404, `${label}: expected 403/404, got ${status}`);
  assert(!/SECRET/i.test(body), `${label}: must not leak secret content`);
  assert(!/secret subject b/i.test(body), `${label}: must not leak tenant B subject`);
  assert(!/hello@b\.example\.com/i.test(body) || status >= 400, `${label}: avoid leaking B mailbox in success body`);
}

async function main() {
  const { app, tenantA, tenantB, env } = await createIdorFixture();
  const asA = { "x-flap-test-user-id": tenantA.userId };

  async function req(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(asA)) headers.set(k, v);
    if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
    const res = await app.request(path, { ...init, headers }, env);
    const text = await res.text();
    return { status: res.status, text, json: () => JSON.parse(text) as unknown };
  }

  // --- Positive control: A can read A ---
  {
    const res = await req(`/api/mail/${tenantA.messageId}`);
    assert(res.status === 200, "A reads own message");
    assert(/SECRET BODY/.test(res.text), "A sees own body");
  }

  // --- Messages / threads / drafts ---
  {
    const get = await req(`/api/mail/${tenantB.messageId}`);
    assertDenied(get.status, get.text, "GET foreign message");

    const thread = await req(`/api/mail/${tenantB.messageId}/thread`);
    assertDenied(thread.status, thread.text, "GET foreign thread");

    const draft = await req(`/api/mail/${tenantB.draftId}`);
    assertDenied(draft.status, draft.text, "GET foreign draft");

    const move = await req(`/api/mail/${tenantB.messageId}/move`, {
      method: "POST",
      body: JSON.stringify({ folder: "trash" }),
    });
    assertDenied(move.status, move.text, "POST move foreign message");

    const del = await req(`/api/mail/${tenantB.messageId}`, { method: "DELETE" });
    assertDenied(del.status, del.text, "DELETE foreign message");

    // Ensure B message still exists
    const still = await app.request(
      `/api/mail/${tenantB.messageId}`,
      { headers: { "x-flap-test-user-id": tenantB.userId } },
      env,
    );
    assert(still.status === 200, "B message intact after A attack");
  }

  // --- Attachments ---
  {
    const att = await req(`/api/mail/${tenantB.messageId}/attachments/${tenantB.attachmentId}`);
    assertDenied(att.status, att.text, "GET foreign attachment");
    assert(!/SECRET_B/.test(att.text), "attachment bytes not leaked");
  }

  // --- Mailboxes / domains ---
  {
    const mb = await req(`/api/mailboxes/${tenantB.mailboxId}`);
    assertDenied(mb.status, mb.text, "GET foreign mailbox");

    const dom = await req(`/api/domains/${tenantB.domainId}`);
    assertDenied(dom.status, dom.text, "GET foreign domain");
  }

  // --- Suppressions / delivery events ---
  {
    const sup = await req("/api/suppressions");
    assert(sup.status === 200, "A lists own suppressions");
    const body = JSON.parse(sup.text) as { suppressions: Array<{ email: string; user_id: string }> };
    assert(
      body.suppressions.every((s) => s.user_id === tenantA.userId),
      "suppressions only A's user_id",
    );
    assert(
      !body.suppressions.some((s) => s.email.includes("@b.example.com")),
      "no B suppressions in A's list",
    );

    const delSup = await req(`/api/suppressions/sup_b`, { method: "DELETE" });
    assertDenied(delSup.status, delSup.text, "DELETE foreign suppression");

    const events = await req("/api/delivery-events");
    assert(events.status === 200, "delivery events ok");
    const ev = JSON.parse(events.text) as { events: Array<{ id: string; user_id: string }> };
    assert(ev.events.every((e) => e.user_id === tenantA.userId), "delivery events workspace-scoped");
    assert(!ev.events.some((e) => e.id === tenantB.deliveryEventId), "no B delivery events");
  }

  // --- Quarantine / undo-send / open-track / RSVP ---
  {
    const q = await req("/api/quarantine");
    assert(q.status === 200, "quarantine list");
    assert(!/q_b/.test(q.text), "no B quarantine items");

    const undo = await req(`/api/mail/${tenantB.scheduledId}/undo-send`, { method: "POST", body: "{}" });
    assertDenied(undo.status, undo.text, "undo-send foreign");

    const track = await req(`/api/mail/${tenantB.messageId}/open-track`, {
      method: "POST",
      body: JSON.stringify({ enabled: true }),
    });
    assertDenied(track.status, track.text, "open-track foreign");

    const rsvp = await req("/api/calendar/rsvp", {
      method: "POST",
      body: JSON.stringify({ message_id: tenantB.messageId }),
    });
    assertDenied(rsvp.status, rsvp.text, "calendar RSVP foreign");
  }

  // --- Contacts / keys / webhooks / newsletters ---
  {
    const contacts = await req("/api/contacts");
    assert(contacts.status === 200, "contacts list");
    assert(!/friend@b\.example/.test(contacts.text), "no B contacts");

    const delCt = await req(`/api/contacts/${tenantB.contactId}`, { method: "DELETE" });
    assertDenied(delCt.status, delCt.text, "DELETE foreign contact");

    const keys = await req("/api/keys");
    assert(keys.status === 200, "keys list");
    assert(!/key_b/.test(keys.text), "no B api keys");

    const delKey = await req(`/api/keys/${tenantB.apiKeyId}`, { method: "DELETE" });
    assertDenied(delKey.status, delKey.text, "DELETE foreign api key");

    const hooks = await req("/api/webhooks");
    assert(hooks.status === 200, "webhooks list");
    assert(!/wh_b/.test(hooks.text), "no B webhooks");

    const delWh = await req(`/api/webhooks/${tenantB.webhookId}`, { method: "DELETE" });
    assertDenied(delWh.status, delWh.text, "DELETE foreign webhook");

    const nl = await req(`/api/newsletters/${tenantB.newsletterId}`);
    assertDenied(nl.status, nl.text, "GET foreign newsletter");
  }

  // --- Presence: A cannot subscribe to B's thread ---
  {
    const presence = await req(`/api/presence/${tenantB.threadId}`, { method: "POST", body: "{}" });
    assertDenied(presence.status, presence.text, "presence foreign thread");
  }

  // --- Send using B's mailbox/domain ---
  {
    const sendMb = await req("/api/mail/send-as-check", {
      method: "POST",
      body: JSON.stringify({ mailbox_id: tenantB.mailboxId }),
    });
    assertDenied(sendMb.status, sendMb.text, "send via foreign mailbox_id");

    const sendFrom = await req("/api/mail/send-as-check", {
      method: "POST",
      body: JSON.stringify({ from: tenantB.mailboxAddress }),
    });
    assert(sendFrom.status === 403, "send via foreign from address → 403");
  }

  console.log("shared/http-tenant-isolation checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
