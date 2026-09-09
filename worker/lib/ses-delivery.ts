import { nowMs, randomId } from "./ids";
import { softBounceExpiresAt } from "../../shared/security-guards";
import {
  classifySesEventType,
  reputationWarning,
  shouldUnsubscribeNewsletter,
  shouldWriteWorkspaceSuppression,
  type SesDeliveryKind,
} from "../../shared/ses-delivery-events";

export type SesEventPayload = {
  notificationType?: string;
  eventType?: string;
  mail?: { messageId?: string; destination?: string[] };
  bounce?: { bouncedRecipients?: Array<{ emailAddress?: string }>; bounceType?: string };
  complaint?: { complainedRecipients?: Array<{ emailAddress?: string }> };
  reject?: { reason?: string };
};

export type ProcessSesEventResult = {
  processed: number;
  skipped_duplicate: number;
  unattributed: number;
};

export async function resolveOutboundOwner(
  db: D1Database,
  providerMessageId?: string | null,
): Promise<string | null> {
  const mid = (providerMessageId || "").trim();
  if (!mid) return null;
  const row = await db
    .prepare("SELECT user_id FROM messages WHERE provider_message_id = ? LIMIT 1")
    .bind(mid)
    .first<{ user_id: string }>();
  return row?.user_id || null;
}

export async function recordDeliveryEvent(
  db: D1Database,
  opts: {
    recipientEmail: string;
    kind: string;
    provider: string;
    providerMessageId: string;
    now: number;
    metaJson?: string;
  },
): Promise<"inserted" | "duplicate"> {
  const mid = opts.providerMessageId || "";
  if (mid) {
    const existing = await db
      .prepare(
        `SELECT id FROM delivery_event_log
         WHERE provider_message_id = ? AND recipient_email = ? AND kind = ?
         LIMIT 1`,
      )
      .bind(mid, opts.recipientEmail, opts.kind)
      .first<{ id: string }>();
    if (existing) return "duplicate";
  }

  let userId = (await resolveOutboundOwner(db, opts.providerMessageId)) || "";
  let domainId = "";
  if (userId) {
    const fromMsg = await db
      .prepare(
        `SELECT m.mailbox_id, mb.domain_id
         FROM messages m
         LEFT JOIN mailboxes mb ON mb.id = m.mailbox_id
         WHERE m.provider_message_id = ? AND m.user_id = ?
         LIMIT 1`,
      )
      .bind(opts.providerMessageId, userId)
      .first<{ mailbox_id: string | null; domain_id: string | null }>();
    domainId = fromMsg?.domain_id || "";
  }

  try {
    await db
      .prepare(
        `INSERT INTO delivery_event_log
         (id, user_id, domain_id, recipient_email, kind, provider, provider_message_id, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        randomId("deliv"),
        userId,
        domainId,
        opts.recipientEmail,
        opts.kind,
        opts.provider,
        opts.providerMessageId,
        opts.metaJson || "",
        opts.now,
      )
      .run();
  } catch {
    return "duplicate";
  }

  if (userId && domainId && (opts.kind === "bounce" || opts.kind === "soft_bounce" || opts.kind === "complaint" || opts.kind === "delivery")) {
    const day = new Date(opts.now).toISOString().slice(0, 10);
    const kind = opts.kind === "soft_bounce" ? "bounce" : opts.kind;
    await db
      .prepare(
        `INSERT INTO deliverability_events (id, user_id, domain_id, kind, count, day, meta_json)
         VALUES (?, ?, ?, ?, 1, ?, '')
         ON CONFLICT(domain_id, kind, day) DO UPDATE SET count = count + 1`,
      )
      .bind(randomId("de"), userId, domainId, kind, day)
      .run()
      .catch(() => undefined);
  }

  if (userId) {
    await maybeFlagReputation(db, userId, opts.now);
  }

  return "inserted";
}

export async function upsertSuppression(
  db: D1Database,
  opts: {
    userId: string;
    email: string;
    reason: string;
    source: string;
    providerMessageId?: string;
    now: number;
  },
): Promise<void> {
  if (!opts.userId) return;
  const expiresAt = opts.reason === "soft_bounce" ? softBounceExpiresAt(opts.now) : null;
  const existing = await db
    .prepare("SELECT id FROM mail_suppressions WHERE user_id = ? AND email = ?")
    .bind(opts.userId, opts.email)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare(
        "UPDATE mail_suppressions SET reason = ?, source = ?, provider_message_id = ?, expires_at = ? WHERE id = ? AND user_id = ?",
      )
      .bind(opts.reason, opts.source, opts.providerMessageId || null, expiresAt, existing.id, opts.userId)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO mail_suppressions (id, user_id, email, reason, source, provider_message_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      randomId("sup"),
      opts.userId,
      opts.email,
      opts.reason,
      opts.source,
      opts.providerMessageId || null,
      opts.now,
      expiresAt,
    )
    .run();
}

export async function processSesConfigurationEvent(
  db: D1Database,
  event: SesEventPayload,
  now = nowMs(),
): Promise<ProcessSesEventResult> {
  const type = event.notificationType || event.eventType || "";
  const bounceType = event.bounce?.bounceType || null;
  let kind = classifySesEventType(type, bounceType);
  if (!kind) return { processed: 0, skipped_duplicate: 0, unattributed: 0 };

  const mid = event.mail?.messageId || "";
  const recipients = recipientsForEvent(event, kind);
  const result: ProcessSesEventResult = { processed: 0, skipped_duplicate: 0, unattributed: 0 };

  for (const email of recipients) {
    const owner = await resolveOutboundOwner(db, mid);
    if (!owner) result.unattributed += 1;

    if (shouldWriteWorkspaceSuppression(kind) && owner) {
      await upsertSuppression(db, {
        userId: owner,
        email,
        reason: kind === "soft_bounce" ? "soft_bounce" : kind === "complaint" ? "complaint" : "bounce",
        source: "ses",
        providerMessageId: mid,
        now,
      });
    }

    const write = await recordDeliveryEvent(db, {
      recipientEmail: email,
      kind,
      provider: "ses",
      providerMessageId: mid,
      now,
    });
    if (write === "duplicate") {
      result.skipped_duplicate += 1;
      continue;
    }
    result.processed += 1;

    if (shouldUnsubscribeNewsletter(kind) && owner) {
      await db
        .prepare(
          `UPDATE newsletter_subscribers
           SET status = 'unsubscribed', unsubscribed_at = ?
           WHERE user_id = ? AND email = ? AND status != 'unsubscribed'`,
        )
        .bind(now, owner, email)
        .run()
        .catch(() => undefined);
    }
  }

  return result;
}

function recipientsForEvent(event: SesEventPayload, kind: SesDeliveryKind): string[] {
  if (kind === "bounce" || kind === "soft_bounce") {
    return (event.bounce?.bouncedRecipients ?? [])
      .map((r) => (r.emailAddress || "").trim().toLowerCase())
      .filter(Boolean);
  }
  if (kind === "complaint") {
    return (event.complaint?.complainedRecipients ?? [])
      .map((r) => (r.emailAddress || "").trim().toLowerCase())
      .filter(Boolean);
  }
  return (event.mail?.destination ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function maybeFlagReputation(db: D1Database, userId: string, now: number): Promise<void> {
  const since = now - 30 * 86400_000;
  const counts = await db
    .prepare(
      `SELECT kind, COUNT(*) AS n FROM delivery_event_log
       WHERE user_id = ? AND created_at >= ? GROUP BY kind`,
    )
    .bind(userId, since)
    .all<{ kind: string; n: number }>()
    .catch(() => ({ results: [] as Array<{ kind: string; n: number }> }));
  const byKind: Record<string, number> = {};
  for (const row of counts.results ?? []) byKind[row.kind] = Number(row.n) || 0;
  const bounce = (byKind.bounce || 0) + (byKind.soft_bounce || 0);
  const complaint = byKind.complaint || 0;
  const delivery = byKind.delivery || 0;
  const warn = reputationWarning(bounce, complaint, delivery);
  if (warn.bounce_warn || warn.complaint_warn) {
    await db
      .prepare("UPDATE users SET reputation_warning_at = ? WHERE id = ? AND reputation_warning_at IS NULL")
      .bind(now, userId)
      .run()
      .catch(() => undefined);
  }
}
