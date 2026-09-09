/**
 * Labels, notes, assignment, suppressions UI APIs, deliverability summary.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { mailboxAccessClause, resolveWorkspace } from "./team";
import { writeAuditLog } from "./plan-guard";
import { normalizeOperatorSendPatch, parseOperatorToken } from "./workspace-send";
import { publicDomainLifecycle } from "../../shared/outbound-send-policy";

type App = { Bindings: Env };

const LABEL_NAME_RE = /^[\w .&/+-]{1,48}$/i;
const DOMAIN_COLORS = ["#0a7b6f", "#141211", "#2a78d6", "#c47a10", "#8b3a62", "#4a5568", "#b42318", "#5c5652"];

export function registerProductFeatureRoutes(app: Hono<App>) {
  app.get("/api/labels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      "SELECT id, name, color, created_at FROM labels WHERE user_id = ? ORDER BY name COLLATE NOCASE",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ labels: rows.results ?? [] });
  });

  app.post("/api/labels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = await c.req.json().catch(() => ({})) as { name?: string; color?: string };
    const name = (body.name || "").trim();
    if (!LABEL_NAME_RE.test(name)) return c.json({ error: "Label name must be 1–48 characters." }, 400);
    const color = (body.color || DOMAIN_COLORS[0]).slice(0, 32);
    const id = randomId("lbl");
    try {
      await c.env.DB.prepare(
        "INSERT INTO labels (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(id, ctx.workspaceId, name, color, nowMs())
        .run();
    } catch {
      return c.json({ error: "A label with that name already exists." }, 409);
    }
    return c.json({ label: { id, name, color, created_at: nowMs() } }, 201);
  });

  app.delete("/api/labels/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const id = c.req.param("id");
    // Ownership first — never wipe message_labels for a label the workspace does not own.
    const res = await c.env.DB.prepare("DELETE FROM labels WHERE id = ? AND user_id = ?")
      .bind(id, ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Label not found." }, 404);
    await c.env.DB.prepare("DELETE FROM message_labels WHERE label_id = ?").bind(id).run();
    return c.json({ ok: true });
  });

  app.post("/api/mail/:id/labels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { label_id?: string; name?: string };
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);

    let labelId = (body.label_id || "").trim();
    let labelName = "";
    const requestedName = typeof body.name === "string" ? body.name.trim() : "";
    if (labelId) {
      const label = await c.env.DB.prepare("SELECT id, name FROM labels WHERE id = ? AND user_id = ?")
        .bind(labelId, ctx.workspaceId)
        .first<{ id: string; name: string }>();
      if (!label) return c.json({ error: "Label not found." }, 404);
      labelName = label.name;
    } else if (requestedName) {
      const name = requestedName;
      if (!LABEL_NAME_RE.test(name)) return c.json({ error: "Invalid label name." }, 400);
      const existing = await c.env.DB.prepare(
        "SELECT id, name FROM labels WHERE user_id = ? AND lower(name) = lower(?)",
      )
        .bind(ctx.workspaceId, name)
        .first<{ id: string; name: string }>();
      if (existing) {
        labelId = existing.id;
        labelName = existing.name;
      } else {
        labelId = randomId("lbl");
        labelName = name;
        await c.env.DB.prepare(
          "INSERT INTO labels (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)",
        )
          .bind(labelId, ctx.workspaceId, name, DOMAIN_COLORS[0], nowMs())
          .run();
      }
    } else {
      return c.json({ error: "label_id or name required." }, 400);
    }

    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO message_labels (message_id, label_id, created_at) VALUES (?, ?, ?)",
    )
      .bind(messageId, labelId, nowMs())
      .run();
    await c.env.DB.prepare("UPDATE messages SET label = ? WHERE id = ? AND user_id = ?")
      .bind(labelName, messageId, ctx.workspaceId)
      .run();
    return c.json({ ok: true, label_id: labelId, name: labelName });
  });

  app.delete("/api/mail/:id/labels/:labelId", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const labelId = c.req.param("labelId");
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("DELETE FROM message_labels WHERE message_id = ? AND label_id = ?")
      .bind(messageId, labelId)
      .run();
    const remaining = await c.env.DB.prepare(
      `SELECT l.name FROM message_labels ml JOIN labels l ON l.id = ml.label_id
       WHERE ml.message_id = ? ORDER BY ml.created_at DESC LIMIT 1`,
    )
      .bind(messageId)
      .first<{ name: string }>();
    await c.env.DB.prepare("UPDATE messages SET label = ? WHERE id = ? AND user_id = ?")
      .bind(remaining?.name || "", messageId, ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  app.delete("/api/mail/:id/label", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("DELETE FROM message_labels WHERE message_id = ?").bind(messageId).run();
    await c.env.DB.prepare("UPDATE messages SET label = '' WHERE id = ? AND user_id = ?")
      .bind(messageId, ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  app.get("/api/mail/:id/notes", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    const rows = await c.env.DB.prepare(
      `SELECT n.id, n.body, n.created_at, n.user_id, u.email AS author_email
       FROM message_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.message_id = ?
       ORDER BY n.created_at ASC`,
    )
      .bind(messageId)
      .all();
    return c.json({ notes: rows.results ?? [] });
  });

  app.post("/api/mail/:id/notes", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { body?: string };
    const text = (body.body || "").trim();
    if (!text || text.length > 4000) return c.json({ error: "Note must be 1–4000 characters." }, 400);
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    const id = randomId("note");
    const created = nowMs();
    await c.env.DB.prepare(
      "INSERT INTO message_notes (id, message_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, messageId, user.id, text, created)
      .run();
    return c.json({
      note: { id, body: text, created_at: created, user_id: user.id, author_email: user.email },
    }, 201);
  });

  app.post("/api/mail/:id/assign", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const { limits } = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (limits.team_seats <= 1) {
      return c.json({ error: "Message assignment is available on Team." }, 403);
    }
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { user_id?: string | null };
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);

    let assignee: string | null = body.user_id ?? null;
    if (assignee) {
      const member = await c.env.DB.prepare(
        "SELECT user_id FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      )
        .bind(ctx.workspaceId, assignee)
        .first();
      const isOwner = assignee === ctx.workspaceId;
      if (!member && !isOwner) return c.json({ error: "Assignee must be a workspace member." }, 400);
    }
    await c.env.DB.prepare("UPDATE messages SET assignee_user_id = ? WHERE id = ? AND user_id = ?")
      .bind(assignee, messageId, ctx.workspaceId)
      .run();
    return c.json({ ok: true, assignee_user_id: assignee });
  });

  app.post("/api/mail/:id/workflow", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as { status?: string };
    const status = (body.status || "").trim();
    if (status && status !== "done" && status !== "follow_up") {
      return c.json({ error: "status must be '', done, or follow_up." }, 400);
    }
    const msg = await c.env.DB.prepare(
      `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("UPDATE messages SET workflow_status = ? WHERE id = ? AND user_id = ?")
      .bind(status, messageId, ctx.workspaceId)
      .run();
    return c.json({ ok: true, workflow_status: status });
  });

  app.get("/api/delivery-events", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const kind = (c.req.query("kind") || "").trim();
    const since = Date.now() - 30 * 86400_000;
    const domainFilter =
      ctx.domainIds === null
        ? { sql: "", binds: [] as unknown[] }
        : ctx.domainIds.length === 0
          ? { sql: " AND 1 = 0", binds: [] as unknown[] }
          : {
              sql: ` AND domain_id IN (${ctx.domainIds.map(() => "?").join(", ")})`,
              binds: [...ctx.domainIds],
            };
    const rows = kind
      ? await c.env.DB.prepare(
          `SELECT id, recipient_email, kind, provider, provider_message_id, created_at, domain_id
           FROM delivery_event_log
           WHERE user_id = ? AND created_at >= ? AND kind = ?${domainFilter.sql}
           ORDER BY created_at DESC LIMIT 500`,
        )
          .bind(ctx.workspaceId, since, kind, ...domainFilter.binds)
          .all()
      : await c.env.DB.prepare(
          `SELECT id, recipient_email, kind, provider, provider_message_id, created_at, domain_id
           FROM delivery_event_log
           WHERE user_id = ? AND created_at >= ?${domainFilter.sql}
           ORDER BY created_at DESC LIMIT 500`,
        )
          .bind(ctx.workspaceId, since, ...domainFilter.binds)
          .all();
    return c.json({ events: rows.results ?? [], retention_days: 30 });
  });

  app.get("/api/sending-reputation", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can view reputation." }, 403);
    const since = Date.now() - 30 * 86400_000;
    const counts = await c.env.DB.prepare(
      `SELECT kind, COUNT(*) AS n FROM delivery_event_log
       WHERE user_id = ? AND created_at >= ? GROUP BY kind`,
    )
      .bind(ctx.workspaceId, since)
      .all<{ kind: string; n: number }>();
    const byKind: Record<string, number> = {};
    for (const row of counts.results ?? []) byKind[row.kind] = Number(row.n) || 0;
    const suppressed = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM mail_suppressions
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
    )
      .bind(ctx.workspaceId, Date.now())
      .first<{ n: number }>();
    const bounce = (byKind.bounce || 0) + (byKind.soft_bounce || 0);
    const complaint = byKind.complaint || 0;
    const delivery = byKind.delivery || 0;
    const denom = Math.max(1, bounce + complaint + delivery);
    const ws = await c.env.DB.prepare(
      "SELECT send_status, outbound_access_status, reputation_warning_at FROM users WHERE id = ?",
    )
      .bind(ctx.workspaceId)
      .first<{ send_status: string | null; outbound_access_status: string | null; reputation_warning_at: number | null }>()
      .catch(() => null);
    return c.json({
      window_days: 30,
      bounce_rate: bounce / denom,
      complaint_rate: complaint / denom,
      suppressed_count: Number(suppressed?.n) || 0,
      counts: {
        bounce,
        complaint,
        delivery,
        soft_bounce: byKind.soft_bounce || 0,
        send: byKind.send || 0,
        reject: byKind.reject || 0,
      },
      send_status: ws?.send_status || "ACTIVE",
      outbound_access_status: ws?.outbound_access_status || "APPROVED",
      reputation_warning_at: ws?.reputation_warning_at || null,
      note: "Rates are workspace event counts, not a scored reputation product. SES account-level suppression may still apply.",
    });
  });

  app.post("/api/mail/:id/undo-send", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const access = mailboxAccessClause(ctx);
    const id = c.req.param("id");
    const row = await c.env.DB.prepare(
      `SELECT id, folder, scheduled_at FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(id, ctx.workspaceId, ...access.binds)
      .first<{ id: string; folder: string; scheduled_at: number | null }>();
    if (!row || row.folder !== "scheduled") {
      return c.json({ error: "Message already sent or not found." }, 404);
    }
    await c.env.DB.prepare(
      `UPDATE messages SET folder = 'drafts', scheduled_at = NULL WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(id, ctx.workspaceId, ...access.binds)
      .run();
    return c.json({ ok: true, draft: true, id });
  });

  app.get("/api/suppressions", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can view suppressions." }, 403);
    const rows = await c.env.DB.prepare(
      `SELECT id, email, reason, source, provider_message_id, created_at, expires_at
       FROM mail_suppressions
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 500`,
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ suppressions: rows.results ?? [] });
  });

  app.delete("/api/suppressions/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can edit suppressions." }, 403);
    const id = c.req.param("id");
    const owned = await c.env.DB.prepare(
      `SELECT id FROM mail_suppressions WHERE id = ? AND user_id = ?`,
    )
      .bind(id, ctx.workspaceId)
      .first<{ id: string }>();
    if (!owned) return c.json({ error: "Suppression not found." }, 404);
    await c.env.DB.prepare("DELETE FROM mail_suppressions WHERE id = ? AND user_id = ?")
      .bind(id, ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  app.get("/api/deliverability", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const domains = await c.env.DB.prepare(
      `SELECT id, name, color, muted_until, mail_provider, provider_state, provider_region,
              identity_verified_at, mx_verified_at, inbound_rule_ready_at, receiving_ready_at, sending_ready_at,
              last_provider_check_at, last_provider_error,
              last_inbound_error, last_inbound_error_at, last_inbound_provider_message_id
       FROM domains WHERE user_id = ? ORDER BY created_at ASC`,
    )
      .bind(ctx.workspaceId)
      .all();
    const suppressions = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM mail_suppressions
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`,
    )
      .bind(ctx.workspaceId, nowMs())
      .first<{ n: number }>();
    const bounceRows = await c.env.DB.prepare(
      `SELECT reason, COUNT(*) AS n FROM mail_suppressions
       WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
       GROUP BY reason`,
    )
      .bind(ctx.workspaceId, nowMs())
      .all<{ reason: string; n: number }>();
    const byReason: Record<string, number> = {};
    for (const row of bounceRows.results ?? []) byReason[row.reason] = Number(row.n) || 0;

    const ws = await c.env.DB.prepare(
      "SELECT send_status, outbound_access_status FROM users WHERE id = ?",
    )
      .bind(ctx.workspaceId)
      .first<{ send_status: string | null; outbound_access_status: string | null }>()
      .catch(() => null);

    return c.json({
      domains: (domains.results ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        lifecycle: publicDomainLifecycle({
          mail_provider: String(d.mail_provider || ""),
          provider_state: d.provider_state == null ? null : String(d.provider_state),
          identity_verified_at: (d.identity_verified_at as number | null) ?? null,
          mx_verified_at: (d.mx_verified_at as number | null) ?? null,
          inbound_rule_ready_at: (d.inbound_rule_ready_at as number | null) ?? null,
          receiving_ready_at: (d.receiving_ready_at as number | null) ?? null,
          sending_ready_at: (d.sending_ready_at as number | null) ?? null,
        }),
      })),
      suppressions_active: Number(suppressions?.n) || 0,
      suppressions_by_reason: byReason,
      flap_suppression: {
        active: Number(suppressions?.n) || 0,
        note: "Workspace-scoped. Empty does not mean SES will accept the recipient.",
      },
      provider_suppression_note:
        "Amazon SES may still reject addresses at the account level even when Flap has no local suppression.",
      send_status: ws?.send_status || "ACTIVE",
      outbound_access_status: ws?.outbound_access_status || "APPROVED",
      imap: {
        status: "deferred",
        note: "IMAP credentials path is scheduled for 2026-10-15. Use the web app and PWA until then.",
      },
    });
  });

  app.post("/api/ops/workspace-send", async (c) => {
    if (!parseOperatorToken(c.req.header("authorization") || c.req.header("x-flap-operator-token"), c.env.FLAP_OPERATOR_TOKEN)) {
      return c.json({ error: "Operator token required." }, 401);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      workspace_id?: string;
      outbound_access_status?: string;
      send_status?: string;
    };
    const workspaceId = (body.workspace_id || "").trim();
    if (!workspaceId) return c.json({ error: "workspace_id required." }, 400);
    const patch = normalizeOperatorSendPatch(body);
    if ("error" in patch) return c.json({ error: patch.error }, 400);
    const existing = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(workspaceId)
      .first<{ id: string }>();
    if (!existing) return c.json({ error: "Workspace not found." }, 404);
    if (patch.outbound_access_status) {
      await c.env.DB.prepare("UPDATE users SET outbound_access_status = ? WHERE id = ?")
        .bind(patch.outbound_access_status, workspaceId)
        .run();
    }
    if (patch.send_status) {
      await c.env.DB.prepare("UPDATE users SET send_status = ? WHERE id = ?")
        .bind(patch.send_status, workspaceId)
        .run();
    }
    await writeAuditLog(c.env.DB, workspaceId, "operator", "workspace.send_status", workspaceId, patch).catch(
      () => undefined,
    );
    return c.json({ ok: true, workspace_id: workspaceId, ...patch });
  });
}

export { DOMAIN_COLORS };
