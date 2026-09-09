import { buildIcs, icsToBase64DataUrl, type IcsAttendee, type IcsEvent, type IcsMethod } from "../../shared/ics";
import { nowMs, randomId } from "./ids";
import { canSendMail, sendRawEmail } from "./mail-provider";
import { buildRawMime } from "./mime";
import { extractEmail, makeSnippet, parseRecipients, sha256Hex } from "./mailutil";
import { assertSendRoom, assertStorageRoom, messageStorageBytes, recordOutboundSend } from "./billing";
import { markFirstEmailSent } from "./activation";
import { workspaceSendDenied } from "./workspace-send";

export async function bumpCalendarSync(db: D1Database, userId: string): Promise<void> {
  const now = nowMs();
  const token = `sync-${now}-${Math.random().toString(36).slice(2, 10)}`;
  const ctag = `ctag-${now}`;
  await db
    .prepare(
      `INSERT INTO calendar_sync (user_id, sync_token, ctag, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET sync_token = excluded.sync_token, ctag = excluded.ctag, updated_at = excluded.updated_at`,
    )
    .bind(userId, token, ctag, now)
    .run();
}

export async function hashCalendarToken(raw: string): Promise<string> {
  return sha256Hex(raw);
}

export function newCalendarTokenSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `flapcal_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

type MailboxRow = { id: string; address: string; display_name?: string | null };

export async function resolveOrganizerMailbox(
  db: D1Database,
  workspaceId: string,
  mailboxId?: string,
): Promise<MailboxRow | null> {
  if (mailboxId) {
    const row = await db
      .prepare("SELECT id, address, display_name FROM mailboxes WHERE id = ? AND user_id = ?")
      .bind(mailboxId, workspaceId)
      .first<MailboxRow>();
    if (row) return row;
  }
  return db
    .prepare("SELECT id, address, display_name FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
    .bind(workspaceId)
    .first<MailboxRow>();
}

export async function replaceAttendees(
  db: D1Database,
  eventId: string,
  attendees: IcsAttendee[],
): Promise<void> {
  const now = nowMs();
  await db.prepare("DELETE FROM calendar_attendees WHERE event_id = ?").bind(eventId).run();
  for (const a of attendees) {
    const email = a.email.trim().toLowerCase();
    if (!email || !email.includes("@")) continue;
    await db
      .prepare(
        `INSERT INTO calendar_attendees (id, event_id, email, display_name, role, partstat, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        randomId("catt"),
        eventId,
        email,
        (a.displayName || "").slice(0, 120),
        a.role || "REQ-PARTICIPANT",
        a.partstat || "NEEDS-ACTION",
        now,
        now,
      )
      .run();
  }
}

export async function listAttendees(db: D1Database, eventId: string): Promise<IcsAttendee[]> {
  const rows = await db
    .prepare(
      "SELECT email, display_name, role, partstat FROM calendar_attendees WHERE event_id = ? ORDER BY email ASC",
    )
    .bind(eventId)
    .all<{ email: string; display_name: string; role: string; partstat: string }>();
  return (rows.results || []).map((r) => ({
    email: r.email,
    displayName: r.display_name || undefined,
    role: r.role,
    partstat: r.partstat as IcsAttendee["partstat"],
  }));
}

async function putAttachment(
  env: Env,
  messageId: string,
  filename: string,
  contentType: string,
  content: Uint8Array,
  now: number,
): Promise<void> {
  if (!env.ATTACHMENTS) return;
  const id = randomId("att");
  const key = `attachments/${messageId}/${id}/${filename}`;
  await env.ATTACHMENTS.put(key, content, { httpMetadata: { contentType } });
  await env.DB.prepare(
    "INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(id, messageId, key, filename, contentType, content.byteLength, now)
    .run();
}

/** Send METHOD:REQUEST / REPLY / CANCEL with .ics attachment immediately (no undo delay). */
export async function sendCalendarMail(
  env: Env,
  opts: {
    workspaceId: string;
    mailbox: MailboxRow;
    to: string[];
    subject: string;
    text: string;
    ics: string;
    filename?: string;
    contentType?: string;
    inReplyTo?: string | null;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  if (!canSendMail(env)) {
    return { ok: false, error: "Mail sending is not configured.", status: 501 };
  }
  const denied = await workspaceSendDenied(env.DB, opts.workspaceId);
  if (denied) return { ok: false, error: denied, status: 403 };
  const recipients = [...new Set(opts.to.flatMap((t) => parseRecipients(t)).map((e) => e.toLowerCase()))];
  if (!recipients.length) return { ok: false, error: "No valid invite recipients.", status: 400 };

  const sendLimit = await assertSendRoom(env.DB, opts.workspaceId);
  if (!sendLimit.ok) return { ok: false, error: sendLimit.error, status: sendLimit.status };

  const now = nowMs();
  const fromHeader = opts.mailbox.display_name
    ? `${opts.mailbox.display_name} <${opts.mailbox.address}>`
    : opts.mailbox.address;
  const toAddr = recipients.join(", ");
  const icsBytes = new TextEncoder().encode(opts.ics);
  const filename = opts.filename || "invite.ics";
  const contentType = opts.contentType || "text/calendar; charset=utf-8; method=REQUEST";
  const text = opts.text;
  const html = `<pre style="font-family:inherit;white-space:pre-wrap;">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;
  const snippet = makeSnippet(text, html);
  const bodyBytes = messageStorageBytes({
    text_body: text,
    html_body: html,
    subject: opts.subject,
    snippet,
    from_addr: fromHeader,
    to_addr: toAddr,
    cc_addr: "",
    bcc_addr: "",
  });
  const storage = await assertStorageRoom(env.DB, opts.workspaceId, bodyBytes + icsBytes.byteLength);
  if (!storage.ok) return { ok: false, error: storage.error, status: storage.status };

  const id = randomId("msg");
  const domain = opts.mailbox.address.split("@")[1] || "flap.local";
  const rfcId = `<${id}@${domain}>`;
  await env.DB.prepare(
    `INSERT INTO messages
      (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, snippet, scheduled_at, in_reply_to, rfc_message_id, thread_id, storage_bytes, created_at)
     VALUES (?, ?, ?, 'sent', ?, ?, '', '', ?, ?, ?, ?, 1, 0, ?, NULL, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      opts.workspaceId,
      opts.mailbox.id,
      fromHeader,
      toAddr,
      opts.subject,
      now,
      text,
      html,
      snippet,
      opts.inReplyTo || null,
      rfcId,
      id,
      bodyBytes + icsBytes.byteLength,
      now,
    )
    .run();

  if (env.ATTACHMENTS) {
    await putAttachment(env, id, filename, contentType, icsBytes, now);
  }

  const envelopeFrom = extractEmail(fromHeader) || opts.mailbox.address;
  const raw = buildRawMime({
    from: fromHeader,
    to: toAddr,
    subject: opts.subject,
    text,
    html,
    messageId: rfcId,
    inReplyTo: opts.inReplyTo || undefined,
    attachments: [{ filename, contentType, content: icsBytes }],
  });

  try {
    await sendRawEmail(env, {
      envelopeFrom,
      recipients,
      rawMime: raw,
    });
  } catch (err) {
    await env.DB.prepare("UPDATE messages SET folder = 'drafts' WHERE id = ?").bind(id).run();
    const msg = err instanceof Error ? err.message : "send failed";
    return { ok: false, error: `Invite send failed: ${msg}`, status: 502 };
  }

  await recordOutboundSend(env.DB, opts.workspaceId);
  await markFirstEmailSent(env.DB, opts.workspaceId);
  return { ok: true, id };
}

export function eventToIcsPayload(
  event: {
    uid: string;
    title: string;
    description?: string;
    location?: string;
    starts_at: number;
    ends_at: number;
    all_day?: number;
    sequence?: number;
    organizer_email?: string;
    status?: string;
  },
  attendees: IcsAttendee[],
  organizerName?: string,
): IcsEvent {
  return {
    uid: event.uid,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    allDay: Boolean(event.all_day),
    sequence: event.sequence || 0,
    organizerEmail: event.organizer_email,
    organizerName,
    attendees,
    status: event.status,
  };
}

export function buildInviteIcs(event: IcsEvent, method: IcsMethod = "REQUEST"): string {
  return buildIcs(event, method);
}

export { icsToBase64DataUrl };
