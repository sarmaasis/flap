/**
 * Theme and extended workspace preference APIs.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { resolveWorkspace } from "./team";
import { type AppEnv } from "./plan-guard";

export function registerPrefsExtraRoutes(app: Hono<AppEnv>) {
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

}
