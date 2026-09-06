/**
 * Rule template marketplace, parse rules, plus-address helpers, AI assist.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { mailboxAccessClause, resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerAutomationRoutes(app: Hono<AppEnv>) {
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
    const enabled = body.enabled ? 1 : 0;
    const now = nowMs();
    // Full upsert — partial INSERT fails when updated_at / other NOT NULL cols lack defaults.
    await c.env.DB.prepare(
      `INSERT INTO user_settings (user_id, vacation_enabled, vacation_body, notify_browser, undo_send_seconds, ai_opt_in, updated_at)
       VALUES (?, 0, '', 0, 10, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET ai_opt_in = excluded.ai_opt_in, updated_at = excluded.updated_at`,
    )
      .bind(ctx.workspaceId, enabled, now)
      .run();
    return c.json({ ok: true, ai_opt_in: Boolean(enabled) });
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

}
