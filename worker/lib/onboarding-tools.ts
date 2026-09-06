/**
 * New-project wizard, compose template packs, CF/Gmail/ImprovMX migrate helpers.
 */
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { requireUser } from "./auth";
import { getEffectivePlan } from "./billing";
import { nowMs, randomId } from "./ids";
import { resolveWorkspace } from "./team";
import { planAtLeast, type AppEnv } from "./plan-guard";

export function registerOnboardingToolRoutes(app: Hono<AppEnv>) {
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

}
