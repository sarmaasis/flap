import { Hono } from "hono";
import { ingestRawEmail } from "../email";
import { appOrigin } from "./system-email";
import { verifyMailgunWebhook, verifySesInboundSignature } from "./mail-provider";
import { nowMs, randomId } from "./ids";
import { trackServerEvent } from "./analytics";

type App = { Bindings: Env };

/**
 * Inbound webhooks:
 * - Mailgun (legacy): store(notify=) → POST /api/inbound/mailgun
 * - SES (primary): Lambda posts raw MIME or S3 pointer → POST /api/inbound/ses
 * - SES events: bounce/complaint → POST /api/inbound/ses/events
 */
export function registerInboundWebhookRoutes(app: Hono<App>) {
  app.post("/api/inbound/mailgun", async (c) => {
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ error: "Expected multipart form body." }, 400);
    }

    const timestamp = String(form.get("timestamp") || "");
    const token = String(form.get("token") || "");
    const signature = String(form.get("signature") || "");
    const valid = await verifyMailgunWebhook(c.env, { timestamp, token, signature });
    if (!valid) {
      console.warn("Mailgun webhook signature rejected");
      return c.json({ error: "Invalid signature." }, 401);
    }

    if (timestamp) {
      const ts = Number(timestamp) * 1000;
      if (Number.isFinite(ts) && Math.abs(Date.now() - ts) > 15 * 60 * 1000) {
        return c.json({ error: "Stale webhook." }, 401);
      }
    }

    let rawBuf: ArrayBuffer | null = null;
    const bodyMime = form.get("body-mime");
    if (typeof bodyMime === "string" && bodyMime) {
      rawBuf = new TextEncoder().encode(bodyMime).buffer as ArrayBuffer;
    } else if (bodyMime && typeof bodyMime === "object" && "arrayBuffer" in bodyMime) {
      rawBuf = await (bodyMime as Blob).arrayBuffer();
    }

    if (!rawBuf) {
      const messageUrl = String(form.get("message-url") || "");
      if (messageUrl.startsWith("https://")) {
        const key = (c.env.MAILGUN_API_KEY || "").trim();
        const res = await fetch(messageUrl, {
          headers: key ? { Authorization: `Basic ${btoa(`api:${key}`)}` } : undefined,
        });
        if (res.ok) rawBuf = await res.arrayBuffer();
      }
    }

    if (!rawBuf || rawBuf.byteLength === 0) {
      return c.json({ error: "Missing body-mime." }, 400);
    }

    const recipient = String(form.get("recipient") || form.get("To") || "");
    const envelope = recipient
      ? recipient.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      : [];

    const providerMessageId = String(form.get("Message-Id") || form.get("message-id") || "").trim();
    const result = await ingestRawEmail(c.env, rawBuf, envelope, {
      provider: "mailgun",
      providerMessageId: providerMessageId || undefined,
      waitUntil: (p) => c.executionCtx.waitUntil(p),
    });
    if (!result.ok) {
      if (result.reason === "duplicate") return c.json({ ok: true, duplicate: true });
      if (result.reason === "no_mailbox") {
        return c.json({ error: "Recipient not configured in Flap.", reason: result.reason }, 406);
      }
      if (result.reason === "too_large" || result.reason === "quota" || result.reason === "domain_not_ready") {
        return c.json({ error: result.reason }, 406);
      }
      return c.json({ error: "Ingest failed.", reason: result.reason }, 500);
    }

    return c.json({ ok: true, id: result.messageId });
  });

  app.get("/api/inbound/mailgun", (c) => {
    return c.json({
      ok: true,
      webhook: `${appOrigin(c.env)}/api/inbound/mailgun`,
      note: "Legacy Mailgun Routes store(notify=). New domains use /api/inbound/ses.",
    });
  });

  /**
   * SES ingest from Lambda.
   * Body JSON:
   * {
   *   "provider_message_id": "ses-…",
   *   "recipients": ["hello@example.com"],
   *   "raw_mime_base64": "…",          // preferred for small mail
   *   "s3_bucket": "…", "s3_key": "…" // alternative pointer (Worker fetches if IAM allows)
   * }
   * Headers: X-Flap-Timestamp, X-Flap-Signature: sha256=<hex>
   * Signature = HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
   */
  app.post("/api/inbound/ses", async (c) => {
    const rawBody = await c.req.text();
    const timestamp = c.req.header("X-Flap-Timestamp") || "";
    const signature = c.req.header("X-Flap-Signature") || "";
    const valid = await verifySesInboundSignature(c.env, {
      body: rawBody,
      signature,
      timestamp,
    });
    if (!valid) {
      console.warn("SES inbound signature rejected");
      return c.json({ error: "Invalid signature." }, 401);
    }

    let payload: {
      provider_message_id?: string;
      recipients?: string[];
      raw_mime_base64?: string;
      raw_mime?: string;
      s3_bucket?: string;
      s3_key?: string;
    };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return c.json({ error: "Expected JSON body." }, 400);
    }

    const providerMessageId = (payload.provider_message_id || "").trim();
    if (!providerMessageId) {
      return c.json({ error: "provider_message_id required." }, 400);
    }

    let rawBuf: ArrayBuffer | null = null;
    if (payload.raw_mime_base64) {
      try {
        const bin = atob(payload.raw_mime_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        rawBuf = bytes.buffer;
      } catch {
        return c.json({ error: "Invalid raw_mime_base64." }, 400);
      }
    } else if (payload.raw_mime) {
      rawBuf = new TextEncoder().encode(payload.raw_mime).buffer as ArrayBuffer;
    } else if (payload.s3_bucket && payload.s3_key) {
      // Prefer Lambda to inline MIME; S3 fetch from Worker needs public URL or presign.
      // Documented: Lambda should send raw_mime_base64 for objects under ~4.5MB.
      console.warn("SES inbound S3 pointer without MIME", {
        bucket: payload.s3_bucket,
        key: payload.s3_key.slice(0, 120),
      });
      return c.json(
        {
          error: "s3_pointer_unsupported",
          detail: "Inline raw_mime_base64 (Lambda reads S3). See infra/ses-inbound.",
        },
        400,
      );
    }

    if (!rawBuf || rawBuf.byteLength === 0) {
      return c.json({ error: "Missing raw MIME." }, 400);
    }

    const envelope = (payload.recipients || []).map((s) => String(s).trim()).filter(Boolean);
    const result = await ingestRawEmail(c.env, rawBuf, envelope, {
      provider: "ses",
      providerMessageId,
      waitUntil: (p) => c.executionCtx.waitUntil(p),
    });

    if (!result.ok) {
      logInboundOutcome({
        provider: "ses",
        providerMessageId,
        outcome: result.reason,
        recipient: envelope[0],
      });
      if (result.reason === "duplicate") return c.json({ ok: true, duplicate: true });
      if (result.reason === "no_mailbox" || result.reason === "domain_not_ready") {
        return c.json({ error: "Recipient not configured or domain not receiving-ready.", reason: result.reason }, 406);
      }
      if (result.reason === "too_large" || result.reason === "quota") {
        return c.json({ error: result.reason }, 406);
      }
      return c.json({ error: "Ingest failed.", reason: result.reason }, 500);
    }

    logInboundOutcome({
      provider: "ses",
      providerMessageId,
      outcome: "stored",
      mailboxId: result.mailboxId,
      messageId: result.messageId,
      recipient: envelope[0],
    });

    // Mark first inbound / receiving activation without logging body.
    return c.json({ ok: true, id: result.messageId });
  });

  app.get("/api/inbound/ses", (c) => {
    return c.json({
      ok: true,
      webhook: `${appOrigin(c.env)}/api/inbound/ses`,
      note: "Lambda should POST signed JSON with provider_message_id + raw_mime_base64.",
    });
  });

  /** SES configuration-set event destination (SNS → HTTPS or Lambda forward). */
  app.post("/api/inbound/ses/events", async (c) => {
    const rawBody = await c.req.text();
    const timestamp = c.req.header("X-Flap-Timestamp") || "";
    const signature = c.req.header("X-Flap-Signature") || "";
    // SNS subscription confirmation is unsigned JSON with SubscribeURL — handle separately.
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return c.json({ error: "Expected JSON." }, 400);
    }

    if (parsed.Type === "SubscriptionConfirmation" && typeof parsed.SubscribeURL === "string") {
      await fetch(parsed.SubscribeURL).catch(() => undefined);
      return c.json({ ok: true, confirmed: true });
    }

    const valid = await verifySesInboundSignature(c.env, {
      body: rawBody,
      signature,
      timestamp: timestamp || undefined,
    });
    // Also accept SNS Notification wrapping Message JSON when secret unset in early ops.
    if (!valid && (c.env.SES_INBOUND_ALLOW_UNSIGNED || "").trim() !== "true" && parsed.Type !== "Notification") {
      return c.json({ error: "Invalid signature." }, 401);
    }

    const messageRaw =
      typeof parsed.Message === "string"
        ? parsed.Message
        : rawBody;
    let event: {
      notificationType?: string;
      eventType?: string;
      mail?: { messageId?: string; destination?: string[] };
      bounce?: { bouncedRecipients?: Array<{ emailAddress?: string }>; bounceType?: string };
      complaint?: { complainedRecipients?: Array<{ emailAddress?: string }> };
    };
    try {
      event = JSON.parse(messageRaw) as typeof event;
    } catch {
      event = parsed as typeof event;
    }

    const type = (event.notificationType || event.eventType || "").toLowerCase();
    const now = nowMs();

    if (type.includes("bounce")) {
      for (const r of event.bounce?.bouncedRecipients ?? []) {
        const email = (r.emailAddress || "").trim().toLowerCase();
        if (!email) continue;
        const reason = event.bounce?.bounceType === "Transient" ? "soft_bounce" : "bounce";
        await upsertSuppression(c.env.DB, {
          email,
          reason,
          source: "ses",
          providerMessageId: event.mail?.messageId,
          now,
        });
        await recordDeliveryEvent(c.env.DB, {
          recipientEmail: email,
          kind: reason === "soft_bounce" ? "soft_bounce" : "bounce",
          provider: "ses",
          providerMessageId: event.mail?.messageId || "",
          now,
        });
      }
      await trackServerEvent(c.env.DB, "ses_bounce_received", {
        props: { count: event.bounce?.bouncedRecipients?.length ?? 0 },
      });
    }

    if (type.includes("complaint")) {
      for (const r of event.complaint?.complainedRecipients ?? []) {
        const email = (r.emailAddress || "").trim().toLowerCase();
        if (!email) continue;
        await upsertSuppression(c.env.DB, {
          email,
          reason: "complaint",
          source: "ses",
          providerMessageId: event.mail?.messageId,
          now,
        });
        await recordDeliveryEvent(c.env.DB, {
          recipientEmail: email,
          kind: "complaint",
          provider: "ses",
          providerMessageId: event.mail?.messageId || "",
          now,
        });
      }
      await trackServerEvent(c.env.DB, "ses_complaint_received", {
        props: { count: event.complaint?.complainedRecipients?.length ?? 0 },
      });
    }

    return c.json({ ok: true });
  });
}

async function recordDeliveryEvent(
  db: D1Database,
  opts: {
    recipientEmail: string;
    kind: string;
    provider: string;
    providerMessageId: string;
    now: number;
  },
): Promise<void> {
  const domain = opts.recipientEmail.includes("@")
    ? opts.recipientEmail.split("@").pop()!.toLowerCase()
    : "";
  let userId = "";
  let domainId = "";
  if (domain) {
    const row = await db
      .prepare("SELECT id, user_id FROM domains WHERE lower(name) = ? LIMIT 1")
      .bind(domain)
      .first<{ id: string; user_id: string }>();
    if (row) {
      userId = row.user_id;
      domainId = row.id;
    }
  }
  await db
    .prepare(
      `INSERT INTO delivery_event_log
       (id, user_id, domain_id, recipient_email, kind, provider, provider_message_id, meta_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)`,
    )
    .bind(
      randomId("deliv"),
      userId,
      domainId,
      opts.recipientEmail,
      opts.kind,
      opts.provider,
      opts.providerMessageId,
      opts.now,
    )
    .run();

  if (userId && domainId) {
    const day = new Date(opts.now).toISOString().slice(0, 10);
    const kind = opts.kind === "soft_bounce" ? "bounce" : opts.kind;
    await db
      .prepare(
        `INSERT INTO deliverability_events (id, user_id, domain_id, kind, count, day, meta_json)
         VALUES (?, ?, ?, ?, 1, ?, '')
         ON CONFLICT(domain_id, kind, day) DO UPDATE SET count = count + 1`,
      )
      .bind(randomId("de"), userId, domainId, kind, day)
      .run();
  }
}

async function upsertSuppression(
  db: D1Database,
  opts: {
    email: string;
    reason: string;
    source: string;
    providerMessageId?: string;
    now: number;
  },
): Promise<void> {
  const existing = await db
    .prepare("SELECT id FROM mail_suppressions WHERE email = ?")
    .bind(opts.email)
    .first<{ id: string }>();
  if (existing) {
    await db
      .prepare("UPDATE mail_suppressions SET reason = ?, source = ?, provider_message_id = ? WHERE id = ?")
      .bind(opts.reason, opts.source, opts.providerMessageId || null, existing.id)
      .run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO mail_suppressions (id, email, reason, source, provider_message_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(randomId("sup"), opts.email, opts.reason, opts.source, opts.providerMessageId || null, opts.now)
    .run();
}

function logInboundOutcome(meta: {
  provider: string;
  providerMessageId: string;
  outcome: string;
  mailboxId?: string;
  messageId?: string;
  recipient?: string;
}): void {
  console.info(
    JSON.stringify({
      type: "inbound_ingest",
      provider: meta.provider,
      provider_message_id: meta.providerMessageId.slice(0, 200),
      outcome: meta.outcome,
      mailbox_id: meta.mailboxId || null,
      message_id: meta.messageId || null,
      recipient: meta.recipient ? meta.recipient.replace(/^(.).*(@.*)$/, "$1***$2") : null,
    }),
  );
}

export async function isAddressSuppressed(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM mail_suppressions
       WHERE email = ? AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .bind(email.toLowerCase(), nowMs())
    .first();
  return Boolean(row);
}
