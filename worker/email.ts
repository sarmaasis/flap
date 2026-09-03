import PostalMime from "postal-mime";
import { randomId, nowMs } from "./lib/ids";
import { splitHeadersBody } from "./lib/mime";
import { isNoReply, makeSnippet } from "./lib/mailutil";
import { applyInboundPolicy, maybeVacationReply, touchContact } from "./lib/workspace";

type MailboxRow = {
  id: string;
  user_id: string;
  address: string;
  domain_id: string;
};

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const rawBuf = await new Response(message.raw).arrayBuffer();
  if (rawBuf.byteLength > 25 * 1024 * 1024) {
    message.setReject("This message exceeds Inlet's 25 MB inbound size limit.");
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
    message.setReject("This recipient is not configured in Inlet.");
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
  const storeAtt = Boolean(parsed.attachments.length && env.INLET_ATTACHMENTS);
  const hasAttachments = storeAtt ? 1 : 0;
  if (parsed.attachments.length && !env.INLET_ATTACHMENTS) {
    console.warn("INLET_ATTACHMENTS binding missing; skipping inbound attachments");
  }

  await env.DB.prepare(
    `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, starred, snippet, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(
      id,
      userId,
      mailbox?.id ?? null,
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
      now,
    )
    .run();
  await touchContact(env.DB, userId, parsed.from).catch(() => undefined);
  if (policy.folder === "inbox" && !isNoReply(parsed.from)) {
    await maybeVacationReply(env, userId, mailbox.address, parsed.from).catch((error) => console.warn("vacation", error));
  }

  if (storeAtt && env.INLET_ATTACHMENTS) {
    for (const att of parsed.attachments) {
      const attId = randomId("att");
      const key = "attachments/" + id + "/" + attId + "/" + safeName(att.filename);
      const bytes = toBytes(att.content);
      await env.INLET_ATTACHMENTS.put(key, bytes, {
        httpMetadata: { contentType: att.mimeType },
      });
      await env.DB.prepare(
        `INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(attId, id, key, att.filename, att.mimeType, bytes.byteLength, now)
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
      attachments: [],
    };
  }
}

async function resolveMailbox(db: D1Database, addresses: string[]): Promise<MailboxRow | null> {
  for (const addr of addresses) {
    const row = await db
      .prepare("SELECT id, user_id, address, domain_id FROM mailboxes WHERE lower(address) = ?")
      .bind(addr.toLowerCase())
      .first<MailboxRow>();
    if (row) return row;
  }
  return null;
}

function formatAddr(from: { address?: string; name?: string } | undefined): string {
  if (!from) return "";
  if (from.name && from.address) return from.name + " <" + from.address + ">";
  return from.address || from.name || "";
}

function extractAddresses(value: string): string[] {
  const found = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+.[A-Z]{2,}/gi);
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
