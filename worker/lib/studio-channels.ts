/**
 * Newsletter, MCP/API v2, webhook hosts, quarantine, tracking, calendar, trust copy.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerStudioChannelRoutes(app: Hono<AppEnv>) {
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
