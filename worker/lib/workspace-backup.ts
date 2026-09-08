/**
 * Workspace JSON / mbox export and settings restore.
 * Messages/mailboxes/contacts are workspace-scoped; templates/signatures/filters stay personal.
 */
import { mailboxAccessSql } from "../../shared/security-guards";
import { randomId, nowMs } from "./ids";
import { buildRawMime } from "./mime";
import { EMAIL_RE, extractEmail, extractName } from "./mailutil";

const FILTER_ACTIONS = new Set(["archive", "spam", "trash", "star", "inbox", "label", "forward"]);

export type BackupActor = {
  userId: string;
  workspaceId: string;
  mailboxIds: string[] | null;
};

export type RestoreBody = {
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
};

export async function buildMboxExport(db: D1Database, ctx: BackupActor): Promise<string> {
  const access = mailboxAccessSql({ mailboxIds: ctx.mailboxIds });
  const messages = await db
    .prepare(
      `SELECT from_addr, to_addr, cc_addr, subject, date_ms, text_body, html_body, rfc_message_id, created_at
       FROM messages WHERE user_id = ?${access.sql} ORDER BY date_ms ASC LIMIT 5000`,
    )
    .bind(ctx.workspaceId, ...access.binds)
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
  return chunks.join("\n");
}

export async function buildJsonExport(
  db: D1Database,
  ctx: BackupActor,
  actorEmail: string,
): Promise<Record<string, unknown>> {
  const access = mailboxAccessSql({ mailboxIds: ctx.mailboxIds });
  const mailboxFilter =
    ctx.mailboxIds === null
      ? { sql: "", binds: [] as unknown[] }
      : ctx.mailboxIds.length === 0
        ? { sql: " AND 1 = 0", binds: [] as unknown[] }
        : { sql: ` AND id IN (${ctx.mailboxIds.map(() => "?").join(", ")})`, binds: [...ctx.mailboxIds] };

  const [messages, mailboxes, contacts, templates, signatures, filters, aliases] = await Promise.all([
    db
      .prepare(
        `SELECT id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, starred, snippet, label, thread_id, rfc_message_id, created_at
         FROM messages WHERE user_id = ?${access.sql} ORDER BY date_ms DESC LIMIT 5000`,
      )
      .bind(ctx.workspaceId, ...access.binds)
      .all(),
    db
      .prepare(`SELECT address, display_name FROM mailboxes WHERE user_id = ?${mailboxFilter.sql}`)
      .bind(ctx.workspaceId, ...mailboxFilter.binds)
      .all(),
    db.prepare("SELECT email, name FROM contacts WHERE user_id = ?").bind(ctx.workspaceId).all(),
    db.prepare("SELECT name, subject, html_body, text_body FROM templates WHERE user_id = ?").bind(ctx.userId).all(),
    db.prepare("SELECT name, html_body, text_body, is_default FROM signatures WHERE user_id = ?").bind(ctx.userId).all(),
    db
      .prepare(
        "SELECT name, match_from, match_to, match_subject, action, forward_to, label, is_catch_all FROM filters WHERE user_id = ?",
      )
      .bind(ctx.userId)
      .all(),
    db
      .prepare("SELECT address, label, disposable, expires_at FROM aliases WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .all(),
  ]);
  return {
    exported_at: new Date().toISOString(),
    version: 2,
    workspace_id: ctx.workspaceId,
    user: { email: actorEmail },
    mailboxes: mailboxes.results ?? [],
    contacts: contacts.results ?? [],
    templates: templates.results ?? [],
    signatures: signatures.results ?? [],
    filters: filters.results ?? [],
    aliases: aliases.results ?? [],
    messages: messages.results ?? [],
  };
}

export async function restoreWorkspaceBackup(
  db: D1Database,
  ctx: BackupActor,
  body: RestoreBody,
): Promise<number> {
  const now = nowMs();
  let restored = 0;
  for (const contact of body.contacts ?? []) {
    const email = extractEmail(contact.email ?? "");
    if (!EMAIL_RE.test(email)) continue;
    const resolvedName = (contact.name ?? "").trim() || extractName(email);
    await db
      .prepare(
        `INSERT INTO contacts (id, user_id, email, name, last_used_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, email) DO UPDATE SET
           last_used_at = excluded.last_used_at,
           name = CASE WHEN excluded.name != '' THEN excluded.name ELSE contacts.name END`,
      )
      .bind(randomId("ct"), ctx.workspaceId, email, resolvedName, now, now)
      .run();
    restored += 1;
  }
  for (const template of body.templates ?? []) {
    const name = (template.name ?? "").trim();
    if (!name) continue;
    await db
      .prepare(
        "INSERT INTO templates (id, user_id, name, subject, html_body, text_body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(randomId("tpl"), ctx.userId, name, template.subject ?? "", template.html_body ?? "", template.text_body ?? "", now, now)
      .run();
    restored += 1;
  }
  for (const signature of body.signatures ?? []) {
    const name = (signature.name ?? "").trim();
    if (!name) continue;
    await db
      .prepare(
        "INSERT INTO signatures (id, user_id, name, html_body, text_body, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(randomId("sig"), ctx.userId, name, signature.html_body ?? "", signature.text_body ?? "", signature.is_default ? 1 : 0, now)
      .run();
    restored += 1;
  }
  for (const filter of body.filters ?? []) {
    const name = (filter.name ?? "").trim();
    const action = (filter.action ?? "").toLowerCase();
    if (!name || !FILTER_ACTIONS.has(action)) continue;
    await db
      .prepare(
        `INSERT INTO filters
          (id, user_id, name, match_from, match_to, match_subject, action, forward_to, label, is_catch_all, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
      .bind(
        randomId("flt"),
        ctx.userId,
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
  return restored;
}
