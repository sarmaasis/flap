import { Hono } from "hono";
import { EmailMessage } from "cloudflare:email";
import { createSession, destroySession, getSessionUser, requireUser, userCount, type UserRow } from "./lib/auth";
import { randomId, nowMs } from "./lib/ids";
import { hashPassword, verifyPassword } from "./lib/password";
import { buildRawMime } from "./lib/mime";
import { handleEmail } from "./email";

type App = { Bindings: Env };
const app = new Hono<App>();

const FOLDERS = new Set(["inbox", "sent", "drafts", "spam", "trash"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const HEADER_VALUE_RE = /^[^\r\n]*$/;
const MAX_PASSWORD_LENGTH = 1_024;

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'");
});

app.get("/api/health", (c) => c.json({ ok: true, name: "Inlet" }));

app.get("/api/setup/status", async (c) => {
  const n = await userCount(c.env.DB);
  return c.json({ needs_setup: n === 0 });
});

app.post("/api/setup", async (c) => {
  if ((await userCount(c.env.DB)) > 0) {
    return c.json({ error: "Setup is already complete. Sign in instead." }, 409);
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
      c.env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
        .bind(id, email, passwordHash, now),
      c.env.DB.prepare("INSERT INTO setup_state (id, user_id, created_at) VALUES (1, ?, ?)")
        .bind(id, now),
    ]);
    await createSession(c, id);
  } catch (error) {
    console.error("Failed to create the initial Inlet administrator", error);
    if ((await userCount(c.env.DB)) > 0) {
      return c.json({ error: "Setup is already complete. Sign in instead." }, 409);
    }
    return c.json({ error: "Could not create the administrator account. Check the Worker logs for details." }, 500);
  }
  return c.json({ ok: true, user: { id, email } });
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
    "SELECT id, address FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC",
  )
    .bind(user.id)
    .all<{ id: string; address: string }>();
  return c.json({
    user: { id: user.id, email: user.email, created_at: user.created_at },
    mailboxes: mailboxes.results ?? [],
  });
});

app.get("/api/domains", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const rows = await c.env.DB.prepare(
    "SELECT id, name, created_at FROM domains WHERE user_id = ? ORDER BY created_at ASC",
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

app.get("/api/mailboxes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.domain_id, m.local_part, m.address, m.created_at, d.name AS domain
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

app.get("/api/mail", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const folder = (c.req.query("folder") ?? "inbox").toLowerCase();
  if (!FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const mailboxId = c.req.query("mailbox");
  let sql = `SELECT id, mailbox_id, folder, from_addr, to_addr, subject, date_ms, has_attachments, unread, created_at
             FROM messages WHERE user_id = ? AND folder = ?`;
  const binds: unknown[] = [user.id, folder];
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
    `SELECT id, mailbox_id, folder, from_addr, to_addr, subject, date_ms, has_attachments, unread, created_at
     FROM messages
     WHERE user_id = ?
       AND (subject LIKE ? ESCAPE '\\' OR from_addr LIKE ? ESCAPE '\\' OR to_addr LIKE ? ESCAPE '\\' OR text_body LIKE ? ESCAPE '\\')
     ORDER BY date_ms DESC
     LIMIT 100`,
  )
    .bind(user.id, like, like, like, like)
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
  const res = await c.env.DB.prepare("UPDATE messages SET folder = ? WHERE id = ? AND user_id = ?")
    .bind(folder, c.req.param("id"), user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: "Message not found." }, 404);
  return c.json({ ok: true, folder });
});

app.post("/api/mail/send", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const body = await c.req.json().catch(() => ({})) as {
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
    draft?: boolean;
  };
  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const text = body.text ?? "";
  const html = body.html ?? "";
  const draft = body.draft === true;
  if (to.length > 4_096 || subject.length > 998 || text.length > 1_000_000 || html.length > 1_500_000) {
    return c.json({ error: "Message fields exceed Inlet's supported size limits." }, 400);
  }
  const recipients = parseRecipients(to);
  if (!draft && (!recipients.length || recipients.length > 20)) {
    return c.json({ error: "Enter between 1 and 20 valid recipient addresses, separated by commas." }, 400);
  }
  if (!draft && !subject) return c.json({ error: "Subject is required." }, 400);
  if (!HEADER_VALUE_RE.test(subject)) return c.json({ error: "Subject cannot contain line breaks." }, 400);

  if (!draft && !c.env.SEB) {
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

  const id = randomId("msg");
  const now = nowMs();

  if (draft) {
    await c.env.DB.prepare(
      `INSERT INTO messages
        (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, date_ms, text_body, html_body, has_attachments, unread, created_at)
       VALUES (?, ?, ?, 'drafts', ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
    )
      .bind(id, user.id, fromMailbox.id, fromMailbox.address, to, subject, now, text, html, now)
      .run();
    return c.json({ ok: true, draft: true, id });
  }

  const raw = buildRawMime({
    from: fromMailbox.address,
    to,
    subject,
    text,
    html: html || undefined,
    messageId: `<${id}@${fromMailbox.address.split("@")[1]}>`,
  });

  try {
    await Promise.all(recipients.map((recipient) => c.env.SEB!.send(new EmailMessage(fromMailbox.address, recipient, raw))));
  } catch (err) {
    const hint = err instanceof Error ? err.message : "send failed";
    return c.json(
      {
        error: `Outbound send failed: ${hint}. Confirm Email Routing destination addresses and a paid Workers plan.`,
      },
      502,
    );
  }

  await c.env.DB.prepare(
    `INSERT INTO messages
      (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, date_ms, text_body, html_body, has_attachments, unread, created_at)
     VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
  )
    .bind(id, user.id, fromMailbox.id, fromMailbox.address, to, subject, now, text, html, now)
    .run();

  return c.json({ ok: true, id });
});

function normalizeDomain(raw: string): string {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(domain) ? domain : "";
}

function parseRecipients(value: string): string[] {
  const recipients = value.split(",").map((recipient) => recipient.trim()).filter(Boolean);
  if (recipients.some((recipient) => !EMAIL_RE.test(recipient))) return [];
  return [...new Set(recipients.map((recipient) => recipient.toLowerCase()))];
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
      "These are the records Cloudflare Email Routing documents. Create them at your DNS host. Inlet does not write DNS for you. After MX is live, add an Email Routing rule that sends mail for your mailbox to this Worker.",
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
        "Copy the DKIM TXT value from Cloudflare Dashboard > Email Routing > Settings. Inlet does not generate DKIM keys.",
    },
    worker_rule:
      "Email Routing > Routing rules: match the mailbox address (or a catch-all) and set the action to Send to a Worker, selecting this Inlet Worker.",
    send_note:
      "Outbound mail uses the SEB send_email binding. Sending requires a paid Workers plan. Destination addresses must be allowed in Email Routing.",
  };
}

async function pickFromMailbox(db: D1Database, userId: string, from?: string) {
  if (from) {
    const row = await db
      .prepare("SELECT id, address FROM mailboxes WHERE user_id = ? AND lower(address) = ?")
      .bind(userId, from.trim().toLowerCase())
      .first<{ id: string; address: string }>();
    if (row) return row;
  }
  return db
    .prepare("SELECT id, address FROM mailboxes WHERE user_id = ? ORDER BY created_at ASC LIMIT 1")
    .bind(userId)
    .first<{ id: string; address: string }>();
}

export default {
  fetch: app.fetch,
  email: handleEmail,
};
