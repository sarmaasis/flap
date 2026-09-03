import type { Hono } from "hono";
import { EmailMessage } from "cloudflare:email";
import { requireUser } from "./auth";
import { randomId, nowMs } from "./ids";
import { buildRawMime } from "./mime";
import {
  EMAIL_RE,
  extractEmail,
  extractName,
  makeSnippet,
  parseRecipients,
  sha256Hex,
} from "./mailutil";

type App = { Bindings: Env };

export type InboundPolicy = { folder: string; starred: number };

const FILTER_ACTIONS = new Set(["archive", "spam", "trash", "star", "inbox"]);

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
  if (blocked) return { folder: "spam", starred: 0 };

  const filters = await db
    .prepare("SELECT match_from, match_to, match_subject, action FROM filters WHERE user_id = ? AND enabled = 1 ORDER BY created_at ASC")
    .bind(userId)
    .all<{ match_from: string; match_to: string; match_subject: string; action: string }>();

  for (const filter of filters.results ?? []) {
    if (filter.match_from && !from.includes(filter.match_from.toLowerCase())) continue;
    if (filter.match_to && !parsed.to.toLowerCase().includes(filter.match_to.toLowerCase())) continue;
    if (filter.match_subject && !parsed.subject.toLowerCase().includes(filter.match_subject.toLowerCase())) continue;
    if (!filter.match_from && !filter.match_to && !filter.match_subject) continue;
    if (filter.action === "star") return { folder: "inbox", starred: 1 };
    if (filter.action === "archive") return { folder: "archive", starred: 0 };
    if (filter.action === "spam" || filter.action === "trash" || filter.action === "inbox") {
      return { folder: filter.action, starred: 0 };
    }
  }
  return { folder: "inbox", starred: 0 };
}

export async function loadSettings(db: D1Database, userId: string) {
  return (
    (await db
      .prepare("SELECT vacation_enabled, vacation_body FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<{ vacation_enabled: number; vacation_body: string }>()) ?? {
      vacation_enabled: 0,
      vacation_body: "",
    }
  );
}

export async function maybeVacationReply(
  env: Env,
  userId: string,
  fromMailbox: string,
  toAddress: string,
): Promise<void> {
  if (!env.SEB) return;
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
  const now = nowMs();
  const raw = buildRawMime({
    from: fromMailbox,
    to: email,
    subject: "Automatic reply",
    text: settings.vacation_body,
  });
  try {
    await env.SEB.send(new EmailMessage(fromMailbox, email, raw));
    await env.DB.prepare(
      `INSERT INTO vacation_replies (user_id, address, sent_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, address) DO UPDATE SET sent_at = excluded.sent_at`,
    )
      .bind(userId, email, now)
      .run();
  } catch (error) {
    console.warn("Vacation reply failed", error);
  }
}

type StoredMessage = {
  id: string;
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

async function loadAttachmentContents(env: Env, messageId: string) {
  const rows = await env.DB.prepare(
    "SELECT r2_key, filename, content_type FROM attachments WHERE message_id = ?",
  )
    .bind(messageId)
    .all<{ r2_key: string; filename: string; content_type: string }>();
  const files: Array<{ filename: string; contentType: string; content: Uint8Array }> = [];
  if (!env.INLET_ATTACHMENTS) return files;
  for (const row of rows.results ?? []) {
    const obj = await env.INLET_ATTACHMENTS.get(row.r2_key);
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
  if (!env.SEB) return "The send_email binding (SEB) is not configured.";
  const to = parseRecipients(message.to_addr);
  const cc = message.cc_addr ? parseRecipients(message.cc_addr) : [];
  const bcc = message.bcc_addr ? parseRecipients(message.bcc_addr) : [];
  const recipients = [...new Set([...to, ...cc, ...bcc])];
  if (!recipients.length) return "No valid recipients.";
  const attachments = await loadAttachmentContents(env, message.id);
  const envelopeFrom = extractEmail(message.from_addr) || message.from_addr;
  const domain = envelopeFrom.split("@")[1] || "inlet.local";
  const raw = buildRawMime({
    from: message.from_addr,
    to: message.to_addr,
    cc: message.cc_addr || undefined,
    subject: message.subject,
    text: message.text_body,
    html: message.html_body || undefined,
    attachments,
    messageId: `<${message.id}@${domain}>`,
    inReplyTo: message.in_reply_to || undefined,
  });
  try {
    await Promise.all(recipients.map((recipient) => env.SEB!.send(new EmailMessage(envelopeFrom, recipient, raw))));
  } catch (err) {
    return err instanceof Error ? err.message : "send failed";
  }
  return null;
}

export async function flushScheduled(env: Env): Promise<void> {
  const now = nowMs();
  const due = await env.DB.prepare(
    `SELECT id, mailbox_id, from_addr, to_addr, cc_addr, bcc_addr, subject, text_body, html_body, in_reply_to
     FROM messages
     WHERE folder = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
     ORDER BY scheduled_at ASC
     LIMIT 15`,
  )
    .bind(now)
    .all<StoredMessage>();
  for (const message of due.results ?? []) {
    const error = await dispatchStoredMessage(env, message);
    if (error) {
      console.warn("Scheduled send failed", message.id, error);
      continue;
    }
    await env.DB.prepare("UPDATE messages SET folder = 'sent', scheduled_at = NULL, date_ms = ?, unread = 0 WHERE id = ?")
      .bind(now, message.id)
      .run();
  }
}

export async function folderCounts(db: D1Database, userId: string) {
  const now = nowMs();
  const rows = await db
    .prepare(
      `SELECT folder,
              COUNT(*) AS total,
              SUM(CASE WHEN unread = 1 THEN 1 ELSE 0 END) AS unread
       FROM messages
       WHERE user_id = ? AND (snooze_until IS NULL OR snooze_until <= ?)
       GROUP BY folder`,
    )
    .bind(userId, now)
    .all<{ folder: string; total: number; unread: number }>();
  const counts: Record<string, { total: number; unread: number }> = {};
  for (const row of rows.results ?? []) {
    counts[row.folder] = { total: Number(row.total), unread: Number(row.unread) };
  }
  const starred = await db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND starred = 1 AND folder NOT IN ('trash', 'spam')")
    .bind(userId)
    .first<{ n: number }>();
  const snoozed = await db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE user_id = ? AND snooze_until > ?")
    .bind(userId, now)
    .first<{ n: number }>();
  counts.starred = { total: Number(starred?.n ?? 0), unread: 0 };
  counts.snoozed = { total: Number(snoozed?.n ?? 0), unread: 0 };
  return counts;
}

export function registerWorkspaceRoutes(app: Hono<App>) {
  app.get("/api/bootstrap", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const now = nowMs();
    await flushScheduled(c.env).catch((error) => console.warn("flushScheduled", error));
    const [mailboxes, signatures, templates, contacts, settings] = await Promise.all([
      c.env.DB.prepare(
        "SELECT id, domain_id, local_part, address, display_name, created_at FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC",
      )
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT id, name, html_body, text_body, is_default, created_at FROM signatures WHERE user_id = ? ORDER BY is_default DESC, created_at ASC")
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT id, name, subject, html_body, text_body, created_at, updated_at FROM templates WHERE user_id = ? ORDER BY updated_at DESC")
        .bind(user.id)
        .all(),
      c.env.DB.prepare("SELECT id, email, name, last_used_at FROM contacts WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 200")
        .bind(user.id)
        .all(),
      loadSettings(c.env.DB, user.id),
    ]);
    const counts = await folderCounts(c.env.DB, user.id);
    return c.json({
      user: { id: user.id, email: user.email, created_at: user.created_at },
      mailboxes: mailboxes.results ?? [],
      signatures: signatures.results ?? [],
      templates: templates.results ?? [],
      contacts: contacts.results ?? [],
      settings,
      counts,
      server_time: now,
    });
  });

  app.get("/api/counts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    await flushScheduled(c.env).catch(() => undefined);
    return c.json({ counts: await folderCounts(c.env.DB, user.id), server_time: nowMs() });
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
    };
    const name = (body.name ?? "").trim();
    const action = (body.action ?? "").toLowerCase();
    if (!name) return c.json({ error: "Name is required." }, 400);
    if (!FILTER_ACTIONS.has(action)) return c.json({ error: "Choose archive, spam, trash, star, or inbox." }, 400);
    const id = randomId("flt");
    await c.env.DB.prepare(
      "INSERT INTO filters (id, user_id, name, match_from, match_to, match_subject, action, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    )
      .bind(id, user.id, name, (body.match_from ?? "").trim().toLowerCase(), (body.match_to ?? "").trim().toLowerCase(), (body.match_subject ?? "").trim().toLowerCase(), action, nowMs())
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
    const rows = await c.env.DB.prepare("SELECT id, name, key_prefix, created_at, last_used_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC")
      .bind(user.id)
      .all();
    return c.json({ keys: rows.results ?? [] });
  });

  app.post("/api/keys", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = await c.req.json().catch(() => ({})) as { name?: string };
    const name = (body.name ?? "").trim() || "Transactional";
    const token = `inl_${randomId("").slice(0, 32)}`;
    const id = randomId("key");
    await c.env.DB.prepare(
      "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, user.id, name, await sha256Hex(token), token.slice(0, 10), nowMs())
      .run();
    return c.json({ key: { id, name, token, key_prefix: token.slice(0, 10) } }, 201);
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
    const body = await c.req.json().catch(() => ({})) as { vacation_enabled?: boolean; vacation_body?: string };
    const now = nowMs();
    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, vacation_enabled, vacation_body, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET vacation_enabled = excluded.vacation_enabled, vacation_body = excluded.vacation_body, updated_at = excluded.updated_at`,
    )
      .bind(user.id, body.vacation_enabled ? 1 : 0, body.vacation_body ?? "", now)
      .run();
    return c.json({ ok: true });
  });

  app.get("/api/export", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const [messages, mailboxes, contacts, templates, signatures] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, starred, snippet, created_at
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
    ]);
    const payload = {
      exported_at: new Date().toISOString(),
      user: { email: user.email },
      mailboxes: mailboxes.results ?? [],
      contacts: contacts.results ?? [],
      templates: templates.results ?? [],
      signatures: signatures.results ?? [],
      messages: messages.results ?? [],
    };
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="inlet-backup.json"`,
      },
    });
  });

  app.post("/api/v1/send", async (c) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (!token) return c.json({ error: "API key required." }, 401);
    const hashed = await sha256Hex(token);
    const key = await c.env.DB.prepare(
      "SELECT id, user_id FROM api_keys WHERE key_hash = ?",
    )
      .bind(hashed)
      .first<{ id: string; user_id: string }>();
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
    if (!c.env.SEB) return c.json({ error: "The send_email binding is not configured." }, 501);
    const id = randomId("msg");
    const now = nowMs();
    const text = body.text ?? "";
    const html = body.html ?? "";
    const error = await dispatchStoredMessage(c.env, {
      id,
      mailbox_id: fromMailbox.id,
      from_addr: fromMailbox.address,
      to_addr: (body.to ?? "").trim(),
      cc_addr: (body.cc ?? "").trim(),
      bcc_addr: (body.bcc ?? "").trim(),
      subject: (body.subject ?? "").trim(),
      text_body: text,
      html_body: html,
      in_reply_to: null,
    });
    if (error) return c.json({ error: `Outbound send failed: ${error}` }, 502);
    await c.env.DB.prepare(
      `INSERT INTO messages
        (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, snippet, created_at)
       VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    )
      .bind(id, key.user_id, fromMailbox.id, fromMailbox.address, body.to ?? "", body.cc ?? "", body.bcc ?? "", body.subject ?? "", now, text, html, makeSnippet(text, html), now)
      .run();
    return c.json({ ok: true, id });
  });
}
