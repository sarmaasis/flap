/**
 * Domain park, reputation, retention, health badge, deliverability, auth upgrades.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, writeAuditLog, type AppEnv } from "./plan-guard";

export function registerDomainControlRoutes(app: Hono<AppEnv>) {
  // --- Domain park (P1#21) ---
  app.post("/api/domains/:id/park", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can park domains." }, 403);
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
    await writeAuditLog(c.env.DB, ctx.workspaceId, user.id, body.parked ? "park_domain" : "unpark_domain", c.req.param("id"));
    return c.json({ ok: true, parked: Boolean(body.parked), park_mode: mode });
  });

  // --- Reputation mode (P1#4) ---
  app.post("/api/domains/:id/reputation-mode", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can change reputation mode." }, 403);
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
    const mode = body.mode === "isolated" ? "isolated" : "shared";
    if (mode === "isolated" && !planAtLeast(plan.plan_id, "team")) {
      return c.json({ error: "Isolated reputation mode requires Team." }, 402);
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
    if (!planAtLeast(plan.plan_id, "pro")) {
      return c.json({ error: "Deliverability dashboard requires Pro or Team.", domains: [] }, 402);
    }
    const days = planAtLeast(plan.plan_id, "team") ? 90 : 14;
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
      note: "SES bounce/complaint events appear here when SNS/webhooks are wired. Shared pool is the default; Isolated is Team-only.",
    });
  });

  // --- Domain health badge (P1#6) ---
  app.post("/api/domains/:id/health-badge", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can manage health badges." }, 403);
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
    const color = ok ? "#0a7b6f" : "#b47828";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="24" role="img"><rect width="160" height="24" rx="4" fill="#111"/><text x="8" y="16" fill="#fff" font-size="11" font-family="sans-serif">Flap</text><rect x="48" width="112" height="24" fill="${color}"/><text x="56" y="16" fill="#fff" font-size="11" font-family="sans-serif">${String(row?.name ?? "domain").slice(0, 18)} ${label}</text></svg>`;
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300" } });
  });

  // --- Pre-MX probe (P0#11) ---
  app.post("/api/domains/:id/pre-mx-test", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can run domain checks." }, 403);
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

  // --- Retention policies (P2#11) ---
  app.post("/api/domains/:id/retention", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can change retention." }, 403);
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "Custom retention requires Team." }, 402);
    const body = (await c.req.json().catch(() => ({}))) as { days?: number | null; legal_hold?: boolean };
    const days = body.days == null ? null : Math.min(3650, Math.max(7, Number(body.days)));
    await c.env.DB.prepare("UPDATE domains SET retention_days = ?, legal_hold = ? WHERE id = ? AND user_id = ?")
      .bind(days, body.legal_hold ? 1 : 0, c.req.param("id"), ctx.workspaceId)
      .run();
    return c.json({ ok: true, retention_days: days, legal_hold: Boolean(body.legal_hold) });
  });

  // --- BIMI / MTA-STS assist (P2#12) ---
  app.get("/api/domains/:id/auth-upgrades", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    if (!ctx.canManageSettings) return c.json({ error: "Only owners and admins can view auth upgrades." }, 403);
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "pro")) return c.json({ error: "Auth upgrades require Pro or Team." }, 402);
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

  // --- Domain IAM stub (P2#4) ---
  app.get("/api/domain-iam", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "Domain IAM requires Team.", roles: [] }, 402);
    return c.json({
      roles: [
        { id: "send_all", label: "Can send as any domain mailbox" },
        { id: "send_mapped", label: "Can send only on mapped domains" },
        { id: "read_only", label: "Read-only shared inbox" },
      ],
      note: "Map Team seats to domains in Team settings. Least-privilege for agencies.",
    });
  });

  // --- War room (P2#6) ---
  app.get("/api/deliverability/war-room", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const plan = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (!planAtLeast(plan.plan_id, "team")) return c.json({ error: "War room requires Team." }, 402);
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

}
