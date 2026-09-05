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

export type IngestResult =
  | { ok: true; messageId: string; mailboxId: string }
  | {
      ok: false;
      reason:
        | "too_large"
        | "no_mailbox"
        | "quota"
        | "parse_error"
        | "duplicate"
        | "domain_not_ready"
        | "disabled";
      detail?: string;
    };

export type IngestOptions = {
  provider?: "ses" | "mailgun" | "cloudflare";
  providerMessageId?: string;
};

/**
 * Shared inbound pipeline for SES Lambda webhook, Mailgun MIME webhooks,
 * and Cloudflare Email Routing (`email` handler).
 */
export async function ingestRawEmail(
  env: Env,
  rawBuf: ArrayBuffer,
  envelopeRecipients: string[] = [],
  opts: IngestOptions = {},
): Promise<IngestResult> {
  if (rawBuf.byteLength > 25 * 1024 * 1024) {
    return { ok: false, reason: "too_large" };
  }

  if (opts.providerMessageId) {
    const dup = await env.DB.prepare(
      "SELECT id FROM inbound_idempotency WHERE provider = ? AND provider_message_id = ?",
    )
      .bind(opts.provider || "ses", opts.providerMessageId)
      .first();
    if (dup) return { ok: false, reason: "duplicate" };
  }

  let parsed: Parsed;
  try {
    parsed = await parseMessage(rawBuf);
  } catch (err) {
    return {
      ok: false,
      reason: "parse_error",
      detail: err instanceof Error ? err.message : "parse failed",
    };
  }

  const recipients = uniqueAddresses([...envelopeRecipients, parsed.to, ...parsed.toList]);

  const mailbox = await resolveMailbox(env.DB, recipients);
  if (!mailbox) {
    return { ok: false, reason: "no_mailbox" };
  }

  // Never auto-create mailboxes; require domain receiving readiness for SES domains.
  const domain = await env.DB.prepare(
    `SELECT id, mail_provider, receiving_ready_at, mx_verified_at, identity_verified_at,
            inbound_rule_ready_at, provider_state
     FROM domains WHERE id = ?`,
  )
    .bind(mailbox.domain_id)
    .first<{
      id: string;
      mail_provider: string | null;
      receiving_ready_at: number | null;
      mx_verified_at: number | null;
      identity_verified_at: number | null;
      inbound_rule_ready_at: number | null;
      provider_state: string | null;
    }>();

  if (domain) {
    const p = (domain.mail_provider || "ses").toLowerCase();
    const suspended = /SUSPENDED|FAILED/i.test(domain.provider_state || "");
    if (suspended) return { ok: false, reason: "disabled" };
    if (p === "ses") {
      const ready =
        Boolean(domain.receiving_ready_at) ||
        (Boolean(domain.identity_verified_at) &&
          Boolean(domain.mx_verified_at) &&
          Boolean(domain.inbound_rule_ready_at));
      // Allow first-message prove-out once MX is verified even if timestamps lag.
      if (!ready && !domain.mx_verified_at && !domain.receiving_ready_at) {
        // Still accept mail if MX was pointed (ops may mark later) — only hard-block when
        // explicitly not ready and identity never verified. Soft-allow for migration.
        if (domain.provider_state === "PENDING" && !domain.identity_verified_at) {
          return { ok: false, reason: "domain_not_ready" };
        }
      }
    }
  }

  const userId = mailbox.user_id;

  const policy = await applyInboundPolicy(env.DB, userId, {
    from: parsed.from,
    to: recipients.join(", ") || envelopeRecipients[0] || "",
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
  const storeAtt = Boolean(parsed.attachments.length && env.ATTACHMENTS);
  const hasAttachments = storeAtt ? 1 : 0;
  if (parsed.attachments.length && !env.ATTACHMENTS) {
    console.warn("ATTACHMENTS binding missing; skipping inbound attachments");
  }

  const bodyBytes = messageStorageBytes({
    text_body: parsed.text,
    html_body: parsed.html,
    subject: parsed.subject,
    snippet,
    from_addr: parsed.from,
    to_addr: recipients.join(", ") || envelopeRecipients[0] || "",
    cc_addr: parsed.cc,
  });
  let attachmentBytes = 0;
  const preparedAtts: Array<{ filename: string; mimeType: string; bytes: Uint8Array }> = [];
  if (storeAtt && env.ATTACHMENTS) {
    for (const att of parsed.attachments) {
      const bytes = toBytes(att.content);
      attachmentBytes += bytes.byteLength;
      preparedAtts.push({ filename: att.filename, mimeType: att.mimeType, bytes });
    }
  }

  const storageCheck = await assertStorageRoom(env.DB, userId, bodyBytes + attachmentBytes);
  if (!storageCheck.ok) {
    return { ok: false, reason: "quota" };
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
      recipients.join(", ") || envelopeRecipients[0] || "",
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
    to: recipients.join(", ") || envelopeRecipients[0] || "",
    subject: parsed.subject,
    folder: policy.folder,
    label: policy.label,
  }).catch((error) => console.warn("webhook", error));

  await markFirstEmailReceived(env.DB, userId).catch(() => undefined);

  if (preparedAtts.length && env.ATTACHMENTS) {
    for (const att of preparedAtts) {
      const attId = randomId("att");
      const key = "attachments/" + id + "/" + attId + "/" + safeName(att.filename);
      await env.ATTACHMENTS.put(key, att.bytes, {
        httpMetadata: { contentType: att.mimeType },
      });
      await env.DB.prepare(
        `INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(attId, id, key, att.filename, att.mimeType, att.bytes.byteLength, now)
        .run();
    }
  }

  if (opts.providerMessageId) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO inbound_idempotency
        (id, provider, provider_message_id, rfc_message_id, domain_id, mailbox_id, outcome, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'stored', ?)`,
    )
      .bind(
        randomId("idem"),
        opts.provider || "ses",
        opts.providerMessageId,
        rfcMessageId.slice(0, 500),
        mailbox.domain_id,
        mailbox.id,
        now,
      )
      .run()
      .catch(() => undefined);
  }

  // First successful SES inbound can mark receiving_ready_at if infra checks already passed MX.
  if (domain && (domain.mail_provider || "ses").toLowerCase() === "ses" && !domain.receiving_ready_at) {
    await env.DB.prepare(
      "UPDATE domains SET receiving_ready_at = COALESCE(receiving_ready_at, ?), provider_state = CASE WHEN sending_ready_at IS NOT NULL THEN 'ACTIVE' ELSE 'RECEIVING_READY' END WHERE id = ?",
    )
      .bind(now, domain.id)
      .run()
      .catch(() => undefined);
  }

  return { ok: true, messageId: id, mailboxId: mailbox.id };
}

/** Cloudflare Email Routing entrypoint (legacy + useflap.online if still on CF). */
export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const rawBuf = await new Response(message.raw).arrayBuffer();
  const result = await ingestRawEmail(env, rawBuf, [message.to]);
  if (result.ok) return;
  if (result.reason === "too_large") {
    message.setReject("This message exceeds Flap's 25 MB inbound size limit.");
    return;
  }
  if (result.reason === "quota") {
    message.setReject("Mailbox storage quota exceeded. Delete mail or upgrade your Flap plan.");
    return;
  }
  if (result.reason === "no_mailbox") {
    message.setReject("This recipient is not configured in Flap.");
    return;
  }
  message.setReject("Flap could not process this message.");
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
