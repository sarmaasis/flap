import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { assertWithinLimit, assertSendRoom, assertStorageRoom, getEffectivePlan, messageStorageBytes, recordOutboundSend } from "./billing";
import { markFirstEmailSent } from "./activation";
import { randomId, nowMs } from "./ids";
import { buildRawMime } from "./mime";
import { canSendFromDomain, canSendMail, sendRawEmail } from "./mail-provider";
import {
  EMAIL_RE,
  extractEmail,
  extractName,
  makeSnippet,
  parseRecipients,
  sha256Hex,
} from "./mailutil";
import {
  acceptInvite,
  createInvite,
  grantMailboxMember,
  listAccessibleMailboxes,
  resolveWorkspace,
  revokeMailboxMember,
  setMailboxShared,
} from "./team";
import { isAddressSuppressed } from "./suppressions";
import { domainIsSendingReady } from "../../shared/ses-dns";

type App = { Bindings: Env };

export type InboundPolicy = {
  folder: string;
  starred: number;
  label: string;
  forward_to: string;
};

const FILTER_ACTIONS = new Set(["archive", "spam", "trash", "star", "inbox", "label", "forward"]);

export async function touchContact(db: D1Database, userId: string, address: string, name = ""): Promise<void> {
  const email = extractEmail(address);
  if (!EMAIL_RE.test(email)) return;
  const now = nowMs();
  const resolvedName = name || extractName(address);
  await db
    .prepare(
      `INSERT INTO contacts (id, user_id, email, name, last_used_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, email) DO UPDATE SET
         last_used_at = excluded.last_used_at,
         name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END`,
    )
    .bind(randomId("ct"), userId, email, resolvedName, now, now)
    .run();
}

export async function applyInboundPolicy(
  db: D1Database,
  userId: string,
  parsed: { from: string; to: string; subject: string },
): Promise<InboundPolicy> {
  const from = extractEmail(parsed.from);
  const blocked = await db
    .prepare("SELECT id FROM blocked_senders WHERE user_id = ? AND address = ?")
    .bind(userId, from)
    .first();
  if (blocked) return { folder: "spam", starred: 0, label: "", forward_to: "" };

  const filters = await db
    .prepare(
      `SELECT match_from, match_to, match_subject, action, forward_to, label, is_catch_all
       FROM filters WHERE user_id = ? AND enabled = 1
       ORDER BY is_catch_all ASC, created_at ASC`,
    )
    .bind(userId)
    .all<{
      match_from: string;
      match_to: string;
      match_subject: string;
      action: string;
      forward_to: string;
      label: string;
      is_catch_all: number;
    }>();

  let catchAll: InboundPolicy | null = null;
  for (const filter of filters.results ?? []) {
    const isCatch = Boolean(filter.is_catch_all);
    if (!isCatch) {
      if (filter.match_from && !from.includes(filter.match_from.toLowerCase())) continue;
      if (filter.match_to && !parsed.to.toLowerCase().includes(filter.match_to.toLowerCase())) continue;
      if (filter.match_subject && !parsed.subject.toLowerCase().includes(filter.match_subject.toLowerCase())) continue;
      if (!filter.match_from && !filter.match_to && !filter.match_subject) continue;
    }
    const policy = policyFromAction(filter.action, filter.label, filter.forward_to);
    if (isCatch) {
      catchAll = policy;
      continue;
    }
    return policy;
  }
  return catchAll ?? { folder: "inbox", starred: 0, label: "", forward_to: "" };
}

function policyFromAction(action: string, label: string, forwardTo: string): InboundPolicy {
  if (action === "star") return { folder: "inbox", starred: 1, label: "", forward_to: "" };
  if (action === "label") return { folder: "inbox", starred: 0, label: label.trim(), forward_to: "" };
  if (action === "forward") {
    return { folder: "inbox", starred: 0, label: "", forward_to: extractEmail(forwardTo) };
  }
  if (action === "archive") return { folder: "archive", starred: 0, label: "", forward_to: "" };
  if (action === "spam" || action === "trash" || action === "inbox") {
    return { folder: action, starred: 0, label: "", forward_to: "" };
  }
  return { folder: "inbox", starred: 0, label: "", forward_to: "" };
}

export async function loadSettings(db: D1Database, userId: string) {
  try {
    const row = await db
      .prepare(
        "SELECT vacation_enabled, vacation_body, notify_browser, undo_send_seconds FROM user_settings WHERE user_id = ?",
      )
      .bind(userId)
      .first<{
        vacation_enabled: number;
        vacation_body: string;
        notify_browser: number;
        undo_send_seconds: number | null;
      }>();
    if (row) {
      return {
        vacation_enabled: row.vacation_enabled,
        vacation_body: row.vacation_body,
        notify_browser: row.notify_browser,
        undo_send_seconds: row.undo_send_seconds ?? 10,
      };
    }
  } catch {
    const legacy = await db
      .prepare("SELECT vacation_enabled, vacation_body, notify_browser FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<{ vacation_enabled: number; vacation_body: string; notify_browser: number }>();
    if (legacy) return { ...legacy, undo_send_seconds: 10 };
  }
  return {
    vacation_enabled: 0,
    vacation_body: "",
    notify_browser: 0,
    undo_send_seconds: 10,
  };
}

export function normalizeMessageId(value: string | null | undefined): string {
  if (!value) return "";
  const match = value.match(/<[^>]+>/);
  return (match ? match[0] : value.trim()).slice(0, 998);
}

export async function resolveThreadId(
  db: D1Database,
  userId: string,
  rfcMessageId: string,
  inReplyTo: string,
  referencesHeader: string,
): Promise<string> {
  const candidates = [
    ...referencesHeader.matchAll(/<[^>]+>/g),
  ].map((m) => m[0]);
  if (inReplyTo) candidates.unshift(inReplyTo);
  for (const candidate of candidates) {
    const row = await db
      .prepare("SELECT thread_id FROM messages WHERE user_id = ? AND (rfc_message_id = ? OR id = ?) LIMIT 1")
      .bind(userId, candidate, candidate.replace(/^<|>$/g, ""))
      .first<{ thread_id: string | null }>();
    if (row?.thread_id) return row.thread_id;
  }
  return rfcMessageId || randomId("thr");
}

const WEBHOOK_DELIVERY_KEEP = 20;

async function recordWebhookDelivery(
  db: D1Database,
  webhookId: string,
  event: string,
  statusCode: number | null,
  ok: boolean,
  error: string,
  payloadJson = "",
): Promise<void> {
  const now = nowMs();
  try {
    await db
      .prepare(
        `INSERT INTO webhook_deliveries (id, webhook_id, event, status_code, ok, error, created_at, payload_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(randomId("wd"), webhookId, event, statusCode, ok ? 1 : 0, error.slice(0, 500), now, payloadJson.slice(0, 50_000))
      .run();
    await db
      .prepare(
        `DELETE FROM webhook_deliveries WHERE id IN (
           SELECT id FROM webhook_deliveries
           WHERE webhook_id = ?
           ORDER BY created_at DESC
           LIMIT -1 OFFSET ?
         )`,
      )
      .bind(webhookId, WEBHOOK_DELIVERY_KEEP)
      .run();
  } catch (err) {
    // Fallback without payload_json if migration 0027 is not applied yet.
    try {
      await db
        .prepare(
          `INSERT INTO webhook_deliveries (id, webhook_id, event, status_code, ok, error, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(randomId("wd"), webhookId, event, statusCode, ok ? 1 : 0, error.slice(0, 500), now)
        .run();
    } catch (inner) {
      console.warn("Webhook delivery log failed", webhookId, inner ?? err);
    }
  }
}

async function postWebhookPayload(
  hook: { id: string; url: string; secret: string },
  event: string,
  body: string,
): Promise<{ statusCode: number | null; ok: boolean; error: string }> {
  let statusCode: number | null = null;
  let ok = false;
  let error = "";
  try {
    const signature = await sha256Hex(`${hook.secret}.${body}`);
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flap-event": event,
        "x-flap-signature": signature,
        "x-flap-redelivery": "0",
      },
      body,
    });
    statusCode = res.status;
    ok = res.ok;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return { statusCode, ok, error };
}

export async function fireWebhooks(
  env: Env,
  userId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const rows = await env.DB.prepare(
    "SELECT id, url, secret, events FROM webhooks WHERE user_id = ? AND enabled = 1",
  )
    .bind(userId)
    .all<{ id: string; url: string; secret: string; events: string }>();
  const body = JSON.stringify({ event, at: new Date().toISOString(), ...payload });
  for (const hook of rows.results ?? []) {
    const events = hook.events.split(",").map((e) => e.trim()).filter(Boolean);
    if (events.length && !events.includes(event) && !events.includes("*")) continue;
    const result = await postWebhookPayload(hook, event, body);
    if (result.error && !result.statusCode) console.warn("Webhook failed", hook.id, result.error);
    await env.DB.prepare("UPDATE webhooks SET last_triggered_at = ? WHERE id = ?")
      .bind(nowMs(), hook.id)
      .run();
    await recordWebhookDelivery(env.DB, hook.id, event, result.statusCode, result.ok, result.error, body);
  }
}

export async function maybeForwardInbound(
  env: Env,
  userId: string,
  fromMailbox: string,
  forwardTo: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  if (!canSendMail(env) || !EMAIL_RE.test(forwardTo)) return;
  const sendLimit = await assertSendRoom(env.DB, userId);
  if (!sendLimit.ok) {
    console.warn("Inbound forward blocked by monthly send quota", userId);
    return;
  }
  const raw = buildRawMime({
    from: fromMailbox,
    to: forwardTo,
    subject: subject.toLowerCase().startsWith("fwd:") ? subject : `Fwd: ${subject}`,
    text,
    html: html || undefined,
  });
  try {
    await sendRawEmail(env, {
      envelopeFrom: fromMailbox,
      recipients: [forwardTo],
      rawMime: raw,
    });
    await recordOutboundSend(env.DB, userId);
  } catch (error) {
    console.warn("Inbound forward failed", error);
  }
}

export async function maybeVacationReply(
  env: Env,
  userId: string,
  fromMailbox: string,
  toAddress: string,
): Promise<void> {
  if (!canSendMail(env)) return;
  const settings = await loadSettings(env.DB, userId);
  if (!settings.vacation_enabled || !settings.vacation_body.trim()) return;
  const email = extractEmail(toAddress);
  if (!EMAIL_RE.test(email)) return;
  const weekAgo = nowMs() - 7 * 24 * 60 * 60 * 1000;
  const recent = await env.DB.prepare(
    "SELECT sent_at FROM vacation_replies WHERE user_id = ? AND address = ? AND sent_at > ?",
  )
    .bind(userId, email, weekAgo)
    .first();
  if (recent) return;
  const sendLimit = await assertSendRoom(env.DB, userId);
  if (!sendLimit.ok) {
    console.warn("Vacation reply blocked by monthly send quota", userId);
    return;
  }
  const now = nowMs();
  const raw = buildRawMime({
    from: fromMailbox,
    to: email,
    subject: "Automatic reply",
    text: settings.vacation_body,
  });
  try {
    await sendRawEmail(env, {
      envelopeFrom: fromMailbox,
      recipients: [email],
      rawMime: raw,
    });
    await env.DB.prepare(
      `INSERT INTO vacation_replies (user_id, address, sent_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, address) DO UPDATE SET sent_at = excluded.sent_at`,
    )
      .bind(userId, email, now)
      .run();
    await recordOutboundSend(env.DB, userId);
  } catch (error) {
    console.warn("Vacation reply failed", error);
  }
}

type StoredMessage = {
  id: string;
  user_id?: string;
  mailbox_id: string | null;
  from_addr: string;
  to_addr: string;
  cc_addr: string;
  bcc_addr: string;
  subject: string;
  text_body: string;
  html_body: string;
  in_reply_to: string | null;
};

/** Collapse duplicate files created by draft autosave inserting the same attachment repeatedly. */
export function uniqueAttachmentsByFile<T extends { filename: string; content_type?: string; size?: number }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    const key = `${row.filename}\0${row.content_type ?? ""}\0${row.size ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

async function loadAttachmentContents(env: Env, messageId: string) {
  const rows = await env.DB.prepare(
    "SELECT r2_key, filename, content_type, size FROM attachments WHERE message_id = ? ORDER BY created_at ASC",
  )
    .bind(messageId)
    .all<{ r2_key: string; filename: string; content_type: string; size: number }>();
  const files: Array<{ filename: string; contentType: string; content: Uint8Array }> = [];
  if (!env.ATTACHMENTS) return files;
  for (const row of uniqueAttachmentsByFile(rows.results ?? [])) {
    const obj = await env.ATTACHMENTS.get(row.r2_key);
    if (!obj) continue;
    files.push({
      filename: row.filename,
      contentType: row.content_type,
      content: new Uint8Array(await obj.arrayBuffer()),
    });
  }
  return files;
}

export async function dispatchStoredMessage(env: Env, message: StoredMessage): Promise<string | null> {
  if (!canSendFromDomain(env, message.from_addr)) {
    return "Amazon SES is not configured for customer-domain sending. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY (Cloudflare Email cannot deliver from your custom domain).";
  }
  if (!canSendMail(env)) {
    return "Mail sending is not configured. Set AWS SES credentials (customer domains) or the SEB send_email binding.";
  }
  const to = parseRecipients(message.to_addr);
  const cc = message.cc_addr ? parseRecipients(message.cc_addr) : [];
  const bcc = message.bcc_addr ? parseRecipients(message.bcc_addr) : [];
  const recipients = [...new Set([...to, ...cc, ...bcc])];
  if (!recipients.length) return "No valid recipients.";

  for (const addr of recipients) {
    if (message.user_id && (await isAddressSuppressed(env.DB, message.user_id, addr))) {
      return `${addr} is on the suppression list (bounce or complaint).`;
    }
  }

  const attachments = await loadAttachmentContents(env, message.id);
  const envelopeFrom = extractEmail(message.from_addr) || message.from_addr;
  const domain = envelopeFrom.split("@")[1] || "flap.local";

  // Scope domain lookup to the message owner — never pick another tenant's domain row by name alone.
  const domainRow = message.user_id
    ? await env.DB.prepare(
        `SELECT mail_provider, provider_state, identity_verified_at, mx_verified_at,
                inbound_rule_ready_at, receiving_ready_at, sending_ready_at
         FROM domains WHERE user_id = ? AND lower(name) = ? LIMIT 1`,
      )
        .bind(message.user_id, domain.toLowerCase())
        .first<{
          mail_provider: string | null;
          provider_state: string | null;
          identity_verified_at: number | null;
          mx_verified_at: number | null;
          inbound_rule_ready_at: number | null;
          receiving_ready_at: number | null;
          sending_ready_at: number | null;
        }>()
    : await env.DB.prepare(
        `SELECT mail_provider, provider_state, identity_verified_at, mx_verified_at,
                inbound_rule_ready_at, receiving_ready_at, sending_ready_at
         FROM domains WHERE lower(name) = ? LIMIT 1`,
      )
        .bind(domain.toLowerCase())
        .first<{
          mail_provider: string | null;
          provider_state: string | null;
          identity_verified_at: number | null;
          mx_verified_at: number | null;
          inbound_rule_ready_at: number | null;
          receiving_ready_at: number | null;
          sending_ready_at: number | null;
        }>();

  if (!domainRow || !domainIsSendingReady(domainRow)) {
    return `Finish sending setup for ${domain} before sending from this address.`;
  }
  if (/SUSPENDED|FAILED/i.test(domainRow.provider_state || "")) {
    return `Domain ${domain} is suspended and cannot send.`;
  }

  let text = message.text_body;
  let html = message.html_body || undefined;
  if (message.user_id) {
    const plan = await getEffectivePlan(env.DB, message.user_id);
    if (plan.branding_footer) {
      const brandText = "\n\n--\nSent with Flap · https://useflap.online";
      const brandHtml =
        '<p style="margin-top:1.5em;font-size:11px;line-height:1.4;color:#888;">Sent with <a href="https://useflap.online" style="color:#888;text-decoration:underline;">Flap</a></p>';
      if (!/sent with flap/i.test(text)) text = `${text}${brandText}`;
      if (html && !/sent with flap/i.test(html)) html = `${html}${brandHtml}`;
      else if (!html) html = `<pre style="font-family:inherit;white-space:pre-wrap;">${escapeHtml(text)}</pre>`;
    }
  }

  const raw = buildRawMime({
    from: message.from_addr,
    to: message.to_addr,
    cc: message.cc_addr || undefined,
    subject: message.subject,
    text,
    html,
    attachments,
    messageId: `<${message.id}@${domain}>`,
    inReplyTo: message.in_reply_to || undefined,
  });
  try {
    const result = await sendRawEmail(env, {
      envelopeFrom,
      recipients,
      rawMime: raw,
      mailProvider: domainRow.mail_provider || "ses",
    });
    if (result.messageId) {
      await env.DB.prepare("UPDATE messages SET provider_message_id = ? WHERE id = ?")
        .bind(result.messageId, message.id)
        .run()
        .catch(() => undefined);
    }
  } catch (err) {
    return err instanceof Error ? err.message : "send failed";
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function flushScheduled(
  env: Env,
  opts?: { userId?: string },
): Promise<{ flushed: number; failed: Array<{ id: string; error: string }> }> {
  const now = nowMs();
  const failed: Array<{ id: string; error: string }> = [];
  let flushed = 0;
  const due = opts?.userId
    ? await env.DB.prepare(
        `SELECT id, user_id, mailbox_id, from_addr, to_addr, cc_addr, bcc_addr, subject, text_body, html_body, in_reply_to
         FROM messages
         WHERE user_id = ? AND folder = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
         ORDER BY scheduled_at ASC
         LIMIT 15`,
      )
        .bind(opts.userId, now)
        .all<StoredMessage & { user_id: string }>()
    : await env.DB.prepare(
        `SELECT id, user_id, mailbox_id, from_addr, to_addr, cc_addr, bcc_addr, subject, text_body, html_body, in_reply_to
         FROM messages
         WHERE folder = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
         ORDER BY scheduled_at ASC
         LIMIT 15`,
      )
        .bind(now)
        .all<StoredMessage & { user_id: string }>();
  for (const message of due.results ?? []) {
    const sendLimit = await assertSendRoom(env.DB, message.user_id);
    if (!sendLimit.ok) {
      console.warn("Scheduled send blocked by monthly send quota", message.id, message.user_id);
      continue;
    }
    const error = await dispatchStoredMessage(env, message);
    if (error) {
      console.warn("Scheduled send failed", message.id, error);
      // Bounce back to drafts so the user can fix and retry — do not fake "Sent".
      await env.DB.prepare(
        "UPDATE messages SET folder = 'drafts', scheduled_at = NULL, snippet = ? WHERE id = ?",
      )
        .bind(`Send failed: ${error}`.slice(0, 160), message.id)
        .run()
        .catch(() => undefined);
      failed.push({ id: message.id, error });
      continue;
    }
    await env.DB.prepare("UPDATE messages SET folder = 'sent', scheduled_at = NULL, date_ms = ?, unread = 0 WHERE id = ?")
      .bind(now, message.id)
      .run();
    await recordOutboundSend(env.DB, message.user_id);
    await markFirstEmailSent(env.DB, message.user_id).catch(() => undefined);
    flushed += 1;
  }
  return { flushed, failed };
}

/** Count each Message-ID once (same rule as list dedupe) so badges match visible rows. */
const MSG_DEDUP_KEY = `CASE WHEN rfc_message_id IS NOT NULL AND rfc_message_id != '' THEN rfc_message_id ELSE id END`;

export async function folderCounts(
  db: D1Database,
  workspaceId: string,
  mailboxIds: string[] | null = null,
) {
  const now = nowMs();
  const access =
    mailboxIds === null
      ? { sql: "", binds: [] as unknown[] }
      : mailboxIds.length === 0
        ? { sql: " AND 1 = 0", binds: [] as unknown[] }
        : {
            sql: ` AND mailbox_id IN (${mailboxIds.map(() => "?").join(", ")})`,
            binds: [...mailboxIds] as unknown[],
          };
  const [rows, starred, snoozed] = await Promise.all([
    db
      .prepare(
        `SELECT folder,
                COUNT(*) AS total,
                SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unread
         FROM (
           SELECT folder, unread,
                  ROW_NUMBER() OVER (
                    PARTITION BY user_id, ${MSG_DEDUP_KEY}
                    ORDER BY date_ms ASC, created_at ASC
                  ) AS rn
           FROM messages
           WHERE user_id = ?${access.sql} AND (snooze_until IS NULL OR snooze_until <= ?)
         )
         WHERE rn = 1
         GROUP BY folder`,
      )
      .bind(workspaceId, ...access.binds, now)
      .all<{ folder: string; total: number; unread: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT 1
           FROM messages
           WHERE user_id = ?${access.sql} AND starred = 1 AND folder NOT IN ('trash', 'spam')
           GROUP BY ${MSG_DEDUP_KEY}
         )`,
      )
      .bind(workspaceId, ...access.binds)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM (
           SELECT 1
           FROM messages
           WHERE user_id = ?${access.sql} AND snooze_until > ?
           GROUP BY ${MSG_DEDUP_KEY}
         )`,
      )
      .bind(workspaceId, ...access.binds, now)
      .first<{ n: number }>(),
  ]);
  const counts: Record<string, { total: number; unread: number }> = {};
  for (const row of rows.results ?? []) {
    counts[row.folder] = { total: Number(row.total), unread: Number(row.unread) };
  }
  counts.starred = { total: Number(starred?.n ?? 0), unread: 0 };
  counts.snoozed = { total: Number(snoozed?.n ?? 0), unread: 0 };
  return counts;
}

/** Unread inbox counts keyed by domain id (via mailbox). */
export async function domainUnreadCounts(
  db: D1Database,
  workspaceId: string,
  mailboxIds: string[] | null = null,
): Promise<Record<string, number>> {
  const now = nowMs();
  const access =
    mailboxIds === null
      ? { sql: "", binds: [] as unknown[] }
      : mailboxIds.length === 0
        ? { sql: " AND 1 = 0", binds: [] as unknown[] }
        : {
            sql: ` AND msg.mailbox_id IN (${mailboxIds.map(() => "?").join(", ")})`,
            binds: [...mailboxIds] as unknown[],
          };
  const rows = await db
    .prepare(
      `SELECT domain_id, SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unread
       FROM (
         SELECT mb.domain_id AS domain_id,
                msg.unread AS unread,
                ROW_NUMBER() OVER (
                  PARTITION BY msg.user_id,
                    CASE WHEN msg.rfc_message_id IS NOT NULL AND msg.rfc_message_id != '' THEN msg.rfc_message_id ELSE msg.id END
                  ORDER BY msg.date_ms ASC, msg.created_at ASC
                ) AS rn
         FROM messages msg
         JOIN mailboxes mb ON mb.id = msg.mailbox_id
         WHERE msg.user_id = ?${access.sql}
           AND msg.folder = 'inbox'
           AND (msg.snooze_until IS NULL OR msg.snooze_until <= ?)
       )
       WHERE rn = 1
       GROUP BY domain_id`,
    )
    .bind(workspaceId, ...access.binds, now)
    .all<{ domain_id: string; unread: number }>();
  const out: Record<string, number> = {};
  for (const row of rows.results ?? []) {
    if (row.domain_id) out[row.domain_id] = Number(row.unread) || 0;
  }
  return out;
}

export function registerWorkspaceRoutes(app: Hono<App>) {
  app.get("/api/bootstrap", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const now = nowMs();
    // Scheduled sends are flushed by cron (* * * * *) — do not block bootstrap on them.
    const [mailboxes, signatures, templates, contacts, settings, counts, domain_unread] = await Promise.all([
      listAccessibleMailboxes(c.env.DB, ctx),
      c.env.DB.prepare("SELECT id, name, html_body, text_body, is_default, created_at FROM signatures WHERE user_id = ? ORDER BY is_default DESC, created_at ASC")
        .bind(ctx.workspaceId)
        .all(),
      c.env.DB.prepare("SELECT id, name, subject, html_body, text_body, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC")
        .bind(ctx.workspaceId)
        .all(),
      c.env.DB.prepare("SELECT id, email, name, last_used_at FROM contacts WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 200")
        .bind(ctx.workspaceId)
        .all(),
      loadSettings(c.env.DB, ctx.workspaceId),
      folderCounts(c.env.DB, ctx.workspaceId, ctx.mailboxIds),
      domainUnreadCounts(c.env.DB, ctx.workspaceId, ctx.mailboxIds),
    ]);
    return c.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      workspace: {
        id: ctx.workspaceId,
        role: ctx.role,
        is_owner: ctx.isOwner,
        can_manage_team: ctx.canManageTeam,
        can_manage_settings: ctx.canManageSettings,
      },
      mailboxes: mailboxes.results ?? [],
      signatures: signatures.results ?? [],
      templates: templates.results ?? [],
      contacts: contacts.results ?? [],
      settings,
      counts,
      domain_unread,
      server_time: now,
    });
  });

  app.get("/api/counts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    // Eagerly flush this workspace's undo-send / scheduled messages only (never other tenants).
    const flush = await flushScheduled(c.env, { userId: ctx.workspaceId }).catch(() => ({
      flushed: 0,
      failed: [] as Array<{ id: string; error: string }>,
    }));
    const [counts, domain_unread] = await Promise.all([
      folderCounts(c.env.DB, ctx.workspaceId, ctx.mailboxIds),
      domainUnreadCounts(c.env.DB, ctx.workspaceId, ctx.mailboxIds),
    ]);
    return c.json({
      counts,
      domain_unread,
      server_time: nowMs(),
      flush,
    });
  });

  app.post("/api/mail/flush-outbox", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const flush = await flushScheduled(c.env, { userId: ctx.workspaceId });
    return c.json(flush);
  });

  app.get("/api/contacts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    let sql = "SELECT id, email, name, last_used_at, created_at FROM contacts WHERE user_id = ?";
    const binds: unknown[] = [user.id];
    if (q) {
      sql += " AND (email LIKE ? OR name LIKE ?)";
      binds.push(`%${q}%`, `%${q}%`);
    }
    sql += " ORDER BY last_used_at DESC LIMIT 200";
    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    return c.json({ contacts: rows.results ?? [] });
  });

  app.post("/api/contacts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { email?: string; name?: string };
    const email = extractEmail(body.email ?? "");
    if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
    await touchContact(c.env.DB, user.id, email, (body.name ?? "").trim());
    const row = await c.env.DB.prepare("SELECT id, email, name, last_used_at, created_at FROM contacts WHERE user_id = ? AND email = ?")
      .bind(user.id, email)
      .first();
    return c.json({ contact: row }, 201);
  });

  app.delete("/api/contacts/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Contact not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/templates", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare(
      "SELECT id, name, subject, html_body, text_body, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC",
    )
      .bind(user.id)
      .all();
    return c.json({ templates: rows.results ?? [] });
  });

  app.post("/api/templates", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; subject?: string; html_body?: string; text_body?: string };
    const name = (body.name ?? "").trim();
    if (!name) return c.json({ error: "Name is required." }, 400);
    const id = randomId("tpl");
    const now = nowMs();
    await c.env.DB.prepare(
      "INSERT INTO templates (id, user_id, name, subject, html_body, text_body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, user.id, name, (body.subject ?? "").trim(), body.html_body ?? "", body.text_body ?? "", now, now)
      .run();
    return c.json({ template: { id, name, subject: body.subject ?? "", html_body: body.html_body ?? "", text_body: body.text_body ?? "" } }, 201);
  });

  app.put("/api/templates/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; subject?: string; html_body?: string; text_body?: string };
    const res = await c.env.DB.prepare(
      "UPDATE templates SET name = ?, subject = ?, html_body = ?, text_body = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind((body.name ?? "").trim(), (body.subject ?? "").trim(), body.html_body ?? "", body.text_body ?? "", nowMs(), c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Template not found." }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/templates/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Template not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/signatures", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare(
      "SELECT id, name, html_body, text_body, is_default, created_at FROM signatures WHERE user_id = ? ORDER BY is_default DESC, created_at ASC",
    )
      .bind(user.id)
      .all();
    return c.json({ signatures: rows.results ?? [] });
  });

  app.post("/api/signatures", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; html_body?: string; text_body?: string; is_default?: boolean };
    const name = (body.name ?? "").trim();
    if (!name) return c.json({ error: "Name is required." }, 400);
    const id = randomId("sig");
    const now = nowMs();
    if (body.is_default) {
      await c.env.DB.prepare("UPDATE signatures SET is_default = 0 WHERE user_id = ?").bind(user.id).run();
    }
    await c.env.DB.prepare(
      "INSERT INTO signatures (id, user_id, name, html_body, text_body, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, user.id, name, body.html_body ?? "", body.text_body ?? "", body.is_default ? 1 : 0, now)
      .run();
    return c.json({ signature: { id, name, html_body: body.html_body ?? "", text_body: body.text_body ?? "", is_default: body.is_default ? 1 : 0 } }, 201);
  });

  app.put("/api/signatures/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; html_body?: string; text_body?: string; is_default?: boolean };
    if (body.is_default) {
      await c.env.DB.prepare("UPDATE signatures SET is_default = 0 WHERE user_id = ?").bind(user.id).run();
    }
    const res = await c.env.DB.prepare(
      "UPDATE signatures SET name = ?, html_body = ?, text_body = ?, is_default = ? WHERE id = ? AND user_id = ?",
    )
      .bind((body.name ?? "").trim(), body.html_body ?? "", body.text_body ?? "", body.is_default ? 1 : 0, c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Signature not found." }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/signatures/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM signatures WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Signature not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/filters", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare("SELECT * FROM filters WHERE user_id = ? ORDER BY created_at ASC")
      .bind(user.id)
      .all();
    return c.json({ filters: rows.results ?? [] });
  });

  app.post("/api/filters", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as {
      name?: string;
      match_from?: string;
      match_to?: string;
      match_subject?: string;
      action?: string;
      forward_to?: string;
      label?: string;
      is_catch_all?: boolean;
    };
    const name = (body.name ?? "").trim();
    const action = (body.action ?? "").toLowerCase();
    if (!name) return c.json({ error: "Name is required." }, 400);
    if (!FILTER_ACTIONS.has(action)) {
      return c.json({ error: "Choose archive, spam, trash, star, inbox, label, or forward." }, 400);
    }
    if (action === "forward" && !EMAIL_RE.test(extractEmail(body.forward_to ?? ""))) {
      return c.json({ error: "Forward rules need a valid destination address." }, 400);
    }
    if (action === "label" && !(body.label ?? "").trim()) {
      return c.json({ error: "Label rules need a label name." }, 400);
    }
    const isCatchAll = Boolean(body.is_catch_all);
    if (
      !isCatchAll &&
      !(body.match_from ?? "").trim() &&
      !(body.match_to ?? "").trim() &&
      !(body.match_subject ?? "").trim()
    ) {
      return c.json({ error: "Add a match condition, or mark the rule as catch-all." }, 400);
    }
    const id = randomId("flt");
    await c.env.DB.prepare(
      `INSERT INTO filters
        (id, user_id, name, match_from, match_to, match_subject, action, forward_to, label, is_catch_all, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    )
      .bind(
        id,
        user.id,
        name,
        (body.match_from ?? "").trim().toLowerCase(),
        (body.match_to ?? "").trim().toLowerCase(),
        (body.match_subject ?? "").trim().toLowerCase(),
        action,
        extractEmail(body.forward_to ?? ""),
        (body.label ?? "").trim(),
        isCatchAll ? 1 : 0,
        nowMs(),
      )
      .run();
    return c.json({ filter: { id, name, action } }, 201);
  });

  app.post("/api/filters/:id/toggle", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const row = await c.env.DB.prepare("SELECT enabled FROM filters WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .first<{ enabled: number }>();
    if (!row) return c.json({ error: "Filter not found." }, 404);
    const next = row.enabled ? 0 : 1;
    await c.env.DB.prepare("UPDATE filters SET enabled = ? WHERE id = ? AND user_id = ?")
      .bind(next, c.req.param("id"), user.id)
      .run();
    return c.json({ ok: true, enabled: next });
  });

  app.delete("/api/filters/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM filters WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Filter not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/blocked", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare("SELECT id, address, created_at FROM blocked_senders WHERE user_id = ? ORDER BY created_at DESC")
      .bind(user.id)
      .all();
    return c.json({ blocked: rows.results ?? [] });
  });

  app.post("/api/blocked", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { address?: string };
    const address = extractEmail(body.address ?? "");
    if (!EMAIL_RE.test(address)) return c.json({ error: "Enter a valid email address." }, 400);
    const id = randomId("blk");
    try {
      await c.env.DB.prepare("INSERT INTO blocked_senders (id, user_id, address, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, user.id, address, nowMs())
        .run();
    } catch {
      return c.json({ error: "That sender is already blocked." }, 409);
    }
    return c.json({ blocked: { id, address } }, 201);
  });

  app.delete("/api/blocked/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM blocked_senders WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Blocked sender not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/keys", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    let keys: Array<{
      id: string;
      name: string;
      key_prefix: string;
      created_at: number;
      last_used_at: number | null;
      mode: string;
    }> = [];
    try {
      const rows = await c.env.DB
        .prepare(
          "SELECT id, name, key_prefix, created_at, last_used_at, COALESCE(mode, 'live') AS mode FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
        )
        .bind(user.id)
        .all<{
          id: string;
          name: string;
          key_prefix: string;
          created_at: number;
          last_used_at: number | null;
          mode: string;
        }>();
      keys = rows.results ?? [];
    } catch {
      const rows = await c.env.DB
        .prepare("SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC")
        .bind(user.id)
        .all<{ id: string; name: string; key_prefix: string; created_at: number; last_used_at: number | null }>();
      keys = (rows.results ?? []).map((k) => ({ ...k, mode: "live" }));
    }
    const live = keys.filter((k) => k.mode !== "test").length;
    const test = keys.filter((k) => k.mode === "test").length;
    return c.json({ keys, counts: { live, test, total: keys.length } });
  });

  app.post("/api/keys", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; mode?: string };
    const name = (body.name ?? "").trim() || "Transactional";
    const mode = body.mode === "test" ? "test" : "live";
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?")
      .bind(user.id)
      .first<{ n: number }>();
    const limit = await assertWithinLimit(c.env.DB, user.id, "api_keys", Number(count?.n ?? 0));
    if (!limit.ok) return c.json({ error: limit.error }, limit.status);
    const token = mode === "test" ? `flap_test_${randomId("").slice(0, 28)}` : `flap_${randomId("").slice(0, 32)}`;
    const id = randomId("key");
    try {
      await c.env.DB.prepare(
        "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at, mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(id, user.id, name, await sha256Hex(token), token.slice(0, 12), nowMs(), mode)
        .run();
    } catch {
      // Pre-migration fallback (no mode column).
      await c.env.DB.prepare(
        "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, user.id, name, await sha256Hex(token), token.slice(0, 10), nowMs())
        .run();
    }
    return c.json({ key: { id, name, token, key_prefix: token.slice(0, 12), mode } }, 201);
  });

  app.delete("/api/keys/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "API key not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/settings/prefs", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    return c.json({ settings: await loadSettings(c.env.DB, user.id) });
  });

  app.put("/api/settings/prefs", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as {
      vacation_enabled?: boolean;
      vacation_body?: string;
      notify_browser?: boolean;
      undo_send_seconds?: number;
    };
    const now = nowMs();
    const current = await loadSettings(c.env.DB, user.id);
    const vacationEnabled =
      typeof body.vacation_enabled === "boolean" ? (body.vacation_enabled ? 1 : 0) : current.vacation_enabled;
    const vacationBody = typeof body.vacation_body === "string" ? body.vacation_body : current.vacation_body;
    const notifyBrowser =
      typeof body.notify_browser === "boolean" ? (body.notify_browser ? 1 : 0) : current.notify_browser;
    const undoSendSeconds =
      typeof body.undo_send_seconds === "number"
        ? Math.max(0, Math.min(60, Math.floor(body.undo_send_seconds)))
        : current.undo_send_seconds ?? 10;
    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, vacation_enabled, vacation_body, notify_browser, undo_send_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         vacation_enabled = excluded.vacation_enabled,
         vacation_body = excluded.vacation_body,
         notify_browser = excluded.notify_browser,
         undo_send_seconds = excluded.undo_send_seconds,
         updated_at = excluded.updated_at`,
    )
      .bind(user.id, vacationEnabled, vacationBody, notifyBrowser, undoSendSeconds, now)
      .run();
    return c.json({ ok: true });
  });

  app.get("/api/export", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const format = (c.req.query("format") || "json").toLowerCase();

    if (format === "mbox") {
      const messages = await c.env.DB
        .prepare(
          `SELECT from_addr, to_addr, cc_addr, subject, date_ms, text_body, html_body, rfc_message_id, created_at
           FROM messages WHERE user_id = ? ORDER BY date_ms ASC LIMIT 5000`,
        )
        .bind(user.id)
        .all<{
          from_addr: string;
          to_addr: string;
          cc_addr: string;
          subject: string;
          date_ms: number;
          text_body: string;
          html_body: string;
          rfc_message_id: string;
          created_at: number;
        }>();
      const chunks: string[] = [];
      for (const m of messages.results ?? []) {
        const fromAddr = extractEmail(m.from_addr) || "unknown@localhost";
        const when = new Date(m.date_ms || m.created_at || Date.now());
        const envelopeDate = when.toUTCString().replace(/,/g, "");
        const raw = buildRawMime({
          from: m.from_addr || fromAddr,
          to: m.to_addr || "",
          cc: m.cc_addr || undefined,
          subject: m.subject || "",
          text: m.text_body || "",
          html: m.html_body || undefined,
          messageId: m.rfc_message_id || undefined,
        });
        const escaped = raw.replace(/\r\n/g, "\n").replace(/^From /gm, ">From ");
        chunks.push(`From ${fromAddr} ${envelopeDate}\n${escaped}\n`);
      }
      return new Response(chunks.join("\n"), {
        headers: {
          "content-type": "application/mbox; charset=utf-8",
          "content-disposition": `attachment; filename="flap-mailbox.mbox"`,
        },
      });
    }

    const [messages, mailboxes, contacts, templates, signatures, filters, aliases] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, starred, snippet, label, thread_id, rfc_message_id, created_at
         FROM messages WHERE user_id = ? ORDER BY date_ms DESC LIMIT 5000`,
      )
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT address, display_name FROM mailboxes WHERE user_id = ?")
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT email, name FROM contacts WHERE user_id = ?")
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT name, subject, html_body, text_body FROM templates WHERE user_id = ?")
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT name, html_body, text_body, is_default FROM signatures WHERE user_id = ?")
        .bind(user.id)
        .all(),
      c.env.DB.prepare(
        "SELECT name, match_from, match_to, match_subject, action, forward_to, label, is_catch_all FROM filters WHERE user_id = ?",
      )
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT address, label, disposable, expires_at FROM aliases WHERE user_id = ?")
        .bind(user.id)
        .all(),
    ]);
    const payload = {
      exported_at: new Date().toISOString(),
      version: 2,
      user: { email: user.email },
      mailboxes: mailboxes.results ?? [],
      contacts: contacts.results ?? [],
      templates: templates.results ?? [],
      signatures: signatures.results ?? [],
      filters: filters.results ?? [],
      aliases: aliases.results ?? [],
      messages: messages.results ?? [],
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="flap-backup.json"`,
      },
    });
  });

  app.post("/api/restore", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => null) as {
      contacts?: Array<{ email?: string; name?: string }>;
      templates?: Array<{ name?: string; subject?: string; html_body?: string; text_body?: string }>;
      signatures?: Array<{ name?: string; html_body?: string; text_body?: string; is_default?: number }>;
      filters?: Array<{
        name?: string;
        match_from?: string;
        match_to?: string;
        match_subject?: string;
        action?: string;
        forward_to?: string;
        label?: string;
        is_catch_all?: number;
      }>;
    } | null;
    if (!body || typeof body !== "object") return c.json({ error: "Upload a valid Flap backup JSON." }, 400);
    const now = nowMs();
    let restored = 0;
    for (const contact of body.contacts ?? []) {
      const email = extractEmail(contact.email ?? "");
      if (!EMAIL_RE.test(email)) continue;
      await touchContact(c.env.DB, user.id, email, (contact.name ?? "").trim());
      restored += 1;
    }
    for (const template of body.templates ?? []) {
      const name = (template.name ?? "").trim();
      if (!name) continue;
      await c.env.DB.prepare(
        "INSERT INTO templates (id, user_id, name, subject, html_body, text_body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(randomId("tpl"), user.id, name, template.subject ?? "", template.html_body ?? "", template.text_body ?? "", now, now)
        .run();
      restored += 1;
    }
    for (const signature of body.signatures ?? []) {
      const name = (signature.name ?? "").trim();
      if (!name) continue;
      await c.env.DB.prepare(
        "INSERT INTO signatures (id, user_id, name, html_body, text_body, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(randomId("sig"), user.id, name, signature.html_body ?? "", signature.text_body ?? "", signature.is_default ? 1 : 0, now)
        .run();
      restored += 1;
    }
    for (const filter of body.filters ?? []) {
      const name = (filter.name ?? "").trim();
      const action = (filter.action ?? "").toLowerCase();
      if (!name || !FILTER_ACTIONS.has(action)) continue;
      await c.env.DB.prepare(
        `INSERT INTO filters
          (id, user_id, name, match_from, match_to, match_subject, action, forward_to, label, is_catch_all, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
        .bind(
          randomId("flt"),
          user.id,
          name,
          (filter.match_from ?? "").toLowerCase(),
          (filter.match_to ?? "").toLowerCase(),
          (filter.match_subject ?? "").toLowerCase(),
          action,
          filter.forward_to ?? "",
          filter.label ?? "",
          filter.is_catch_all ? 1 : 0,
          now,
        )
        .run();
      restored += 1;
    }
    return c.json({ ok: true, restored });
  });

  app.get("/api/aliases", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare(
      `SELECT id, mailbox_id, domain_id, local_part, address, label, disposable, expires_at, enabled, created_at
       FROM aliases WHERE user_id = ? ORDER BY created_at DESC`,
    )
      .bind(user.id)
      .all();
    return c.json({ aliases: rows.results ?? [] });
  });

  app.post("/api/aliases", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as {
      mailbox_id?: string;
      local_part?: string;
      label?: string;
      disposable?: boolean;
      expires_at?: number | null;
    };
    const local = (body.local_part ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._+-]{1,64}$/.test(local)) return c.json({ error: "Alias local-part is invalid." }, 400);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM aliases WHERE user_id = ?")
      .bind(user.id)
      .first<{ n: number }>();
    const limit = await assertWithinLimit(c.env.DB, user.id, "aliases", Number(count?.n ?? 0));
    if (!limit.ok) return c.json({ error: limit.error }, limit.status);
    const mailbox = await c.env.DB.prepare(
      "SELECT id, domain_id FROM mailboxes WHERE id = ? AND user_id = ?",
    )
      .bind(body.mailbox_id ?? "", user.id)
      .first<{ id: string; domain_id: string }>();
    if (!mailbox) return c.json({ error: "Choose a destination mailbox." }, 400);
    const domain = await c.env.DB.prepare("SELECT id, name FROM domains WHERE id = ? AND user_id = ?")
      .bind(mailbox.domain_id, user.id)
      .first<{ id: string; name: string }>();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
    const address = `${local}@${domain.name}`;
    const id = randomId("als");
    const expiresAt = body.disposable
      ? (typeof body.expires_at === "number" ? body.expires_at : nowMs() + 7 * 24 * 60 * 60 * 1000)
      : null;
    try {
      await c.env.DB.prepare(
        `INSERT INTO aliases
          (id, user_id, mailbox_id, domain_id, local_part, address, label, disposable, expires_at, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
        .bind(id, user.id, mailbox.id, domain.id, local, address, (body.label ?? "").trim(), body.disposable ? 1 : 0, expiresAt, nowMs())
        .run();
    } catch {
      return c.json({ error: "That alias address already exists." }, 409);
    }
    return c.json({ alias: { id, address, mailbox_id: mailbox.id, disposable: body.disposable ? 1 : 0, expires_at: expiresAt } }, 201);
  });

  app.delete("/api/aliases/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM aliases WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Alias not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/webhooks", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const rows = await c.env.DB.prepare(
      "SELECT id, name, url, events, enabled, created_at, last_triggered_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(user.id)
      .all();
    return c.json({ webhooks: rows.results ?? [] });
  });

  app.post("/api/webhooks", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string; url?: string; events?: string };
    const name = (body.name ?? "").trim() || "Inbound hook";
    const url = (body.url ?? "").trim();
    if (!/^https:\/\//i.test(url)) return c.json({ error: "Webhook URL must be https." }, 400);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM webhooks WHERE user_id = ?")
      .bind(user.id)
      .first<{ n: number }>();
    const limit = await assertWithinLimit(c.env.DB, user.id, "webhooks", Number(count?.n ?? 0));
    if (!limit.ok) return c.json({ error: limit.error }, limit.status);
    const id = randomId("wh");
    const secret = randomId("sec").slice(0, 32);
    const events = (body.events ?? "mail.received").trim() || "mail.received";
    await c.env.DB.prepare(
      "INSERT INTO webhooks (id, user_id, name, url, secret, events, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    )
      .bind(id, user.id, name, url, secret, events, nowMs())
      .run();
    return c.json({ webhook: { id, name, url, events, secret } }, 201);
  });

  app.post("/api/webhooks/:id/toggle", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const row = await c.env.DB.prepare("SELECT enabled FROM webhooks WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .first<{ enabled: number }>();
    if (!row) return c.json({ error: "Webhook not found." }, 404);
    const next = row.enabled ? 0 : 1;
    await c.env.DB.prepare("UPDATE webhooks SET enabled = ? WHERE id = ? AND user_id = ?")
      .bind(next, c.req.param("id"), user.id)
      .run();
    return c.json({ ok: true, enabled: next });
  });

  app.delete("/api/webhooks/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const res = await c.env.DB.prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), user.id)
      .run();
    if (!res.meta.changes) return c.json({ error: "Webhook not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/webhooks/:id/deliveries", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const hookId = c.req.param("id");
    const hook = await c.env.DB.prepare("SELECT id FROM webhooks WHERE id = ? AND user_id = ?")
      .bind(hookId, user.id)
      .first<{ id: string }>();
    if (!hook) return c.json({ error: "Webhook not found." }, 404);
    const rows = await c.env.DB
      .prepare(
        `SELECT id, webhook_id, event, status_code, ok, error, created_at,
                COALESCE(payload_json, '') AS payload_json
         FROM webhook_deliveries
         WHERE webhook_id = ?
         ORDER BY created_at DESC
         LIMIT 20`,
      )
      .bind(hookId)
      .all()
      .catch(async () =>
        c.env.DB
          .prepare(
            `SELECT id, webhook_id, event, status_code, ok, error, created_at, '' AS payload_json
             FROM webhook_deliveries
             WHERE webhook_id = ?
             ORDER BY created_at DESC
             LIMIT 20`,
          )
          .bind(hookId)
          .all(),
      );
    return c.json({ deliveries: rows.results ?? [] });
  });

  app.post("/api/webhooks/:id/redeliver", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const hookId = c.req.param("id");
    const hook = await c.env.DB
      .prepare("SELECT id, url, secret FROM webhooks WHERE id = ? AND user_id = ?")
      .bind(hookId, user.id)
      .first<{ id: string; url: string; secret: string }>();
    if (!hook) return c.json({ error: "Webhook not found." }, 404);
    const bodyJson = await c.req.json().catch(() => ({})) as { delivery_id?: string };
    let last = bodyJson.delivery_id
      ? await c.env.DB
          .prepare(
            `SELECT id, event, COALESCE(payload_json, '') AS payload_json
             FROM webhook_deliveries WHERE id = ? AND webhook_id = ?`,
          )
          .bind(bodyJson.delivery_id, hookId)
          .first<{ id: string; event: string; payload_json: string }>()
      : await c.env.DB
          .prepare(
            `SELECT id, event, COALESCE(payload_json, '') AS payload_json
             FROM webhook_deliveries WHERE webhook_id = ?
             ORDER BY created_at DESC LIMIT 1`,
          )
          .bind(hookId)
          .first<{ id: string; event: string; payload_json: string }>();
    if (!last) return c.json({ error: "No deliveries to redeliver yet." }, 404);
    let body = last.payload_json?.trim() || "";
    if (!body) {
      body = JSON.stringify({
        event: last.event,
        at: new Date().toISOString(),
        redelivery: true,
        note: "Original payload was not stored; this is a synthetic redelivery envelope.",
      });
    } else {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        body = JSON.stringify({ ...parsed, redelivery: true, redelivered_from: last.id });
      } catch {
        // keep raw body
      }
    }
    let statusCode: number | null = null;
    let ok = false;
    let error = "";
    try {
      const signature = await sha256Hex(`${hook.secret}.${body}`);
      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flap-event": last.event,
          "x-flap-signature": signature,
          "x-flap-redelivery": "1",
        },
        body,
      });
      statusCode = res.status;
      ok = res.ok;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    await c.env.DB.prepare("UPDATE webhooks SET last_triggered_at = ? WHERE id = ?")
      .bind(nowMs(), hook.id)
      .run();
    await recordWebhookDelivery(c.env.DB, hook.id, last.event, statusCode, ok, error, body);
    return c.json({ ok, status_code: statusCode, error: error || undefined, redelivered_from: last.id });
  });

  app.get("/api/team", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const { plan_id, limits } = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const members = await c.env.DB.prepare(
      `SELECT wm.user_id, wm.role, wm.created_at, u.email, u.name
       FROM workspace_members wm
       JOIN users u ON u.id = wm.user_id
       WHERE wm.workspace_id = ?
       ORDER BY CASE wm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, wm.created_at ASC`,
    )
      .bind(ctx.workspaceId)
      .all();
    const invites = await c.env.DB.prepare(
      `SELECT id, email, role, status, created_at, expires_at, token, mailbox_ids
       FROM workspace_invites
       WHERE workspace_id = ? OR (workspace_id IS NULL AND invited_by = ?)
       ORDER BY created_at DESC`,
    )
      .bind(ctx.workspaceId, ctx.workspaceId)
      .all();
    const shared = await c.env.DB.prepare(
      `SELECT m.id, m.address, m.display_name, m.is_shared,
              (SELECT GROUP_CONCAT(mm.user_id) FROM mailbox_members mm WHERE mm.mailbox_id = m.id) AS member_ids
       FROM mailboxes m
       WHERE m.user_id = ? AND m.is_shared = 1
       ORDER BY m.created_at ASC`,
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({
      deferred: false,
      teams_unlocked: limits.team_seats > 1,
      plan_id,
      limits: { team_seats: limits.team_seats },
      workspace: {
        id: ctx.workspaceId,
        role: ctx.role,
        can_manage_team: ctx.canManageTeam,
      },
      members: members.results ?? [],
      invites: (invites.results ?? []).map((inv) => ({
        ...inv,
        accept_path: inv.token ? `/invite/${inv.token}` : null,
      })),
      shared_mailboxes: shared.results ?? [],
    });
  });

  app.post("/api/team/invites", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = await c.req.json().catch(() => ({})) as {
      email?: string;
      role?: string;
      mailbox_ids?: string[];
    };
    const result = await createInvite(c.env.DB, ctx, {
      email: body.email ?? "",
      role: body.role,
      mailbox_ids: body.mailbox_ids,
    });
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ invite: result.invite, deferred: false }, 201);
  });

  app.post("/api/team/invites/:token/accept", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const result = await acceptInvite(c.env.DB, c.req.param("token"), user.id);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ ok: true, workspace_id: result.workspace_id });
  });

  app.get("/api/team/invites/:token", async (c) => {
    const invite = await c.env.DB.prepare(
      `SELECT i.id, i.email, i.role, i.status, i.expires_at, i.workspace_id, u.email AS inviter_email
       FROM workspace_invites i
       LEFT JOIN users u ON u.id = i.invited_by
       WHERE i.token = ?`,
    )
      .bind(c.req.param("token"))
      .first();
    if (!invite) return c.json({ error: "Invite not found." }, 404);
    return c.json({ invite });
  });

  app.delete("/api/team/invites/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageTeam) return c.json({ error: "Forbidden." }, 403);
    const res = await c.env.DB.prepare(
      `UPDATE workspace_invites SET status = 'revoked'
       WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Invite not found." }, 404);
    return c.json({ ok: true });
  });

  app.delete("/api/team/members/:userId", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageTeam) return c.json({ error: "Forbidden." }, 403);
    const memberId = c.req.param("userId");
    if (memberId === ctx.workspaceId) {
      return c.json({ error: "Cannot remove the workspace owner." }, 400);
    }
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?").bind(
        ctx.workspaceId,
        memberId,
      ),
      c.env.DB.prepare(
        `DELETE FROM mailbox_members WHERE user_id = ? AND mailbox_id IN
         (SELECT id FROM mailboxes WHERE user_id = ?)`,
      ).bind(memberId, ctx.workspaceId),
    ]);
    return c.json({ ok: true });
  });

  app.post("/api/team/mailboxes/:id/share", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = await c.req.json().catch(() => ({})) as { is_shared?: boolean };
    const result = await setMailboxShared(c.env.DB, ctx, c.req.param("id"), body.is_shared !== false);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ ok: true });
  });

  app.post("/api/team/mailboxes/:id/members", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = await c.req.json().catch(() => ({})) as { user_id?: string; role?: string };
    if (!body.user_id) return c.json({ error: "user_id required." }, 400);
    const result = await grantMailboxMember(c.env.DB, ctx, c.req.param("id"), body.user_id, body.role);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ ok: true });
  });

  app.delete("/api/team/mailboxes/:id/members/:userId", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const result = await revokeMailboxMember(c.env.DB, ctx, c.req.param("id"), c.req.param("userId"));
    if (!result.ok) return c.json({ error: result.error }, result.status);
    return c.json({ ok: true });
  });

  app.post("/api/v1/send", async (c) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) return c.json({ error: "API key required." }, 401);
    const hashed = await sha256Hex(token);
    const key = await c.env.DB.prepare(
      "SELECT id, user_id, COALESCE(mode, 'live') AS mode FROM api_keys WHERE key_hash = ?",
    )
      .bind(hashed)
      .first<{ id: string; user_id: string; mode: string }>();
    if (!key) return c.json({ error: "Invalid API key." }, 401);
    await c.env.DB.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").bind(nowMs(), key.id).run();
    const body = await c.req.json().catch(() => ({})) as {
      from?: string;
      to?: string;
      cc?: string;
      bcc?: string;
      subject?: string;
      text?: string;
      html?: string;
    };
    const to = parseRecipients(body.to ?? "");
    if (!to.length) return c.json({ error: "Enter at least one recipient." }, 400);
    if (!(body.subject ?? "").trim()) return c.json({ error: "Subject is required." }, 400);
    const fromMailbox = body.from
      ? await c.env.DB.prepare("SELECT id, address FROM mailboxes WHERE user_id = ? AND lower(address) = ?")
          .bind(key.user_id, extractEmail(body.from))
          .first<{ id: string; address: string }>()
      : await c.env.DB.prepare("SELECT id, address FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
          .bind(key.user_id)
          .first<{ id: string; address: string }>();
    if (!fromMailbox) return c.json({ error: "Add a mailbox before sending." }, 400);

    // Test-mode keys never hit external providers — simulated success only.
    if (key.mode === "test" || token.startsWith("flap_test_")) {
      const id = randomId("sim");
      console.info("[api-key:test] simulated send", {
        key_id: key.id,
        user_id: key.user_id,
        from: fromMailbox.address,
        to: body.to,
        subject: body.subject,
        id,
      });
      return c.json({
        ok: true,
        id,
        simulated: true,
        mode: "test",
        message: "Test-mode send simulated; nothing was delivered externally.",
      });
    }

    if (!canSendMail(c.env)) {
      return c.json({ error: "Mail sending is not configured. Set MAILGUN_API_KEY or the SEB binding." }, 501);
    }
    const sendLimit = await assertSendRoom(c.env.DB, key.user_id);
    if (!sendLimit.ok) return c.json({ error: sendLimit.error }, sendLimit.status);
    const id = randomId("msg");
    const now = nowMs();
    const text = body.text ?? "";
    const html = body.html ?? "";
    const subject = (body.subject ?? "").trim();
    const toAddr = (body.to ?? "").trim();
    const ccAddr = (body.cc ?? "").trim();
    const bccAddr = (body.bcc ?? "").trim();
    const snippet = makeSnippet(text, html);
    const bodyBytes = messageStorageBytes({
      text_body: text,
      html_body: html,
      subject,
      snippet,
      from_addr: fromMailbox.address,
      to_addr: toAddr,
      cc_addr: ccAddr,
      bcc_addr: bccAddr,
    });
    const storageCheck = await assertStorageRoom(c.env.DB, key.user_id, bodyBytes);
    if (!storageCheck.ok) return c.json({ error: storageCheck.error }, storageCheck.status);
    const error = await dispatchStoredMessage(c.env, {
      id,
      user_id: key.user_id,
      mailbox_id: fromMailbox.id,
      from_addr: fromMailbox.address,
      to_addr: toAddr,
      cc_addr: ccAddr,
      bcc_addr: bccAddr,
      subject,
      text_body: text,
      html_body: html,
      in_reply_to: null,
    });
    if (error) return c.json({ error: `Outbound send failed: ${error}` }, 502);
    await c.env.DB.prepare(
      `INSERT INTO messages
        (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, snippet, storage_bytes, created_at)
       VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    )
      .bind(id, key.user_id, fromMailbox.id, fromMailbox.address, toAddr, ccAddr, bccAddr, subject, now, text, html, snippet, bodyBytes, now)
      .run();
    await recordOutboundSend(c.env.DB, key.user_id);
    await markFirstEmailSent(c.env.DB, key.user_id).catch(() => undefined);
    return c.json({ ok: true, id });
  });
}
