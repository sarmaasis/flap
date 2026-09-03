import { Hono } from "hono";
import { createSession, destroySession, getSessionUser, requireUser, userCount, type UserRow } from "./lib/auth";
import { randomId, nowMs } from "./lib/ids";
import { hashPassword, verifyPassword } from "./lib/password";
import { handleEmail } from "./email";
import { EMAIL_RE, HEADER_VALUE_RE, makeSnippet, parseRecipients } from "./lib/mailutil";
import { dispatchStoredMessage, flushScheduled, normalizeMessageId, registerWorkspaceRoutes, touchContact } from "./lib/workspace";
import { assertWithinLimit, ensureSubscription, registerBillingRoutes } from "./lib/billing";

type App = { Bindings: Env };
const app = new Hono<App>();

const FOLDERS = new Set(["inbox", "sent", "drafts", "spam", "trash", "archive", "scheduled"]);
const VIRTUAL_FOLDERS = new Set(["starred", "snoozed"]);
const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const MAX_PASSWORD_LENGTH = 1_024;
const MAX_OUTBOUND_ATTACHMENTS = 10;
const MAX_OUTBOUND_ATTACHMENT_BYTES = 25 * 1024 * 1024;
type OutboundAttachment = { filename?: string; content_type?: string; data?: string };

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: cid:; frame-src 'self'",
  );
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    name: "Flap",
    product: "useflap.online",
    time: Date.now(),
  }),
);

app.get("/api/setup/status", async (c) => {
  const n = await userCount(c.env.DB);
  const saas = (c.env.SAAS_MODE || "true").toLowerCase() !== "false";
  return c.json({ needs_setup: n === 0, signup_open: saas || n === 0 });
});

app.post("/api/setup", async (c) => {
  if ((await userCount(c.env.DB)) > 0) {
    return c.json({ error: "Setup is already complete. Sign in or create an account instead." }, 409);
  }
  const body = await c.req.json().catch(() => ({})) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    return c.json({ error: "Password must be between 8 and 1,024 characters." }, 400);
  }
  const id = randomId("usr");
  const now = nowMs();
  try {
    const passwordHash = await hashPassword(password);
    await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at, plan_id) VALUES (?, ?, ?, ?, 'free')")
        .bind(id, email, passwordHash, now),
      c.env.DB.prepare("INSERT INTO setup_state (id, user_id, created_at) VALUES (1, ?, ?)")
        .bind(id, now),
    ]);
    await ensureSubscription(c.env.DB, id);
    await createSession(c, id);
  } catch (error) {
    console.error("Failed to create the initial Flap administrator", error);
    if ((await userCount(c.env.DB)) > 0) {
      return c.json({ error: "Setup is already complete. Sign in instead." }, 409);
    }
    return c.json({ error: "Could not create the administrator account. Check the Worker logs for details." }, 500);
  }
  return c.json({ ok: true, user: { id, email } });
});

app.post("/api/signup", async (c) => {
  const saas = (c.env.SAAS_MODE || "true").toLowerCase() !== "false";
  if (!saas && (await userCount(c.env.DB)) > 0) {
    return c.json({ error: "Open signup is disabled. Ask an operator to enable SAAS_MODE." }, 403);
  }
  const body = await c.req.json().catch(() => ({})) as { email?: string; password?: string; name?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim().slice(0, 120);
  if (!EMAIL_RE.test(email)) return c.json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8 || password.length > MAX_PASSWORD_LENGTH) {
    return c.json({ error: "Password must be between 8 and 1,024 characters." }, 400);
  }
  const id = randomId("usr");
  const now = nowMs();
  try {
    const passwordHash = await hashPassword(password);
    const statements = [
      c.env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, created_at, name, plan_id) VALUES (?, ?, ?, ?, ?, 'free')",
      ).bind(id, email, passwordHash, now, name),
    ];
    if ((await userCount(c.env.DB)) === 0) {
      statements.push(
        c.env.DB.prepare("INSERT INTO setup_state (id, user_id, created_at) VALUES (1, ?, ?)").bind(id, now),
      );
    }
    await c.env.DB.batch(statements);
    await ensureSubscription(c.env.DB, id);
    await createSession(c, id);
  } catch {
    return c.json({ error: "An account with that email already exists. Sign in instead." }, 409);
  }
  return c.json({ ok: true, user: { id, email } }, 201);
});

app.post("/api/login", async (c) => {
  const body = await c.req.json().catch(() => ({})) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "Email or password is incorrect." }, 401);
  }
  await createSession(c, user.id);
  return c.json({ ok: true, user: { id: user.id, email: user.email } });
});

app.post("/api/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

app.get("/api/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ user: null }, 401);
  const mailboxes = await c.env.DB.prepare(
    "SELECT id, address, display_name FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC",
  )
    .bind(user.id)
    .all<{ id: string; address: string; display_name: string }>();
  return c.json({
    user: { id: user.id, email: user.email, created_at: user.created_at },
    mailboxes: mailboxes.results ?? [],
  });
});

app.get("/api/domains", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const rows = await c.env.DB.prepare(
    "SELECT id, name, catch_all_mailbox_id, created_at FROM domains WHERE user_id = ? ORDER BY created_at ASC",
  )
    .bind(user.id)
    .all();
  return c.json({ domains: rows.results ?? [] });
});

app.post("/api/domains", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as { name?: string };
  const name = normalizeDomain(body.name ?? "");
  if (!name) return c.json({ error: "Enter a domain, for example mail.example.com." }, 400);
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?")
    .bind(user.id)
    .first<{ n: number }>();
  const limit = await assertWithinLimit(c.env.DB, user.id, "domains", Number(count?.n ?? 0));
  if (!limit.ok) return c.json({ error: limit.error }, limit.status);
  const id = randomId("dom");
  try {
    await c.env.DB.prepare("INSERT INTO domains (id, user_id, name, created_at) VALUES (?, ?, ?, ?)")
      .bind(id, user.id, name, nowMs())
      .run();
  } catch {
    return c.json({ error: "That domain is already on this account." }, 409);
  }
  return c.json({ domain: { id, name } }, 201);
});

app.delete("/api/domains/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const res = await c.env.DB.prepare("DELETE FROM domains WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Domain not found." }, 404);
  return c.json({ ok: true });
});

app.patch("/api/domains/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as { catch_all_mailbox_id?: string | null };
  const domainId = c.req.param("id");
  const domain = await c.env.DB.prepare("SELECT id FROM domains WHERE id = ? AND user_id = ?")
    .bind(domainId, user.id)
    .first();
  if (!domain) return c.json({ error: "Domain not found." }, 404);
  let catchAll: string | null = body.catch_all_mailbox_id ?? null;
  if (catchAll) {
    const mailbox = await c.env.DB.prepare(
      "SELECT id FROM mailboxes WHERE id = ? AND user_id = ? AND domain_id = ?",
    )
      .bind(catchAll, user.id, domainId)
      .first();
    if (!mailbox) return c.json({ error: "Catch-all mailbox must belong to this domain." }, 400);
  }
  await c.env.DB.prepare("UPDATE domains SET catch_all_mailbox_id = ? WHERE id = ? AND user_id = ?")
    .bind(catchAll, domainId, user.id)
    .run();
  return c.json({ ok: true });
});

app.get("/api/mailboxes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.domain_id, m.local_part, m.address, m.display_name, m.created_at, d.name AS domain
     FROM mailboxes m
     JOIN domains d ON d.id = m.domain_id
     WHERE m.user_id = ?
     ORDER BY m.created_at ASC`,
  )
    .bind(user.id)
    .all();
  return c.json({ mailboxes: rows.results ?? [] });
});

app.post("/api/mailboxes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as { domain_id?: string; local_part?: string };
  const domain = await c.env.DB.prepare("SELECT id, name FROM domains WHERE id = ? AND user_id = ?")
    .bind(body.domain_id ?? "", user.id)
    .first<{ id: string; name: string }>();
  if (!domain) return c.json({ error: "Choose a domain first." }, 400);
  const local = (body.local_part ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._+-]+$/.test(local)) {
    return c.json({ error: "Local part may use letters, numbers, dots, plus, underscore, and hyphen." }, 400);
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM mailboxes WHERE user_id = ?")
    .bind(user.id)
    .first<{ n: number }>();
  const limit = await assertWithinLimit(c.env.DB, user.id, "mailboxes", Number(count?.n ?? 0));
  if (!limit.ok) return c.json({ error: limit.error }, limit.status);
  const address = `${local}@${domain.name}`;
  const id = randomId("mbx");
  try {
    await c.env.DB.prepare(
      "INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, user.id, domain.id, local, address, nowMs())
      .run();
  } catch {
    return c.json({ error: "That mailbox already exists." }, 409);
  }
  return c.json({ mailbox: { id, domain_id: domain.id, local_part: local, address } }, 201);
});

app.patch("/api/mailboxes/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as { display_name?: string };
  const res = await c.env.DB.prepare("UPDATE mailboxes SET display_name = ? WHERE id = ? AND user_id = ?")
    .bind((body.display_name ?? "").trim().slice(0, 80), c.req.param("id"), user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Mailbox not found." }, 404);
  return c.json({ ok: true });
});

app.delete("/api/mailboxes/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const res = await c.env.DB.prepare("DELETE FROM mailboxes WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Mailbox not found." }, 404);
  return c.json({ ok: true });
});

app.get("/api/dns", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const domain = (c.req.query("domain") ?? "").trim().toLowerCase();
  return c.json({ records: dnsRecords(domain || "your-domain.com") });
});

const LIST_COLUMNS = `id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, has_attachments, unread, starred, snooze_until, scheduled_at, snippet, label, thread_id, created_at`;

app.get("/api/mail", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  await flushScheduled(c.env).catch(() => undefined);
  const folder = (c.req.query("folder") ?? "inbox").toLowerCase();
  if (!FOLDERS.has(folder) && !VIRTUAL_FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const mailboxId = c.req.query("mailbox");
  const now = nowMs();
  let sql = `SELECT ${LIST_COLUMNS} FROM messages WHERE user_id = ?`;
  const binds: unknown[] = [user.id];
  if (folder === "starred") {
    sql += " AND starred = 1 AND folder NOT IN ('trash', 'spam')";
  } else if (folder === "snoozed") {
    sql += " AND snooze_until > ?";
    binds.push(now);
  } else if (folder === "inbox") {
    sql += " AND folder = 'inbox' AND (snooze_until IS NULL OR snooze_until <= ?)";
    binds.push(now);
  } else {
    sql += " AND folder = ?";
    binds.push(folder);
  }
  if (mailboxId) {
    sql += " AND mailbox_id = ?";
    binds.push(mailboxId);
  }
  sql += " ORDER BY date_ms DESC LIMIT 200";
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ folder, messages: rows.results ?? [] });
});

app.get("/api/search", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ error: "Type at least two characters." }, 400);
  const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const rows = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS}
     FROM messages
     WHERE user_id = ?
       AND (subject LIKE ? ESCAPE '\\' OR from_addr LIKE ? ESCAPE '\\' OR to_addr LIKE ? ESCAPE '\\' OR snippet LIKE ? ESCAPE '\\' OR text_body LIKE ? ESCAPE '\\')
     ORDER BY date_ms DESC
     LIMIT 100`,
  )
    .bind(user.id, like, like, like, like, like)
    .all();
  return c.json({ q, messages: rows.results ?? [] });
});

app.get("/api/mail/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const msg = await c.env.DB.prepare("SELECT * FROM messages WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first();
  if (!msg) return c.json({ error: "Message not found." }, 404);
  if ((msg as { unread: number }).unread) {
    await c.env.DB.prepare("UPDATE messages SET unread = 0 WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .run();
  }
  const atts = await c.env.DB.prepare(
    "SELECT id, filename, content_type, size FROM attachments WHERE message_id = ?",
  )
    .bind(id)
    .all();
  return c.json({ message: { ...msg, unread: 0 }, attachments: atts.results ?? [] });
});

app.get("/api/mail/:id/thread", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const id = c.req.param("id");
  const root = await c.env.DB.prepare("SELECT thread_id FROM messages WHERE id = ? AND user_id = ?")
    .bind(id, user.id)
    .first<{ thread_id: string | null }>();
  if (!root) return c.json({ error: "Message not found." }, 404);
  const threadId = root.thread_id || id;
  const rows = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS}
     FROM messages
     WHERE user_id = ? AND (thread_id = ? OR id = ?)
     ORDER BY date_ms ASC
     LIMIT 100`,
  )
    .bind(user.id, threadId, id)
    .all();
  return c.json({ thread_id: threadId, messages: rows.results ?? [] });
});

app.get("/api/mail/:id/attachments/:attId", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  if (!c.env.INLET_ATTACHMENTS) {
    return c.json({ error: "R2 bucket INLET_ATTACHMENTS is not bound. Attachments are unavailable." }, 501);
  }
  const att = await c.env.DB.prepare(
    `SELECT a.id, a.r2_key, a.filename, a.content_type
     FROM attachments a
     JOIN messages m ON m.id = a.message_id
     WHERE a.id = ? AND a.message_id = ? AND m.user_id = ?`,
  )
    .bind(c.req.param("attId"), c.req.param("id"), user.id)
    .first<{ id: string; r2_key: string; filename: string; content_type: string }>();
  if (!att) return c.json({ error: "Attachment not found." }, 404);
  const obj = await c.env.INLET_ATTACHMENTS.get(att.r2_key);
  if (!obj) return c.json({ error: "Attachment object is missing from R2." }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": safeContentType(att.content_type),
      "content-disposition": `attachment; filename="${safeFilename(att.filename)}"`,
    },
  });
});

app.post("/api/mail/:id/move", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as { folder?: string };
  const folder = (body.folder ?? "").toLowerCase();
  if (!FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const res = await c.env.DB.prepare("UPDATE messages SET folder = ?, snooze_until = NULL WHERE id = ? AND user_id = ?")
    .bind(folder, c.req.param("id"), user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Message not found." }, 404);
  return c.json({ ok: true, folder });
});

app.post("/api/mail/:id/flags", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as {
    unread?: boolean;
    starred?: boolean;
    snooze_until?: number | null;
  };
  const row = await c.env.DB.prepare("SELECT id, starred, unread FROM messages WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.id)
    .first<{ id: string; starred: number; unread: number }>();
  if (!row) return c.json({ error: "Message not found." }, 404);
  const starred = body.starred === undefined ? row.starred : body.starred ? 1 : 0;
  const unread = body.unread === undefined ? row.unread : body.unread ? 1 : 0;
  if (body.snooze_until === undefined) {
    await c.env.DB.prepare("UPDATE messages SET starred = ?, unread = ? WHERE id = ? AND user_id = ?")
      .bind(starred, unread, row.id, user.id)
      .run();
  } else {
    await c.env.DB.prepare("UPDATE messages SET starred = ?, unread = ?, snooze_until = ?, folder = 'inbox' WHERE id = ? AND user_id = ?")
      .bind(starred, unread, body.snooze_until, row.id, user.id)
      .run();
  }
  return c.json({ ok: true, starred, unread, snooze_until: body.snooze_until ?? null });
});

app.delete("/api/mail/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const row = await c.env.DB.prepare("SELECT id, folder FROM messages WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), user.id)
    .first<{ id: string; folder: string }>();
  if (!row) return c.json({ error: "Message not found." }, 404);
  if (row.folder !== "trash" && row.folder !== "spam" && row.folder !== "drafts" && row.folder !== "scheduled") {
    return c.json({ error: "Move the message to Trash before deleting it permanently." }, 400);
  }
  const atts = await c.env.DB.prepare("SELECT r2_key FROM attachments WHERE message_id = ?")
    .bind(row.id)
    .all<{ r2_key: string }>();
  if (c.env.INLET_ATTACHMENTS) {
    await Promise.all((atts.results ?? []).map((att) => c.env.INLET_ATTACHMENTS!.delete(att.r2_key).catch(() => undefined)));
  }
  await c.env.DB.prepare("DELETE FROM attachments WHERE message_id = ?").bind(row.id).run();
  await c.env.DB.prepare("DELETE FROM messages WHERE id = ? AND user_id = ?").bind(row.id, user.id).run();
  return c.json({ ok: true });
});

app.post("/api/mail/send", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as {
    id?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
    draft?: boolean;
    scheduled_at?: number | null;
    in_reply_to?: string;
    attachments?: OutboundAttachment[];
  };
  const to = (body.to ?? "").trim();
  const cc = (body.cc ?? "").trim();
  const bcc = (body.bcc ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const text = body.text ?? "";
  const html = body.html ?? "";
  const draft = body.draft === true;
  const scheduledAt = typeof body.scheduled_at === "number" && body.scheduled_at > nowMs() ? body.scheduled_at : null;
  const incomingAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (to.length > 4_096 || cc.length > 4_096 || bcc.length > 4_096 || subject.length > 998 || text.length > 1_000_000 || html.length > 1_500_000) {
    return c.json({ error: "Message fields exceed Flap's supported size limits." }, 400);
  }
  const uniqueRecipients = [...new Set([...parseRecipients(to), ...parseRecipients(cc), ...parseRecipients(bcc)])];
  if (!draft && !scheduledAt && (!uniqueRecipients.length || uniqueRecipients.length > 20)) {
    return c.json({ error: "Enter between 1 and 20 valid recipient addresses, separated by commas." }, 400);
  }
  if (!draft && !scheduledAt && !subject) return c.json({ error: "Subject is required." }, 400);
  if (!HEADER_VALUE_RE.test(subject)) return c.json({ error: "Subject cannot contain line breaks." }, 400);
  if (cc && !parseRecipients(cc).length) return c.json({ error: "Cc contains an invalid address." }, 400);
  if (bcc && !parseRecipients(bcc).length) return c.json({ error: "Bcc contains an invalid address." }, 400);

  if (!draft && !scheduledAt && !c.env.SEB) {
    return c.json(
      {
        error:
          "The send_email binding (SEB) is not configured. Add it in wrangler.jsonc and enable Email Routing. Sending requires a paid Workers plan.",
      },
      501,
    );
  }

  const fromMailbox = await pickFromMailbox(c.env.DB, user.id, body.from);
  if (!fromMailbox) {
    return c.json({ error: "Add a mailbox in Settings before sending." }, 400);
  }

  const now = nowMs();
  const attachments = decodeOutboundAttachments(incomingAttachments);
  if (attachments instanceof Response) return attachments;
  if (attachments.length && !c.env.INLET_ATTACHMENTS) {
    return c.json({ error: "Attachments require the INLET_ATTACHMENTS R2 binding." }, 501);
  }

  const snippet = makeSnippet(text, html);
  const folder = scheduledAt ? "scheduled" : "drafts";
  let replyHeader: string | null = null;
  let threadId: string | null = null;
  if (body.in_reply_to) {
    const parent = await c.env.DB.prepare(
      "SELECT id, rfc_message_id, thread_id FROM messages WHERE id = ? AND user_id = ?",
    )
      .bind(body.in_reply_to, user.id)
      .first<{ id: string; rfc_message_id: string | null; thread_id: string | null }>();
    if (parent) {
      replyHeader = normalizeMessageId(parent.rfc_message_id) || `<${parent.id}@flap.local>`;
      threadId = parent.thread_id || parent.id;
    } else {
      replyHeader = normalizeMessageId(body.in_reply_to) || body.in_reply_to;
    }
  }
  let id = (body.id ?? "").trim();
  if (id) {
    const existing = await c.env.DB.prepare("SELECT id, folder FROM messages WHERE id = ? AND user_id = ?")
      .bind(id, user.id)
      .first<{ id: string; folder: string }>();
    if (!existing || (existing.folder !== "drafts" && existing.folder !== "scheduled")) {
      return c.json({ error: "Draft not found." }, 404);
    }
    await c.env.DB.prepare(
      `UPDATE messages SET mailbox_id = ?, folder = ?, from_addr = ?, to_addr = ?, cc_addr = ?, bcc_addr = ?, subject = ?, date_ms = ?, text_body = ?, html_body = ?, has_attachments = CASE WHEN ? = 1 THEN 1 ELSE has_attachments END, unread = 0, snippet = ?, scheduled_at = ?, in_reply_to = COALESCE(?, in_reply_to), thread_id = COALESCE(?, thread_id)
       WHERE id = ? AND user_id = ?`,
    )
      .bind(fromMailbox.id, folder, fromMailbox.fromHeader, to, cc, bcc, subject, now, text, html, attachments.length ? 1 : 0, snippet, scheduledAt, replyHeader, threadId, id, user.id)
      .run();
  } else {
    id = randomId("msg");
    const rfcId = `<${id}@${(fromMailbox.address.split("@")[1] || "flap.local")}>`;
    await c.env.DB.prepare(
      `INSERT INTO messages
        (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, snippet, scheduled_at, in_reply_to, rfc_message_id, thread_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, user.id, fromMailbox.id, folder, fromMailbox.fromHeader, to, cc, bcc, subject, now, text, html, attachments.length ? 1 : 0, snippet, scheduledAt, replyHeader, rfcId, threadId || id, now)
      .run();
  }
  if (attachments.length) {
    await saveOutboundAttachments(c.env, id, attachments, now);
  }

  for (const address of uniqueRecipients) {
    await touchContact(c.env.DB, user.id, address);
  }

  if (draft) return c.json({ ok: true, draft: true, id });
  if (scheduledAt) return c.json({ ok: true, scheduled: true, id, scheduled_at: scheduledAt });

  const error = await dispatchStoredMessage(c.env, {
    id,
    mailbox_id: fromMailbox.id,
    from_addr: fromMailbox.fromHeader,
    to_addr: to,
    cc_addr: cc,
    bcc_addr: bcc,
    subject,
    text_body: text,
    html_body: html,
    in_reply_to: replyHeader,
  });
  if (error) {
    return c.json(
      {
        error: `Outbound send failed: ${error}. The message was saved as a draft. Confirm Email Routing destination addresses and a paid Workers plan.`,
        id,
        draft: true,
      },
      502,
    );
  }

  await c.env.DB.prepare("UPDATE messages SET folder = 'sent', scheduled_at = NULL, date_ms = ?, unread = 0 WHERE id = ? AND user_id = ?")
    .bind(now, id, user.id)
    .run();
  return c.json({ ok: true, id });
});

function decodeOutboundAttachments(input: OutboundAttachment[]): Array<{ filename: string; contentType: string; content: Uint8Array }> | Response {
  if (input.length > MAX_OUTBOUND_ATTACHMENTS) return new Response(JSON.stringify({ error: `Attach at most ${MAX_OUTBOUND_ATTACHMENTS} files.` }), { status: 400, headers: { "content-type": "application/json" } });
  let total = 0;
  const files: Array<{ filename: string; contentType: string; content: Uint8Array }> = [];
  for (const item of input) {
    if (typeof item.data !== "string" || !item.data.startsWith("data:")) return new Response(JSON.stringify({ error: "An attachment is malformed." }), { status: 400, headers: { "content-type": "application/json" } });
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(item.data);
    if (!match) return new Response(JSON.stringify({ error: "Attachments must be base64 data URLs." }), { status: 400, headers: { "content-type": "application/json" } });
    const binary = atob(match[2]);
    const content = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    total += content.byteLength;
    if (total > MAX_OUTBOUND_ATTACHMENT_BYTES) return new Response(JSON.stringify({ error: "Attachments exceed Flap's 25 MB limit." }), { status: 400, headers: { "content-type": "application/json" } });
    files.push({ filename: safeFilename(item.filename ?? "attachment"), contentType: safeContentType(item.content_type ?? match[1]), content });
  }
  return files;
}

async function saveOutboundAttachments(env: Env, messageId: string, attachments: Array<{ filename: string; contentType: string; content: Uint8Array }>, now: number) {
  if (!attachments.length || !env.INLET_ATTACHMENTS) return;
  for (const attachment of attachments) {
    const id = randomId("att");
    const key = `attachments/${messageId}/${id}/${safeFilename(attachment.filename)}`;
    await env.INLET_ATTACHMENTS.put(key, attachment.content, { httpMetadata: { contentType: attachment.contentType } });
    await env.DB.prepare("INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, messageId, key, attachment.filename, attachment.contentType, attachment.content.byteLength, now)
      .run();
  }
}

function normalizeDomain(raw: string): string {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(domain) ? domain : "";
}

function safeFilename(value: string): string {
  return value.replace(/["\r\n]/g, "_").slice(0, 180) || "attachment";
}

function safeContentType(value: string): string {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;[^\r\n]*)?$/i.test(value)
    ? value
    : "application/octet-stream";
}

function dnsRecords(domain: string) {
  return {
    note:
      "These are the records Cloudflare Email Routing documents. Create them at your DNS host. Flap does not write DNS for you. After MX is live, add an Email Routing rule that sends mail for your mailbox to this Worker.",
    mx: [
      { type: "MX", name: domain, priority: 13, value: "route1.mx.cloudflare.net" },
      { type: "MX", name: domain, priority: 27, value: "route2.mx.cloudflare.net" },
      { type: "MX", name: domain, priority: 40, value: "route3.mx.cloudflare.net" },
    ],
    spf: {
      type: "TXT",
      name: domain,
      value: "v=spf1 include:_spf.mx.cloudflare.net ~all",
    },
    dkim: {
      type: "TXT",
      name: `cf2024-1._domainkey.${domain}`,
      value:
        "Copy the DKIM TXT value from Cloudflare Dashboard > Email Routing > Settings. Flap does not generate DKIM keys.",
    },
    worker_rule:
      "Email Routing > Routing rules: match the mailbox address (or a catch-all) and set the action to Send to a Worker, selecting this Flap Worker.",
    send_note:
      "Outbound mail uses the SEB send_email binding. Sending requires a paid Workers plan. Destination addresses must be allowed in Email Routing.",
  };
}

async function pickFromMailbox(db: D1Database, userId: string, from?: string) {
  const row = from
    ? await db
        .prepare("SELECT id, address, display_name FROM mailboxes WHERE user_id = ? AND lower(address) = ?")
        .bind(userId, from.trim().toLowerCase())
        .first<{ id: string; address: string; display_name: string }>()
    : await db
        .prepare("SELECT id, address, display_name FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
        .bind(userId)
        .first<{ id: string; address: string; display_name: string }>();
  if (!row) return null;
  const name = (row.display_name ?? "").trim().replace(/["\r\n]/g, "");
  return {
    id: row.id,
    address: row.address,
    fromHeader: name ? `"${name}" <${row.address}>` : row.address,
  };
}

registerWorkspaceRoutes(app);
registerBillingRoutes(app);

export default {
  fetch: app.fetch,
  email: handleEmail,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(flushScheduled(env));
  },
};
