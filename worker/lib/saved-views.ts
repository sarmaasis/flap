/**
 * Saved inbox views (filters users pin and reopen).
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { PLANS } from "./plans";
import { type AppEnv } from "./plan-guard";

export function registerSavedViewRoutes(app: Hono<AppEnv>) {
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

}
