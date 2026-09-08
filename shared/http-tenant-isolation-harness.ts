/**
 * HTTP tenant-isolation harness (Hono + in-memory D1).
 * Mirrors production authz SQL for critical routes so cross-tenant IDOR is tested at the HTTP layer.
 *
 * Auth: `X-Flap-Test-User-Id` header selects the acting user (test-only; never used in production Worker).
 */
import { Hono } from "hono";
import { memberCanAccessMailbox } from "./agency-authz.ts";
import { MemoryD1Database, type HarnessD1 } from "./d1-memory.ts";
import { mailboxAccessClause, resolveWorkspace as resolveProdWorkspace } from "../worker/lib/team.ts";
import { buildJsonExport, restoreWorkspaceBackup } from "../worker/lib/workspace-backup.ts";

export type TenantSeed = {
  userId: string;
  email: string;
  domainId: string;
  domainName: string;
  mailboxId: string;
  mailboxAddress: string;
  messageId: string;
  threadId: string;
  attachmentId: string;
  draftId: string;
  scheduledId: string;
  suppressionEmail: string;
  deliveryEventId: string;
  contactId: string;
  apiKeyId: string;
  webhookId: string;
  newsletterId: string;
  calendarEventId: string;
  quarantineMessageId: string;
};

type TestAttachments = {
  get(key: string): Promise<{ body: Uint8Array } | null>;
};

type AppEnv = { Bindings: { DB: HarnessD1; ATTACHMENTS?: TestAttachments } };

type WorkspaceCtx = Awaited<ReturnType<typeof resolveProdWorkspace>>;

function accessClause(ctx: WorkspaceCtx, column = "mailbox_id") {
  return mailboxAccessClause(ctx, column);
}

async function resolveTestUser(c: {
  req: { header: (n: string) => string | undefined };
  env: { DB: HarnessD1 };
  json: (body: unknown, status?: number) => Response;
}): Promise<{ id: string; email: string } | Response> {
  const id = (c.req.header("x-flap-test-user-id") || "").trim();
  if (!id) return c.json({ error: "Sign in required." }, 401);
  const row = await c.env.DB.prepare("SELECT id, email FROM users WHERE id = ?").bind(id).first<{
    id: string;
    email: string;
  }>();
  if (!row) return c.json({ error: "Sign in required." }, 401);
  return row;
}

async function resolveWorkspace(db: HarnessD1, userId: string, preferred?: string | null): Promise<WorkspaceCtx> {
  return resolveProdWorkspace(db as unknown as D1Database, userId, preferred);
}

export function createIdorTestApp() {
  const app = new Hono<AppEnv>();

  app.get("/api/mail/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const msg = await c.env.DB.prepare(
      `SELECT id, user_id, mailbox_id, subject, text_body FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    return c.json({ message: msg });
  });

  app.get("/api/mail/:id/thread", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const root = await c.env.DB.prepare(
      `SELECT thread_id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first<{ thread_id: string | null }>();
    if (!root) return c.json({ error: "Message not found." }, 404);
    const threadId = root.thread_id || c.req.param("id");
    const rows = await c.env.DB.prepare(
      `SELECT id, subject FROM messages WHERE user_id = ?${access.sql} AND (thread_id = ? OR id = ?) LIMIT 100`,
    )
      .bind(ctx.workspaceId, ...access.binds, threadId, c.req.param("id"))
      .all();
    return c.json({ thread_id: threadId, messages: rows.results ?? [] });
  });

  app.get("/api/mail/:id/attachments/:attId", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx, "m.mailbox_id");
    const att = await c.env.DB.prepare(
      `SELECT a.id, a.r2_key, a.filename, a.content_type
       FROM attachments a
       JOIN messages m ON m.id = a.message_id
       WHERE a.id = ? AND a.message_id = ? AND m.user_id = ?${access.sql}`,
    )
      .bind(c.req.param("attId"), c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first<{ id: string; r2_key: string; filename: string; content_type: string }>();
    if (!att) return c.json({ error: "Attachment not found." }, 404);
    const obj = await c.env.ATTACHMENTS?.get(att.r2_key);
    if (!obj) return c.json({ error: "Attachment object is missing from R2." }, 404);
    return new Response(obj.body, {
      headers: { "content-type": att.content_type, "content-disposition": `attachment; filename="${att.filename}"` },
    });
  });

  app.delete("/api/mail/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const existing = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first();
    if (!existing) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("DELETE FROM messages WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  app.post("/api/mail/:id/move", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const existing = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first();
    if (!existing) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("UPDATE messages SET folder = ? WHERE id = ? AND user_id = ?")
      .bind("trash", c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true, folder: "trash" });
  });

  app.post("/api/mail/:id/undo-send", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const row = await c.env.DB.prepare(
      `SELECT id, folder FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first<{ id: string; folder: string }>();
    if (!row || row.folder !== "scheduled") {
      return c.json({ error: "Message already sent or not found." }, 404);
    }
    await c.env.DB.prepare("UPDATE messages SET folder = 'drafts' WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  app.post("/api/mail/:id/open-track", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    return c.json({ ok: true, open_track: true });
  });

  app.get("/api/mailboxes/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const mailboxId = c.req.param("id");
    if (!memberCanAccessMailbox(ctx.mailboxIds, mailboxId)) {
      return c.json({ error: "Mailbox not found." }, 404);
    }
    const row = await c.env.DB.prepare("SELECT id, address, user_id FROM mailboxes WHERE id = ? AND user_id = ?")
      .bind(mailboxId, ctx.workspaceId)
      .first();
    if (!row) return c.json({ error: "Mailbox not found." }, 404);
    return c.json({ mailbox: row });
  });

  app.get("/api/domains/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const row = await c.env.DB.prepare("SELECT id, name, user_id FROM domains WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .first();
    if (!row) return c.json({ error: "Domain not found." }, 404);
    return c.json({ domain: row });
  });

  app.get("/api/suppressions", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const rows = await c.env.DB.prepare(
      "SELECT id, email, user_id FROM mail_suppressions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ suppressions: rows.results ?? [] });
  });

  app.delete("/api/suppressions/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const res = await c.env.DB.prepare("DELETE FROM mail_suppressions WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/delivery-events", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const domainFilter =
      ctx.domainIds === null
        ? { sql: "", binds: [] as unknown[] }
        : ctx.domainIds.length === 0
          ? { sql: " AND 1 = 0", binds: [] as unknown[] }
          : {
              sql: ` AND domain_id IN (${ctx.domainIds.map(() => "?").join(", ")})`,
              binds: [...ctx.domainIds],
            };
    const rows = await c.env.DB.prepare(
      `SELECT id, recipient_email, kind, user_id FROM delivery_event_log WHERE user_id = ?${domainFilter.sql} ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(ctx.workspaceId, ...domainFilter.binds)
      .all();
    return c.json({ events: rows.results ?? [] });
  });

  app.get("/api/quarantine", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const access = accessClause(ctx);
    const rows = await c.env.DB.prepare(
      `SELECT id, subject FROM messages WHERE user_id = ? AND virus_status = 'quarantine'${access.sql}`,
    )
      .bind(ctx.workspaceId, ...access.binds)
      .all();
    return c.json({ items: rows.results ?? [] });
  });

  app.get("/api/contacts", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const rows = await c.env.DB.prepare(
      "SELECT id, email, user_id FROM contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ contacts: rows.results ?? [] });
  });

  app.delete("/api/contacts/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const res = await c.env.DB.prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Contact not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/keys", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const rows = await c.env.DB.prepare(
      "SELECT id, name, key_prefix, user_id FROM api_keys WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ keys: rows.results ?? [] });
  });

  app.delete("/api/keys/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const res = await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "API key not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/webhooks", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const rows = await c.env.DB.prepare(
      "SELECT id, name, url, user_id FROM webhooks WHERE user_id = ? ORDER BY created_at DESC",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ webhooks: rows.results ?? [] });
  });

  app.delete("/api/webhooks/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
    const res = await c.env.DB.prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Webhook not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/newsletters/:id", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const row = await c.env.DB.prepare(
      "SELECT id, name, user_id FROM newsletters WHERE id = ? AND user_id = ?",
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .first();
    if (!row) return c.json({ error: "Newsletter not found." }, 404);
    return c.json({ newsletter: row });
  });

  app.post("/api/calendar/rsvp", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const body = (await c.req.json().catch(() => ({}))) as { message_id?: string };
    const access = accessClause(ctx);
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(body.message_id || "", ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    return c.json({ ok: true });
  });

  app.post("/api/presence/:threadKey", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const threadKey = c.req.param("threadKey").slice(0, 200);
    // Workspace-scoped: thread must belong to this workspace (message id or thread_id).
    const owned = await c.env.DB.prepare(
      `SELECT id, mailbox_id FROM messages WHERE user_id = ? AND (id = ? OR thread_id = ?) LIMIT 1`,
    )
      .bind(ctx.workspaceId, threadKey, threadKey)
      .first<{ id: string; mailbox_id: string | null }>();
    if (!owned) return c.json({ error: "Thread not found." }, 404);
    if (owned.mailbox_id && !memberCanAccessMailbox(ctx.mailboxIds, owned.mailbox_id)) {
      return c.json({ error: "Thread not found." }, 404);
    }
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO thread_presence (thread_key, workspace_id, user_id, display_name, last_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(thread_key, user_id) DO UPDATE SET
         last_seen_at = excluded.last_seen_at,
         display_name = excluded.display_name,
         workspace_id = excluded.workspace_id`,
    )
      .bind(threadKey, ctx.workspaceId, user.id, user.email.split("@")[0], now)
      .run();
    const since = now - 45_000;
    const rows = await c.env.DB.prepare(
      `SELECT user_id, display_name, last_seen_at FROM thread_presence
       WHERE thread_key = ? AND workspace_id = ? AND last_seen_at > ? AND user_id != ?`,
    )
      .bind(threadKey, ctx.workspaceId, since, user.id)
      .all();
    return c.json({ viewers: rows.results ?? [] });
  });

  /** Attempt to send using another tenant's mailbox address — must fail authz/readiness. */
  app.post("/api/mail/send-as-check", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const body = (await c.req.json().catch(() => ({}))) as { from?: string; mailbox_id?: string };
    if (body.mailbox_id) {
      if (!memberCanAccessMailbox(ctx.mailboxIds, body.mailbox_id)) {
        return c.json({ error: "Mailbox not found." }, 404);
      }
      const mb = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE id = ? AND user_id = ?")
        .bind(body.mailbox_id, ctx.workspaceId)
        .first();
      if (!mb) return c.json({ error: "Mailbox not found." }, 404);
    }
    if (body.from) {
      const addr = body.from.toLowerCase();
      const mb = await c.env.DB.prepare(
        "SELECT id FROM mailboxes WHERE user_id = ? AND lower(address) = ?",
      )
        .bind(ctx.workspaceId, addr)
        .first();
      if (!mb) return c.json({ error: "Cannot send from that address." }, 403);
    }
    return c.json({ ok: true });
  });

  app.get("/api/export", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const payload = await buildJsonExport(
      c.env.DB as unknown as D1Database,
      { userId: user.id, workspaceId: ctx.workspaceId, mailboxIds: ctx.mailboxIds },
      user.email,
    );
    return c.json(payload);
  });

  app.post("/api/restore", async (c) => {
    const user = await resolveTestUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, c.req.header("x-flap-workspace"));
    const body = (await c.req.json().catch(() => null)) as { contacts?: Array<{ email?: string; name?: string }> } | null;
    if (!body) return c.json({ error: "Upload a valid Flap backup JSON." }, 400);
    const restored = await restoreWorkspaceBackup(
      c.env.DB as unknown as D1Database,
      { userId: user.id, workspaceId: ctx.workspaceId, mailboxIds: ctx.mailboxIds },
      body,
    );
    return c.json({ ok: true, restored });
  });

  return app;
}

export function applyIdorSchema(db: MemoryD1Database): void {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      PRIMARY KEY (workspace_id, user_id)
    );
    CREATE TABLE workspace_member_domains (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'send',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (workspace_id, user_id, domain_id)
    );
    CREATE TABLE mailbox_members (
      user_id TEXT NOT NULL,
      mailbox_id TEXT NOT NULL,
      PRIMARY KEY (user_id, mailbox_id)
    );
    CREATE TABLE domains (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_domains_name_global ON domains (lower(name));
    CREATE TABLE mailboxes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      domain_id TEXT NOT NULL,
      local_part TEXT NOT NULL,
      address TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mailbox_id TEXT,
      folder TEXT NOT NULL DEFAULT 'inbox',
      from_addr TEXT NOT NULL DEFAULT '',
      to_addr TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      thread_id TEXT,
      date_ms INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      virus_status TEXT NOT NULL DEFAULT '',
      open_track INTEGER NOT NULL DEFAULT 0,
      scheduled_at INTEGER,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0,
      starred INTEGER NOT NULL DEFAULT 0,
      snippet TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      rfc_message_id TEXT NOT NULL DEFAULT '',
      cc_addr TEXT NOT NULL DEFAULT '',
      bcc_addr TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE mail_suppressions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE UNIQUE INDEX idx_mail_suppressions_user_email ON mail_suppressions (user_id, email);
    CREATE TABLE delivery_event_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      domain_id TEXT NOT NULL DEFAULT '',
      recipient_email TEXT NOT NULL,
      kind TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      provider_message_id TEXT NOT NULL DEFAULT '',
      meta_json TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      last_used_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_contacts_user_email ON contacts (user_id, email);
    CREATE TABLE api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      secret TEXT NOT NULL DEFAULT '',
      events TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      html_body TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE signatures (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      html_body TEXT NOT NULL DEFAULT '',
      text_body TEXT NOT NULL DEFAULT '',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE filters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      match_from TEXT NOT NULL DEFAULT '',
      match_to TEXT NOT NULL DEFAULT '',
      match_subject TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      forward_to TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL DEFAULT '',
      is_catch_all INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE aliases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      address TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      disposable INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER
    );
    CREATE TABLE newsletters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE thread_presence (
      thread_key TEXT NOT NULL,
      workspace_id TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      last_seen_at INTEGER NOT NULL,
      PRIMARY KEY (thread_key, user_id)
    );
  `);
}

export async function seedTenant(db: MemoryD1Database, label: "a" | "b"): Promise<TenantSeed> {
  const now = Date.now();
  const seed: TenantSeed = {
    userId: `user_${label}`,
    email: `${label}@tenant.example`,
    domainId: `dom_${label}`,
    domainName: `${label}.example.com`,
    mailboxId: `mb_${label}`,
    mailboxAddress: `hello@${label}.example.com`,
    messageId: `msg_${label}`,
    threadId: `thr_${label}`,
    attachmentId: `att_${label}`,
    draftId: `draft_${label}`,
    scheduledId: `sched_${label}`,
    suppressionEmail: `bounce@${label}.example.com`,
    deliveryEventId: `del_${label}`,
    contactId: `ct_${label}`,
    apiKeyId: `key_${label}`,
    webhookId: `wh_${label}`,
    newsletterId: `nl_${label}`,
    calendarEventId: `cal_${label}`,
    quarantineMessageId: `q_${label}`,
  };

  await db
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, '', ?)")
    .bind(seed.userId, seed.email, now)
    .run();
  await db
    .prepare(
      "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    )
    .bind(seed.userId, seed.userId, now)
    .run();
  await db
    .prepare("INSERT INTO domains (id, user_id, name, created_at) VALUES (?, ?, ?, ?)")
    .bind(seed.domainId, seed.userId, seed.domainName, now)
    .run();
  await db
    .prepare(
      "INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, created_at) VALUES (?, ?, ?, 'hello', ?, ?)",
    )
    .bind(seed.mailboxId, seed.userId, seed.domainId, seed.mailboxAddress, now)
    .run();
  await db
    .prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at)
       VALUES (?, ?, ?, 'inbox', 'ext@example.com', ?, ?, 'SECRET BODY', ?, ?, ?)`,
    )
    .bind(
      seed.messageId,
      seed.userId,
      seed.mailboxId,
      seed.mailboxAddress,
      `Secret subject ${label}`,
      seed.threadId,
      now,
      now,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at)
       VALUES (?, ?, ?, 'drafts', ?, 'out@example.com', 'Draft', '', ?, ?, ?)`,
    )
    .bind(seed.draftId, seed.userId, seed.mailboxId, seed.mailboxAddress, seed.threadId, now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, thread_id, date_ms, created_at, scheduled_at)
       VALUES (?, ?, ?, 'scheduled', ?, 'out@example.com', 'Scheduled', '', ?, ?, ?, ?)`,
    )
    .bind(
      seed.scheduledId,
      seed.userId,
      seed.mailboxId,
      seed.mailboxAddress,
      seed.threadId,
      now,
      now,
      now + 60_000,
    )
    .run();
  await db
    .prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, date_ms, created_at, virus_status)
       VALUES (?, ?, ?, 'inbox', 'virus@example.com', ?, 'Quarantine', '', ?, ?, 'quarantine')`,
    )
    .bind(seed.quarantineMessageId, seed.userId, seed.mailboxId, seed.mailboxAddress, now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at)
       VALUES (?, ?, ?, 'secret.pdf', 'application/pdf', 12, ?)`,
    )
    .bind(seed.attachmentId, seed.messageId, `r2/${seed.attachmentId}`, now)
    .run();
  await db
    .prepare(
      `INSERT INTO mail_suppressions (id, user_id, email, reason, created_at) VALUES (?, ?, ?, 'bounce', ?)`,
    )
    .bind(`sup_${label}`, seed.userId, seed.suppressionEmail, now)
    .run();
  await db
    .prepare(
      `INSERT INTO delivery_event_log (id, user_id, domain_id, recipient_email, kind, created_at)
       VALUES (?, ?, ?, ?, 'bounce', ?)`,
    )
    .bind(seed.deliveryEventId, seed.userId, seed.domainId, seed.suppressionEmail, now)
    .run();
  await db
    .prepare(
      `INSERT INTO contacts (id, user_id, email, name, last_used_at, created_at) VALUES (?, ?, ?, 'Contact', ?, ?)`,
    )
    .bind(seed.contactId, seed.userId, `friend@${label}.example.com`, now, now)
    .run();
  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at) VALUES (?, ?, 'key', ?, 'flap_xxxx', ?)`,
    )
    .bind(seed.apiKeyId, seed.userId, `hash_${label}`, now)
    .run();
  await db
    .prepare(
      `INSERT INTO webhooks (id, user_id, name, url, secret, events, created_at)
       VALUES (?, ?, 'hook', 'https://example.com/hook', 'sec', '[]', ?)`,
    )
    .bind(seed.webhookId, seed.userId, now)
    .run();
  await db
    .prepare(`INSERT INTO newsletters (id, user_id, name, created_at) VALUES (?, ?, 'NL', ?)`)
    .bind(seed.newsletterId, seed.userId, now)
    .run();

  return seed;
}

export function createTestAttachmentsBucket(objects: Map<string, Uint8Array>): TestAttachments {
  return {
    get: async (key: string) => {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return { body: bytes };
    },
  };
}

export async function createIdorFixture(): Promise<{
  db: MemoryD1Database;
  app: ReturnType<typeof createIdorTestApp>;
  tenantA: TenantSeed;
  tenantB: TenantSeed;
  env: { DB: HarnessD1; ATTACHMENTS: TestAttachments };
}> {
  const db = new MemoryD1Database();
  applyIdorSchema(db);
  const tenantA = await seedTenant(db, "a");
  const tenantB = await seedTenant(db, "b");
  const objects = new Map<string, Uint8Array>([
    [`r2/${tenantA.attachmentId}`, new TextEncoder().encode("SECRET_A")],
    [`r2/${tenantB.attachmentId}`, new TextEncoder().encode("SECRET_B")],
  ]);
  const app = createIdorTestApp();
  const env = { DB: db, ATTACHMENTS: createTestAttachmentsBucket(objects) };
  return { db, app, tenantA, tenantB, env };
}
