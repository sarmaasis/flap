/**
 * Thread presence, client portals, VA invites, audit log, holding workspaces.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerCollaborationExtraRoutes(app: Hono<AppEnv>) {
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

}
