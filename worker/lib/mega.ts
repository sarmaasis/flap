/**
 * Mega P0/P1/P2 feature APIs: saved views, disposables, notifies, presence,
 * contact forms, rule templates, AI confirm, park, audit, digests, MCP light, etc.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { mailboxAccessClause, resolveWorkspace } from "./team";
import { PLANS, type PlanId } from "./plans";

type App = { Bindings: Env };

function planAtLeast(plan: PlanId, min: PlanId): boolean {
  const order: PlanId[] = ["free", "solo", "builder", "studio"];
  return order.indexOf(plan) >= order.indexOf(min);
}

async function audit(
  db: D1Database,
  workspaceId: string,
  actorId: string,
  action: string,
  target = "",
  meta: Record<string, unknown> = {},
) {
  await db
    .prepare(
      "INSERT INTO audit_log (id, user_id, actor_user_id, action, target, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(randomId("aud"), workspaceId, actorId, action, target.slice(0, 200), JSON.stringify(meta).slice(0, 2000), nowMs())
    .run()
    .catch(() => undefined);
}

export function registerMegaRoutes(app: Hono<App>) {
  // --- Saved views (P0#7) ---
  app.get("/api/saved-views", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      "SELECT id, name, query_json, pinned, created_at FROM saved_views WHERE user_id = ? ORDER BY pinned DESC, name COLLATE NOCASE",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ views: rows.results ?? [] });
  });

  app.post("/api/saved-views", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const body = (await c.req.json().catch(() => ({}))) as { name?: string; query?: Record<string, unknown>; pinned?: boolean };
    const name = (body.name || "").trim().slice(0, 64);
    if (!name) return c.json({ error: "Name required." }, 400);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM saved_views WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .first<{ n: number }>();
    const max = plan.limits.saved_views ?? 3;
    if (Number(count?.n ?? 0) >= max) {
      return c.json({ error: `Your ${PLANS[plan.plan_id].name} plan allows ${max} saved views.` }, 402);
    }
    const id = randomId("view");
    await c.env.DB.prepare(
      "INSERT INTO saved_views (id, user_id, name, query_json, pinned, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, name, JSON.stringify(body.query || {}), body.pinned === false ? 0 : 1, nowMs())
      .run();
    return c.json({ view: { id, name, query_json: JSON.stringify(body.query || {}), pinned: 1, created_at: nowMs() } }, 201);
  });

  app.delete("/api/saved-views/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const res = await c.env.DB.prepare("DELETE FROM saved_views WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Not found." }, 404);
    return c.json({ ok: true });
  });

  // --- Disposable QR addresses (P0#13) ---
  app.get("/api/disposables", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      `SELECT d.*, dom.name AS domain_name FROM disposable_addresses d
       JOIN domains dom ON dom.id = d.domain_id
       WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT 100`,
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ disposables: rows.results ?? [] });
  });

  app.post("/api/disposables", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) {
      return c.json({ error: "Disposable share addresses require Builder or Studio." }, 402);
    }
    const body = (await c.req.json().catch(() => ({}))) as {
      domain_id?: string;
      local_part?: string;
      label?: string;
      ttl_hours?: number;
    };
    const domain = await c.env.DB.prepare("SELECT id, name FROM domains WHERE id = ? AND user_id = ?")
      .bind(body.domain_id || "", ctx.workspaceId)
      .first<{ id: string; name: string }>();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
    const local = (body.local_part || `event-${randomId("x").slice(-6)}`).toLowerCase().replace(/[^a-z0-9._+-]/g, "");
    if (!local) return c.json({ error: "Invalid local part." }, 400);
    const ttl = Math.min(24 * 90, Math.max(1, Number(body.ttl_hours) || 72));
    const id = randomId("disp");
    const expires = nowMs() + ttl * 3600_000;
    try {
      await c.env.DB.prepare(
        "INSERT INTO disposable_addresses (id, user_id, domain_id, local_part, label, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(id, ctx.workspaceId, domain.id, local, (body.label || "").slice(0, 80), expires, nowMs())
        .run();
    } catch {
      return c.json({ error: "That address already exists." }, 409);
    }
    const address = `${local}@${domain.name}`;
    const share_url = `https://useflap.online/share/${id}`;
    return c.json({ disposable: { id, address, expires_at: expires, share_url, qr_text: address } }, 201);
  });

  app.delete("/api/disposables/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    await c.env.DB.prepare("DELETE FROM disposable_addresses WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  // --- Slack / Discord notify (P0#14) ---
  app.get("/api/notify-channels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      "SELECT id, kind, domain_id, mailbox_id, muted, created_at, substr(webhook_url,1,48) AS webhook_preview FROM notify_channels WHERE user_id = ?",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ channels: rows.results ?? [] });
  });

  app.post("/api/notify-channels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Notify channels require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      kind?: string;
      webhook_url?: string;
      domain_id?: string;
      mailbox_id?: string;
    };
    const kind = (body.kind || "").toLowerCase();
    if (kind !== "slack" && kind !== "discord") return c.json({ error: "kind must be slack or discord." }, 400);
    const url = (body.webhook_url || "").trim();
    if (!/^https:\/\//i.test(url)) return c.json({ error: "HTTPS webhook URL required." }, 400);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM notify_channels WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .first<{ n: number }>();
    const max = plan.limits.notify_channels ?? 0;
    if (Number(count?.n ?? 0) >= max) {
      return c.json({ error: `Your plan allows ${max} notify channel(s).` }, 402);
    }
    const id = randomId("ntf");
    await c.env.DB.prepare(
      "INSERT INTO notify_channels (id, user_id, kind, webhook_url, domain_id, mailbox_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, kind, url, body.domain_id || null, body.mailbox_id || null, nowMs())
      .run();
    return c.json({ channel: { id, kind } }, 201);
  });

  app.delete("/api/notify-channels/:id", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    await c.env.DB.prepare("DELETE FROM notify_channels WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true });
  });

  // --- Thread presence / collision (P1#2) ---
  app.post("/api/presence/:threadKey", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ viewers: [] });
    const threadKey = c.req.param("threadKey").slice(0, 200);
    const display = (user.email || "Teammate").split("@")[0];
    await c.env.DB.prepare(
      `INSERT INTO thread_presence (thread_key, user_id, display_name, last_seen_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(thread_key, user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, display_name = excluded.display_name`,
    )
      .bind(threadKey, user.id, display, nowMs())
      .run();
    const since = nowMs() - 45_000;
    const rows = await c.env.DB.prepare(
      "SELECT user_id, display_name, last_seen_at FROM thread_presence WHERE thread_key = ? AND last_seen_at > ? AND user_id != ?",
    )
      .bind(threadKey, since, user.id)
      .all();
    return c.json({ viewers: rows.results ?? [] });
  });

  // --- Assignments (P1#1) ---
  app.post("/api/mail/:id/assign", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Assignments require Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { assignee_user_id?: string | null };
    const access = mailboxAccessClause(ctx);
    const messageId = c.req.param("id");
    const msg = await c.env.DB.prepare(`SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`)
      .bind(messageId, ctx.workspaceId, ...access.binds)
      .first();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    await c.env.DB.prepare("UPDATE messages SET assignee_user_id = ? WHERE id = ? AND user_id = ?")
      .bind(body.assignee_user_id || null, messageId, ctx.workspaceId)
      .run();
    await audit(c.env.DB, ctx.workspaceId, user.id, "assign", messageId, { assignee: body.assignee_user_id });
    return c.json({ ok: true });
  });

  // --- Domain park (P1#21) ---
  app.post("/api/domains/:id/park", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Park requires Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { parked?: boolean; mode?: string };
    const mode = body.parked ? (body.mode === "paused" ? "paused" : "receive_only") : "";
    const res = await c.env.DB.prepare(
      "UPDATE domains SET parked = ?, park_mode = ? WHERE id = ? AND user_id = ?",
    )
      .bind(body.parked ? 1 : 0, mode, c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Domain not found." }, 404);
    await audit(c.env.DB, ctx.workspaceId, user.id, body.parked ? "park_domain" : "unpark_domain", c.req.param("id"));
    return c.json({ ok: true, parked: Boolean(body.parked), park_mode: mode });
  });

  // --- Reputation mode (P1#4) ---
  app.post("/api/domains/:id/reputation-mode", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "isolated" ? "isolated" : "shared";
    if (mode === "isolated" && !planAtLeast(plan.plan_id, "studio")) {
      return c.json({ error: "Isolated reputation mode requires Studio." }, 402);
    }
    const res = await c.env.DB.prepare("UPDATE domains SET reputation_mode = ? WHERE id = ? AND user_id = ?")
      .bind(mode, c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Domain not found." }, 404);
    return c.json({ ok: true, reputation_mode: mode });
  });

  // --- Deliverability dashboard (P1#3) ---
  app.get("/api/deliverability/dashboard", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) {
      return c.json({ error: "Deliverability dashboard requires Builder or Studio.", domains: [] }, 402);
    }
    const days = planAtLeast(plan.plan_id, "studio") ? 90 : 14;
    const sinceDay = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const rows = await c.env.DB.prepare(
      `SELECT domain_id, kind, SUM(count) AS total FROM deliverability_events
       WHERE user_id = ? AND day >= ? GROUP BY domain_id, kind`,
    )
      .bind(ctx.workspaceId, sinceDay)
      .all();
    const domains = await c.env.DB.prepare(
      "SELECT id, name, color, reputation_mode, parked FROM domains WHERE user_id = ? ORDER BY name",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({
      days,
      events: rows.results ?? [],
      domains: domains.results ?? [],
      note: "SES bounce/complaint events appear here when SNS/webhooks are wired. Shared pool is the default; Isolated is Studio-only.",
    });
  });

  // --- Contact forms (P1#5) ---
  app.get("/api/contact-forms", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const rows = await c.env.DB.prepare(
      "SELECT id, name, mailbox_id, public_slug, enabled, created_at FROM contact_forms WHERE user_id = ?",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ forms: rows.results ?? [] });
  });

  app.post("/api/contact-forms", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Contact forms require Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { name?: string; mailbox_id?: string };
    const mb = await c.env.DB.prepare("SELECT id FROM mailboxes WHERE id = ? AND user_id = ?")
      .bind(body.mailbox_id || "", ctx.workspaceId)
      .first();
    if (!mb) return c.json({ error: "Mailbox not found." }, 404);
    const id = randomId("form");
    const slug = randomId("cf").slice(-10);
    await c.env.DB.prepare(
      "INSERT INTO contact_forms (id, user_id, mailbox_id, name, public_slug, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, body.mailbox_id, (body.name || "Contact").slice(0, 80), slug, nowMs())
      .run();
    return c.json({
      form: { id, public_slug: slug, embed_url: `https://useflap.online/f/${slug}`, post_url: `/api/public/contact/${slug}` },
    }, 201);
  });

  app.post("/api/public/contact/:slug", async (c) => {
    const slug = c.req.param("slug");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, string>;
    const form = await c.env.DB.prepare(
      "SELECT * FROM contact_forms WHERE public_slug = ? AND enabled = 1",
    )
      .bind(slug)
      .first<{ id: string; user_id: string; mailbox_id: string; honeypot_field: string }>();
    if (!form) return c.json({ error: "Form not found." }, 404);
    if (body[form.honeypot_field || "company_website"]) return c.json({ ok: true }); // silent drop spam
    const email = (body.email || "").trim().toLowerCase();
    const name = (body.name || "").trim().slice(0, 120);
    const message = (body.message || "").trim().slice(0, 8000);
    if (!email || !message) return c.json({ error: "email and message required." }, 400);
    const id = randomId("msg");
    const subject = `Contact form: ${name || email}`;
    const text = `From: ${name} <${email}>\n\n${message}`;
    await c.env.DB.prepare(
      `INSERT INTO messages (id, user_id, mailbox_id, folder, from_addr, to_addr, subject, text_body, html_body, unread, created_at, snippet, storage_bytes)
       VALUES (?, ?, ?, 'inbox', ?, (SELECT address FROM mailboxes WHERE id = ?), ?, ?, ?, 1, ?, ?, ?)`,
    )
      .bind(id, form.user_id, form.mailbox_id, email, form.mailbox_id, subject, text, `<p>${message.replace(/</g, "&lt;")}</p>`, nowMs(), message.slice(0, 140), text.length)
      .run()
      .catch(() => undefined);
    return c.json({ ok: true });
  });

  // --- Domain health badge (P1#6) ---
  app.post("/api/domains/:id/health-badge", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const domain = await c.env.DB.prepare("SELECT id, name FROM domains WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .first<{ id: string; name: string }>();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
    const token = (randomId("badge") || "badge").slice(-16);
    await c.env.DB.prepare(
      `INSERT INTO domain_health_public (domain_id, user_id, public_token, show_badge, updated_at) VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(domain_id) DO UPDATE SET public_token = excluded.public_token, updated_at = excluded.updated_at`,
    )
      .bind(domain.id, ctx.workspaceId, token, nowMs())
      .run();
    return c.json({
      badge_url: `https://useflap.online/api/public/badge/${token}.svg`,
      status_url: `https://useflap.online/status/${token}`,
    });
  });

  app.get("/api/public/badge/:token.svg", async (c) => {
    const token = (c.req.param("token") ?? "").replace(/\.svg$/, "");
    const row = await c.env.DB.prepare(
      `SELECT d.name, d.receiving_ready_at, d.sending_ready_at FROM domain_health_public h
       JOIN domains d ON d.id = h.domain_id WHERE h.public_token = ? AND h.show_badge = 1`,
    )
      .bind(token)
      .first<{ name: string; receiving_ready_at: number | null; sending_ready_at: number | null }>();
    const ok = Boolean(row?.receiving_ready_at);
    const label = ok ? "receiving" : "setup";
    const color = ok ? "#1c6e5c" : "#b47828";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="24" role="img"><rect width="160" height="24" rx="4" fill="#111"/><text x="8" y="16" fill="#fff" font-size="11" font-family="sans-serif">Flap</text><rect x="48" width="112" height="24" fill="${color}"/><text x="56" y="16" fill="#fff" font-size="11" font-family="sans-serif">${String(row?.name ?? "domain").slice(0, 18)} ${label}</text></svg>`;
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
  });

  // --- Rule templates marketplace (P1#7) ---
  app.get("/api/rule-templates", async (c) => {
    const rows = await c.env.DB.prepare(
      "SELECT id, slug, name, description, official FROM rule_templates ORDER BY official DESC, name",
    ).all();
    return c.json({ templates: rows.results ?? [] });
  });

  app.post("/api/rule-templates/:id/install", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const installed = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM rule_template_installs WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .first<{ n: number }>();
    if (!planAtLeast(plan.plan_id, "solo") && Number(installed?.n ?? 0) >= 2) {
      return c.json({ error: "Free plan can install 2 rule packs. Upgrade for unlimited." }, 402);
    }
    const tpl = await c.env.DB.prepare("SELECT * FROM rule_templates WHERE id = ? OR slug = ?")
      .bind(c.req.param("id"), c.req.param("id"))
      .first<{ id: string; rules_json: string; name: string }>();
    if (!tpl) return c.json({ error: "Template not found." }, 404);
    let rules: Array<Record<string, string>> = [];
    try {
      rules = JSON.parse(tpl.rules_json) as Array<Record<string, string>>;
    } catch {
      return c.json({ error: "Bad template." }, 500);
    }
    for (const r of rules) {
      const id = randomId("flt");
      const field = (r.match_field || "from").toLowerCase();
      const val = r.match_value || "";
      const match_from = field === "from" ? val : "";
      const match_to = field === "to" ? val : "";
      const match_subject = field === "subject" ? val : "";
      const action = r.action === "label" ? "label" : r.action === "star" ? "star" : "archive";
      const label = r.action_value || (action === "label" ? "tagged" : "");
      await c.env.DB.prepare(
        `INSERT INTO filters (id, user_id, name, match_from, match_to, match_subject, action, label, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      )
        .bind(id, ctx.workspaceId, r.name || tpl.name, match_from, match_to, match_subject, action, label, nowMs())
        .run()
        .catch(() => undefined);
    }
    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO rule_template_installs (user_id, template_id, installed_at) VALUES (?, ?, ?)",
    )
      .bind(ctx.workspaceId, tpl.id, nowMs())
      .run();
    return c.json({ ok: true, installed: rules.length });
  });

  // --- AI confirm-only summarize (P1#9) ---
  app.post("/api/ai/summarize", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "AI assist requires Builder or Studio." }, 402);
    const settings = await c.env.DB.prepare("SELECT ai_opt_in FROM user_settings WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .first<{ ai_opt_in: number }>();
    if (!settings?.ai_opt_in) return c.json({ error: "Enable AI opt-in in Settings first." }, 400);
    const body = (await c.req.json().catch(() => ({}))) as { message_id?: string };
    const access = mailboxAccessClause(ctx);
    const msg = await c.env.DB.prepare(
      `SELECT subject, snippet, text_body, from_addr FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
    )
      .bind(body.message_id || "", ctx.workspaceId, ...access.binds)
      .first<{ subject: string; snippet: string; text_body: string; from_addr: string }>();
    if (!msg) return c.json({ error: "Message not found." }, 404);
    const text = (msg.text_body || msg.snippet || "").slice(0, 2000);
    const summary = text
      ? `Thread from ${msg.from_addr}: ${(msg.subject || "(no subject)").slice(0, 80)}. Preview: ${text.slice(0, 280)}${text.length > 280 ? "…" : ""}`
      : "No body text to summarize.";
    const suggested_label = /invoice|receipt|payment/i.test(text + msg.subject) ? "billing" : /support|help|bug/i.test(text + msg.subject) ? "support" : null;
    const draft_reply = `Hi,\n\nThanks for your note about "${msg.subject || "this"}". I will follow up shortly.\n\nBest`;
    return c.json({
      summary,
      suggested_label,
      suggested_archive: /unsubscribe|newsletter/i.test(text),
      draft_reply,
      confirm_required: true,
      auto_send: false,
    });
  });

  app.post("/api/settings/ai-opt-in", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, ai_opt_in) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ai_opt_in = excluded.ai_opt_in`,
    )
      .bind(ctx.workspaceId, body.enabled ? 1 : 0)
      .run()
      .catch(async () => {
        await c.env.DB.prepare("UPDATE user_settings SET ai_opt_in = ? WHERE user_id = ?")
          .bind(body.enabled ? 1 : 0, ctx.workspaceId)
          .run();
      });
    return c.json({ ok: true, ai_opt_in: Boolean(body.enabled) });
  });

  // --- Theme (P1#22) ---
  app.post("/api/settings/theme", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as { theme?: string };
    const theme = ["system", "light", "dark"].includes(body.theme || "") ? body.theme! : "system";
    await c.env.DB.prepare("UPDATE user_settings SET theme = ? WHERE user_id = ?")
      .bind(theme, ctx.workspaceId)
      .run()
      .catch(() => undefined);
    return c.json({ ok: true, theme });
  });

  app.get("/api/settings/prefs-extra", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const row = await c.env.DB.prepare(
      "SELECT theme, ai_opt_in, timezone, hide_shortcut_sheet, plus_auto_label, undo_send_seconds FROM user_settings WHERE user_id = ?",
    )
      .bind(ctx.workspaceId)
      .first();
    return c.json({
      prefs: row || {
        theme: "system",
        ai_opt_in: 0,
        timezone: "UTC",
        hide_shortcut_sheet: 0,
        plus_auto_label: 0,
        undo_send_seconds: 10,
      },
      imap: {
        status: "deferred",
        target_date: "2026-10-15",
        note: "IMAP credentials path is scheduled for 2026-10-15. Web + PWA remain the supported clients until then.",
      },
    });
  });

  // --- Plus-address helpers (P0#12) ---
  app.post("/api/plus-addresses", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as { mailbox_id?: string; tag?: string };
    const mb = await c.env.DB.prepare("SELECT id, address FROM mailboxes WHERE id = ? AND user_id = ?")
      .bind(body.mailbox_id || "", ctx.workspaceId)
      .first<{ id: string; address: string }>();
    if (!mb) return c.json({ error: "Mailbox not found." }, 404);
    const tag = (body.tag || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
    if (!tag) return c.json({ error: "tag required." }, 400);
    const [local, domain] = mb.address.split("@");
    const address = `${local}+${tag}@${domain}`;
    return c.json({ address, tag, auto_label: false });
  });

  // --- Pre-MX probe (P0#11) ---
  app.post("/api/domains/:id/pre-mx-test", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const domain = await c.env.DB.prepare(
      "SELECT id, name, sending_ready_at, receiving_ready_at, identity_verified_at FROM domains WHERE id = ? AND user_id = ?",
    )
      .bind(c.req.param("id"), ctx.workspaceId)
      .first<{
        id: string;
        name: string;
        sending_ready_at: number | null;
        receiving_ready_at: number | null;
        identity_verified_at: number | null;
      }>();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
    return c.json({
      domain: domain.name,
      outbound_authenticated: Boolean(domain.sending_ready_at || domain.identity_verified_at),
      inbound_waiting_on_mx: !domain.receiving_ready_at,
      message: domain.receiving_ready_at
        ? "Receiving is green. You can flip MX confidently."
        : "We can authenticate outbound once DKIM/SPF verify. Inbound waits on MX pointing at Amazon SES.",
      shadow_note: "Temporary receive-only verification is available after identity verify; full inbox needs MX.",
    });
  });

  // --- New project wizard bootstrap (P0#17) ---
  app.post("/api/wizard/new-project", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as {
      domain?: string;
      create_hello?: boolean;
      create_support?: boolean;
      catch_all?: boolean;
    };
    return c.json({
      ok: true,
      steps: [
        { id: "add_domain", domain: (body.domain || "").toLowerCase(), done: false },
        { id: "dns_copy", done: false },
        { id: "create_hello", enabled: body.create_hello !== false, done: false },
        { id: "create_support", enabled: Boolean(body.create_support), done: false },
        { id: "catch_all", enabled: body.catch_all !== false, done: false },
        { id: "send_test", done: false },
        { id: "invite_teammate", optional: true, done: false },
      ],
      next: "/app/settings?tab=setup&wizard=1",
    });
  });

  // --- Audit log (P1#20) ---
  app.get("/api/audit-log", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Audit log requires Studio.", entries: [] }, 402);
    const rows = await c.env.DB.prepare(
      "SELECT id, actor_user_id, action, target, meta_json, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({ entries: rows.results ?? [], retention_days: 90 });
  });

  // --- Compose starter templates pack (P1#23) ---
  app.post("/api/templates/seed-domain", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as { locale?: string };
    const locale = (body.locale || "en").slice(0, 8);
    const pack = [
      { name: "Thanks", subject: "Thanks for reaching out", html: "<p>Thanks for your message. I appreciate you writing in.</p>" },
      { name: "Pricing", subject: "Pricing details", html: "<p>Happy to share pricing. Here is a quick overview of our plans.</p>" },
      { name: "Bug ack", subject: "We got your bug report", html: "<p>Thanks for the report. We are looking into it and will update you.</p>" },
      { name: "Waitlist", subject: "You are on the waitlist", html: "<p>You are on the list. We will email you when it is your turn.</p>" },
    ];
    const created = [];
    for (const t of pack) {
      const id = randomId("tpl");
      await c.env.DB.prepare(
        "INSERT INTO templates (id, user_id, name, subject, html_body, text_body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(id, ctx.workspaceId, `${t.name} (${locale})`, t.subject, t.html, t.html.replace(/<[^>]+>/g, ""), nowMs(), nowMs())
        .run()
        .catch(() => undefined);
      created.push(id);
    }
    return c.json({ ok: true, created: created.length, locale });
  });

  // --- Scheduled digest prefs (P1#15) ---
  app.post("/api/digests/weekly", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "Weekly digests require Builder or Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean; weekday?: number };
    await c.env.DB.prepare(
      `INSERT INTO scheduled_digests (user_id, enabled, weekday) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, weekday = excluded.weekday`,
    )
      .bind(ctx.workspaceId, body.enabled ? 1 : 0, Math.min(6, Math.max(0, Number(body.weekday) || 1)))
      .run();
    return c.json({ ok: true });
  });

  // --- CF Routing migrate checklist (P1#14) ---
  app.post("/api/migrate/cf-routing", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = (await c.req.json().catch(() => ({}))) as { domain?: string; routes?: string[] };
    const domain = (body.domain || "").toLowerCase().trim();
    const routes = Array.isArray(body.routes) ? body.routes.slice(0, 100) : [];
    return c.json({
      domain,
      checklist: [
        "Export Cloudflare Email Routing rules (destinations and custom addresses).",
        "Add the domain in Flap and publish Amazon SES MX/SPF/DKIM (not CF Email Routing).",
        "Create matching aliases in Flap for each CF route.",
        "Lower CF Routing priority or remove routes after Flap MX verifies green.",
        "Send a test to hello@ and confirm delivery in Flap.",
      ],
      suggested_aliases: routes,
      honesty: "Flap customer mail uses Amazon SES. Cloudflare hosts the Flap app (Workers/D1/R2), not your mailbox transport.",
    });
  });

  // --- Import wizard stubs (P1#13) ---
  app.post("/api/migrate/import", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Import wizard requires Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { source?: string };
    const source = (body.source || "").toLowerCase();
    return c.json({
      source,
      steps:
        source === "gmail"
          ? ["Connect Google OAuth (coming next)", "Select labels to map", "Import recent mail metadata", "Map aliases"]
          : source === "improvmx"
            ? ["Paste ImprovMX alias export CSV", "Map destinations to Flap mailboxes", "Publish Flap MX", "Disable ImprovMX forwarding"]
            : ["Choose Gmail or ImprovMX", "Follow the guided mapping", "Cut over MX when ready"],
      status: "wizard_ready",
    });
  });

  // --- Client portal (P1#12) ---
  app.post("/api/client-portals", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Client portals require Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { name?: string; mailbox_ids?: string[] };
    const id = randomId("portal");
    const slug = randomId("cp").slice(-10);
    await c.env.DB.prepare(
      "INSERT INTO client_portals (id, user_id, name, public_slug, mailbox_ids_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, (body.name || "Client").slice(0, 80), slug, JSON.stringify(body.mailbox_ids || []), nowMs())
      .run();
    return c.json({ portal: { id, url: `https://useflap.online/portal/${slug}`, slug } }, 201);
  });

  // --- VA / shadow inbox (P2#5) ---
  app.post("/api/va-invites", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "VA mode requires Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string; mailbox_ids?: string[]; days?: number };
    const id = randomId("va");
    const token = randomId("vatoken");
    const days = Math.min(90, Math.max(1, Number(body.days) || 14));
    await c.env.DB.prepare(
      "INSERT INTO va_invites (id, user_id, email, mailbox_ids_json, expires_at, token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, (body.email || "").toLowerCase(), JSON.stringify(body.mailbox_ids || []), nowMs() + days * 86400_000, token, nowMs())
      .run();
    return c.json({ invite: { id, url: `https://useflap.online/invite/va/${token}`, expires_in_days: days } }, 201);
  });

  // --- Newsletter one-shot (P2#2) ---
  app.post("/api/newsletter/one-shot", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "One-shot newsletter requires Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      domain_id?: string;
      subject?: string;
      html_body?: string;
      recipient_tag?: string;
      confirm_double_opt_in?: boolean;
    };
    if (!body.confirm_double_opt_in) {
      return c.json({ error: "Double opt-in confirmation required. This is not a full ESP." }, 400);
    }
    const id = randomId("blast");
    await c.env.DB.prepare(
      `INSERT INTO newsletter_blasts (id, user_id, domain_id, subject, html_body, recipient_tag, status, capped_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || "",
        (body.subject || "").slice(0, 200),
        (body.html_body || "").slice(0, 100_000),
        (body.recipient_tag || "launch").slice(0, 64),
        nowMs(),
      )
      .run();
    return c.json({
      blast: { id, status: "queued" },
      hard_cap: 500,
      note: "One-shot only. Hard cap 500 recipients per blast. Not a Mailchimp replacement.",
    }, 201);
  });

  // --- Retention policies (P2#11) ---
  app.post("/api/domains/:id/retention", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Custom retention requires Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { days?: number | null; legal_hold?: boolean };
    const days = body.days == null ? null : Math.min(3650, Math.max(7, Number(body.days)));
    await c.env.DB.prepare("UPDATE domains SET retention_days = ?, legal_hold = ? WHERE id = ? AND user_id = ?")
      .bind(days, body.legal_hold ? 1 : 0, c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true, retention_days: days, legal_hold: Boolean(body.legal_hold) });
  });

  // --- Parse rules (P2#9) ---
  app.post("/api/parse-rules", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "Parse rules require Builder or Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      name?: string;
      pattern?: string;
      field_name?: string;
      domain_id?: string;
    };
    const id = randomId("parse");
    await c.env.DB.prepare(
      "INSERT INTO parse_rules (id, user_id, domain_id, name, pattern, field_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        ctx.workspaceId,
        body.domain_id || null,
        (body.name || "Rule").slice(0, 80),
        (body.pattern || "").slice(0, 500),
        (body.field_name || "field").slice(0, 64),
        nowMs(),
      )
      .run();
    return c.json({ rule: { id } }, 201);
  });

  // --- Embed widget (P2#15) ---
  app.post("/api/embed-widgets", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "Embed widgets require Builder or Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { mailbox_id?: string };
    const id = randomId("emb");
    const slug = randomId("ew").slice(-10);
    await c.env.DB.prepare(
      "INSERT INTO embed_widgets (id, user_id, mailbox_id, public_slug, created_at) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, body.mailbox_id || "", slug, nowMs())
      .run();
    return c.json({
      widget: { id, slug, script: `<script src="https://useflap.online/embed/${slug}.js" async></script>` },
    }, 201);
  });

  app.get("/api/public/embed/:slug", async (c) => {
    const slug = c.req.param("slug");
    const widget = await c.env.DB.prepare(
      "SELECT mailbox_id, user_id FROM embed_widgets WHERE public_slug = ? AND enabled = 1",
    )
      .bind(slug)
      .first<{ mailbox_id: string; user_id: string }>();
    if (!widget) return c.json({ messages: [] }, 404);
    const rows = await c.env.DB.prepare(
      `SELECT subject, snippet, created_at FROM messages
       WHERE user_id = ? AND mailbox_id = ? AND folder = 'inbox' AND label = 'public'
       ORDER BY created_at DESC LIMIT 10`,
    )
      .bind(widget.user_id, widget.mailbox_id)
      .all();
    return c.json({ messages: rows.results ?? [] });
  });

  // --- MCP light (P2#1) read-only ---
  app.post("/api/mcp", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "MCP light requires Builder or Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { method?: string; params?: Record<string, unknown> };
    const method = body.method || "list_domains";
    if (method === "list_domains") {
      const rows = await c.env.DB.prepare("SELECT id, name, color FROM domains WHERE user_id = ?")
        .bind(ctx.workspaceId)
        .all();
      return c.json({ result: rows.results ?? [] });
    }
    if (method === "unread_counts") {
      const rows = await c.env.DB.prepare(
        `SELECT d.name, COUNT(*) AS unread FROM messages m
         JOIN mailboxes mb ON mb.id = m.mailbox_id
         JOIN domains d ON d.id = mb.domain_id
         WHERE m.user_id = ? AND m.folder = 'inbox' AND m.unread = 1
         GROUP BY d.id`,
      )
        .bind(ctx.workspaceId)
        .all();
      return c.json({ result: rows.results ?? [] });
    }
    if (method === "thread_summary") {
      return c.json({
        result: { note: "Use /api/ai/summarize with confirm. MCP never auto-sends." },
        auto_send: false,
      });
    }
    if (method === "draft_with_confirm") {
      return c.json({
        result: { draft: body.params?.text || "", confirm_required: true, auto_send: false },
      });
    }
    return c.json({ error: `Unknown method ${method}. Allowed: list_domains, unread_counts, thread_summary, draft_with_confirm.` }, 400);
  });

  // --- Competitor switcher packs (P2#13) ---
  app.get("/api/migrate/switchers", (c) =>
    c.json({
      packs: [
        { id: "folio", name: "Folio", steps: ["Export Folio mailbox", "Add domains in Flap", "Publish SES DNS", "Cut over MX"] },
        { id: "hydra", name: "Hydra", steps: ["List Hydra domains", "Recreate aliases in Flap", "Point MX to SES", "Verify receiving"] },
        { id: "migadu", name: "Migadu", steps: ["Export aliases", "Create Flap mailboxes", "Update MX", "Retire Migadu DNS"] },
        { id: "justemails", name: "JustEmails", steps: ["Export IMAP if needed", "Add domains", "Flap DNS", "Optional IMAP later (2026-10-15)"] },
      ],
    }),
  );

  // --- API v2 stub + labels (P1#16, P2#7) ---
  app.get("/api/v2/labels", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "API v2 requires Builder or Studio." }, 402);
    const rows = await c.env.DB.prepare("SELECT id, name, color FROM labels WHERE user_id = ?")
      .bind(ctx.workspaceId)
      .all();
    return c.json({ data: rows.results ?? [], api_version: "2" });
  });

  app.get("/api/v2/openapi.json", (c) =>
    c.json({
      openapi: "3.0.0",
      info: { title: "Flap API v2", version: "2.0.0" },
      paths: {
        "/api/v2/labels": { get: { summary: "List labels" } },
        "/api/mcp": { post: { summary: "MCP light (read-only + draft confirm)" } },
      },
    }),
  );

  // --- Push subscription (P2#10) ---
  app.post("/api/push/subscribe", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const body = (await c.req.json().catch(() => ({}))) as { endpoint?: string; keys?: Record<string, string> };
    if (!body.endpoint) return c.json({ error: "endpoint required." }, 400);
    const id = randomId("push");
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, keys_json, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET keys_json = excluded.keys_json`,
    )
      .bind(id, ctx.workspaceId, body.endpoint, JSON.stringify(body.keys || {}), nowMs())
      .run()
      .catch(() => undefined);
    return c.json({ ok: true });
  });

  // --- Custom webhook host (P1#19) ---
  app.post("/api/webhook-hosts", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Custom webhook hosts require Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { hostname?: string };
    const hostname = (body.hostname || "").toLowerCase().trim();
    if (!hostname) return c.json({ error: "hostname required." }, 400);
    const id = randomId("hookhost");
    await c.env.DB.prepare(
      "INSERT INTO webhook_custom_hosts (id, user_id, hostname, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, hostname, nowMs())
      .run()
      .catch(() => undefined);
    return c.json({
      host: { id, hostname, verified: false },
      dns: { type: "CNAME", name: hostname, value: "hooks.useflap.online" },
    }, 201);
  });

  // --- Multi-workspace stub (P2#8) ---
  app.get("/api/holding-workspaces", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const plan = await getEffectivePlan(c.env.DB, user.id);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ workspaces: [], note: "Multi-workspace requires Studio." });
    const rows = await c.env.DB.prepare("SELECT id, name, created_at FROM workspaces_extra WHERE owner_user_id = ?")
      .bind(user.id)
      .all();
    return c.json({ workspaces: rows.results ?? [] });
  });

  app.post("/api/holding-workspaces", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const plan = await getEffectivePlan(c.env.DB, user.id);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Multi-workspace requires Studio." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { name?: string };
    const id = randomId("hold");
    await c.env.DB.prepare(
      "INSERT INTO workspaces_extra (id, owner_user_id, name, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(id, user.id, (body.name || "Holding").slice(0, 80), nowMs())
      .run();
    return c.json({ workspace: { id, name: body.name } }, 201);
  });

  // --- BIMI / MTA-STS assist (P2#12) ---
  app.get("/api/domains/:id/auth-upgrades", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "Auth upgrades require Builder or Studio." }, 402);
    const domain = await c.env.DB.prepare("SELECT name FROM domains WHERE id = ? AND user_id = ?")
      .bind(c.req.param("id"), ctx.workspaceId)
      .first<{ name: string }>();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
    const d = domain.name;
    return c.json({
      domain: d,
      bimi: {
        record: `default._bimi.${d} TXT "v=BIMI1; l=https://${d}/bimi.svg; a="`,
        note: "SVG logo + optional VMC. Start with DMARC quarantine/reject.",
      },
      mta_sts: {
        policy_host: `mta-sts.${d}`,
        txt: `_mta-sts.${d} TXT "v=STSv1; id=${Date.now()}"`,
        policy_url: `https://mta-sts.${d}/.well-known/mta-sts.txt`,
        tlsrpt: `_smtp._tls.${d} TXT "v=TLSRPTv1; rua=mailto:tlsrpt@${d}"`,
      },
    });
  });

  // --- SSO stub (P2#3) ---
  app.get("/api/sso/status", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const plan = await getEffectivePlan(c.env.DB, user.id);
    return c.json({
      available: planAtLeast(plan.plan_id, "studio"),
      providers: ["google_workspace_oidc", "okta_saml"],
      status: "configure_in_dashboard",
      note: "SSO wiring for Studio orgs. Contact support to enable IdP metadata.",
    });
  });

  // --- Domain IAM stub (P2#4) ---
  app.get("/api/domain-iam", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "Domain IAM requires Studio.", roles: [] }, 402);
    return c.json({
      roles: [
        { id: "send_all", label: "Can send as any domain mailbox" },
        { id: "send_mapped", label: "Can send only on mapped domains" },
        { id: "read_only", label: "Read-only shared inbox" },
      ],
      note: "Map Studio seats to domains in Team settings. Least-privilege for agencies.",
    });
  });

  // --- War room (P2#6) ---
  app.get("/api/deliverability/war-room", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "studio")) return c.json({ error: "War room requires Studio." }, 402);
    const domains = await c.env.DB.prepare(
      "SELECT id, name, color, reputation_mode, parked FROM domains WHERE user_id = ?",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({
      heat_map: (domains.results ?? []).map((d: Record<string, unknown>) => ({
        domain_id: d.id,
        name: d.name,
        color: d.color,
        risk: d.parked ? "paused" : "ok",
      })),
      actions: ["pause_sending", "suppress_recipient", "isolate_domain"],
    });
  });

  // --- Open tracking default off (P1#17) ---
  app.post("/api/mail/:id/open-track", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Open tracking opt-in requires Solo+." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean };
    await c.env.DB.prepare("UPDATE messages SET open_track = ? WHERE id = ? AND user_id = ?")
      .bind(body.enabled ? 1 : 0, c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true, open_track: Boolean(body.enabled), default: false });
  });

  // --- Virus quarantine list (P1#18) ---
  app.get("/api/quarantine", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "builder")) return c.json({ error: "Quarantine requires Builder+.", items: [] }, 402);
    const rows = await c.env.DB.prepare(
      "SELECT id, subject, from_addr, virus_status, created_at FROM messages WHERE user_id = ? AND virus_status = 'quarantine' ORDER BY created_at DESC LIMIT 50",
    )
      .bind(ctx.workspaceId)
      .all();
    return c.json({
      items: rows.results ?? [],
      note: "Attachments are scanned when a scanner is configured. Quarantined items stay undownloadable until released.",
    });
  });

  // --- ICS RSVP helper (P1#8) ---
  app.post("/api/calendar/rsvp", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "solo")) return c.json({ error: "Calendar RSVP requires Solo or higher." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as {
      message_id?: string;
      response?: "accept" | "decline" | "maybe";
    };
    const response = body.response || "accept";
    return c.json({
      ok: true,
      response,
      reply_subject: `RSVP: ${response}`,
      note: "Flap will attach a reply .ics when the original invite is detected. Confirm before send.",
    });
  });

  // --- Referral after verify payload (P1#25) ---
  app.get("/api/referrals/after-verify", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const ref = await c.env.DB.prepare("SELECT referral_code FROM users WHERE id = ?")
      .bind(ctx.workspaceId)
      .first<{ referral_code: string | null }>();
    const code = ref?.referral_code || "";
    return c.json({
      title: "Invite a founder, both get +1 domain",
      share_url: code ? `https://useflap.online/signup?ref=${code}` : "https://useflap.online/signup",
      share_text: "I just verified a domain on Flap. One inbox for every startup domain.",
    });
  });

  // --- Export trust copy (P0#16) ---
  app.get("/api/trust/export-policy", (c) =>
    c.json({
      cancel_export_window_days: 30,
      formats: [".mbox", "JSON backup"],
      retention: "You can export anytime from Settings. After cancel, a 30-day export window remains for paid accounts.",
      ownership: "Your mail stays yours. Flap is not a hostage inbox.",
    }),
  );

  // --- SLA copy (P2#14) honest ---
  app.get("/api/support/sla", (c) =>
    c.json({
      studio: {
        response_target: "1 business day",
        channel: "support@useflap.online",
        note: "Studio priority support target. Not a contractual uptime SLA yet.",
      },
      others: { channel: "support@useflap.online", note: "Best-effort email support." },
    }),
  );
}
