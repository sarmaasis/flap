import PostalMime from "postal-mime";
import { randomId, nowMs } from "./lib/ids";
import { splitHeadersBody } from "./lib/mime";
import { isNoReply, makeSnippet } from "./lib/mailutil";
import { assertStorageRoom, messageStorageBytes } from "./lib/billing";
import { markFirstEmailReceived } from "./lib/activation";
import {
  applyInboundPolicy,
  fireWebhooks,
  maybeForwardInbound,
  maybeVacationReply,
  normalizeMessageId,
  resolveThreadId,
  touchContact,
} from "./lib/workspace";

type MailboxRow = {
  id: string;
  user_id: string;
  address: string;
  domain_id: string;
};

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const rawBuf = await new Response(message.raw).arrayBuffer();
  if (rawBuf.byteLength > 25 * 1024 * 1024) {
    message.setReject("This message exceeds Flap's 25 MB inbound size limit.");
    return;
  }
  const parsed = await parseMessage(rawBuf);

  const recipients = uniqueAddresses([
    message.to,
    parsed.to,
    ...parsed.toList,
  ]);

  const mailbox = await resolveMailbox(env.DB, recipients);
  if (!mailbox) {
    message.setReject("This recipient is not configured in Flap.");
    return;
  }
  const userId = mailbox.user_id;

  const policy = await applyInboundPolicy(env.DB, userId, {
    from: parsed.from,
    to: recipients.join(", ") || message.to,
    subject: parsed.subject,
  });
  const snippet = makeSnippet(parsed.text, parsed.html);
  const id = randomId("msg");
  const now = nowMs();
  const dateMs = parsed.dateMs ?? now;
  const rfcMessageId = normalizeMessageId(parsed.messageId) || `<${id}@flap.local>`;
  const inReplyTo = normalizeMessageId(parsed.inReplyTo);
  const referencesHeader = (parsed.references || "").slice(0, 4000);
  const threadId = await resolveThreadId(env.DB, userId, rfcMessageId, inReplyTo, referencesHeader);
  const storeAtt = Boolean(parsed.attachments.length && env.INLET_ATTACHMENTS);
  const hasAttachments = storeAtt ? 1 : 0;
  if (parsed.attachments.length && !env.INLET_ATTACHMENTS) {
    console.warn("INLET_ATTACHMENTS binding missing; skipping inbound attachments");
  }

  const bodyBytes = messageStorageBytes({
    text_body: parsed.text,
    html_body: parsed.html,
    subject: parsed.subject,
    snippet,
    from_addr: parsed.from,
    to_addr: recipients.join(", ") || message.to,
    cc_addr: parsed.cc,
  });
  let attachmentBytes = 0;
  const preparedAtts: Array<{ filename: string; mimeType: string; bytes: Uint8Array }> = [];
  if (storeAtt && env.INLET_ATTACHMENTS) {
    for (const att of parsed.attachments) {
      const bytes = toBytes(att.content);
      attachmentBytes += bytes.byteLength;
      preparedAtts.push({ filename: att.filename, mimeType: att.mimeType, bytes });
    }
  }

  const storageCheck = await assertStorageRoom(env.DB, userId, bodyBytes + attachmentBytes);
  if (!storageCheck.ok) {
    message.setReject("Mailbox storage quota exceeded. Delete mail or upgrade your Flap plan.");
    return;
  }

  await env.DB.prepare(
    `INSERT INTO messages
      (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, subject, date_ms, text_body, html_body,
       has_attachments, unread, starred, snippet, in_reply_to, rfc_message_id, references_header, thread_id, label, storage_bytes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      mailbox.id,
      policy.folder,
      parsed.from,
      recipients.join(", ") || message.to,
      parsed.cc,
      parsed.subject,
      dateMs,
      parsed.text,
      parsed.html,
      hasAttachments,
      policy.starred,
      snippet,
      inReplyTo || null,
      rfcMessageId,
      referencesHeader,
      threadId,
      policy.label,
      bodyBytes,
      now,
    )
    .run();
  await touchContact(env.DB, userId, parsed.from).catch(() => undefined);
  if (policy.folder === "inbox" && !isNoReply(parsed.from)) {
    await maybeVacationReply(env, userId, mailbox.address, parsed.from).catch((error) => console.warn("vacation", error));
  }
  if (policy.forward_to) {
    await maybeForwardInbound(env, userId, mailbox.address, policy.forward_to, parsed.subject, parsed.text, parsed.html).catch(
      (error) => console.warn("forward", error),
    );
  }
  await fireWebhooks(env, userId, "mail.received", {
    id,
    from: parsed.from,
    to: recipients.join(", ") || message.to,
    subject: parsed.subject,
    folder: policy.folder,
    label: policy.label,
  }).catch((error) => console.warn("webhook", error));

  await markFirstEmailReceived(env.DB, userId).catch(() => undefined);

  if (preparedAtts.length && env.INLET_ATTACHMENTS) {
    for (const att of preparedAtts) {
      const attId = randomId("att");
      const key = "attachments/" + id + "/" + attId + "/" + safeName(att.filename);
      await env.INLET_ATTACHMENTS.put(key, att.bytes, {
        httpMetadata: { contentType: att.mimeType },
      });
      await env.DB.prepare(
        `INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(attId, id, key, att.filename, att.mimeType, att.bytes.byteLength, now)
        .run();
    }
  }
}

type ParsedAtt = { filename: string; mimeType: string; content: ArrayBuffer | Uint8Array | string };
type Parsed = {
  from: string;
  to: string;
  cc: string;
  toList: string[];
  subject: string;
  dateMs: number | null;
  text: string;
  html: string;
  messageId: string;
  inReplyTo: string;
  references: string;
  attachments: ParsedAtt[];
};

async function parseMessage(raw: ArrayBuffer): Promise<Parsed> {
  try {
    const email = await PostalMime.parse(raw);
    const toList = (email.to ?? []).flatMap((a) => (a.address ? [a.address] : []));
    const ccList = (email.cc ?? []).flatMap((a) => (a.address ? [a.address] : []));
    return {
      from: formatAddr(email.from),
      to: toList.join(", "),
      cc: ccList.join(", "),
      toList,
      subject: email.subject ?? "(no subject)",
      dateMs: email.date ? Date.parse(email.date) || null : null,
      text: email.text ?? "",
      html: email.html ?? "",
      messageId: email.messageId ?? "",
      inReplyTo: email.inReplyTo ?? "",
      references: email.references ?? "",
      attachments: (email.attachments ?? []).map((a) => ({
        filename: a.filename || "attachment",
        mimeType: a.mimeType || "application/octet-stream",
        content: a.content,
      })),
    };
  } catch (err) {
    console.warn("postal-mime failed, using header/body split", err);
    const rawText = new TextDecoder().decode(raw);
    const split = splitHeadersBody(rawText);
    const to = split.headers["to"] ?? "";
    return {
      from: split.headers["from"] ?? "",
      to,
      cc: split.headers["cc"] ?? "",
      toList: extractAddresses(to),
      subject: split.headers["subject"] ?? "(no subject)",
      dateMs: split.headers["date"] ? Date.parse(split.headers["date"]) || null : null,
      text: split.text,
      html: split.html,
      messageId: split.headers["message-id"] ?? "",
      inReplyTo: split.headers["in-reply-to"] ?? "",
      references: split.headers["references"] ?? "",
      attachments: [],
    };
  }
}

async function resolveMailbox(db: D1Database, addresses: string[]): Promise<MailboxRow | null> {
  const now = nowMs();
  for (const addr of addresses) {
    const lower = addr.toLowerCase();
    const row = await db
      .prepare("SELECT id, user_id, address, domain_id FROM mailboxes WHERE lower(address) = ?")
      .bind(lower)
      .first<MailboxRow>();
    if (row) return row;

    const alias = await db
      .prepare(
        `SELECT m.id, m.user_id, m.address, m.domain_id
         FROM aliases a
         JOIN mailboxes m ON m.id = a.mailbox_id
         WHERE lower(a.address) = ? AND a.enabled = 1
           AND (a.expires_at IS NULL OR a.expires_at > ?)`,
      )
      .bind(lower, now)
      .first<MailboxRow>();
    if (alias) return alias;
  }

  for (const addr of addresses) {
    const domainName = addr.split("@")[1]?.toLowerCase();
    if (!domainName) continue;
    const catchAll = await db
      .prepare(
        `SELECT m.id, m.user_id, m.address, m.domain_id
         FROM domains d
         JOIN mailboxes m ON m.id = d.catch_all_mailbox_id
         WHERE lower(d.name) = ?`,
      )
      .bind(domainName)
      .first<MailboxRow>();
    if (catchAll) return catchAll;
  }
  return null;
}

function formatAddr(from: { address?: string; name?: string } | undefined): string {
  if (!from) return "";
  if (from.name && from.address) return from.name + " <" + from.address + ">";
  return from.address || from.name || "";
}

function extractAddresses(value: string): string[] {
  const found = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return found ?? [];
}

function uniqueAddresses(values: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    const extra = v.includes("@") && !v.includes(" ") ? [v] : [];
    for (const a of extractAddresses(v).concat(extra)) {
      const key = a.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
  }
  return out;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "file";
}

function toBytes(data: ArrayBuffer | Uint8Array | string): Uint8Array {
  if (typeof data === "string") return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(data);
}
