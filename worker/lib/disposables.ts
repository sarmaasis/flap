/**
 * Temporary disposable share addresses with TTL.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerDisposableRoutes(app: Hono<AppEnv>) {
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

}
