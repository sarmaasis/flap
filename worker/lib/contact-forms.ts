/**
 * Public contact forms and embed widgets.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerContactFormRoutes(app: Hono<AppEnv>) {
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

  // --- Embed widget (P2#15) ---
  app.post("/api/embed-widgets", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "Embed widgets require Pro or Team." }, 402);
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

}
