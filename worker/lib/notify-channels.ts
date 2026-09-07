/**
 * Slack/Discord notify channels, push subscriptions, weekly digests.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerNotifyChannelRoutes(app: Hono<AppEnv>) {
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

  // --- Scheduled digest prefs (P1#15) ---
  app.post("/api/digests/weekly", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "Weekly digests require Pro or Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { enabled?: boolean; weekday?: number };
    await c.env.DB.prepare(
      `INSERT INTO scheduled_digests (user_id, enabled, weekday) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, weekday = excluded.weekday`,
    )
      .bind(ctx.workspaceId, body.enabled ? 1 : 0, Math.min(6, Math.max(0, Number(body.weekday) || 1)))
      .run();
    return c.json({ ok: true });
  });

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

}
