import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { getSessionUser, requireUser, userCount } from "./lib/auth";
import { clerkConfigured } from "./lib/clerk";
import { randomId, nowMs } from "./lib/ids";
import { handleEmail } from "./email";
import {
  HEADER_VALUE_RE,
  makeSnippet,
  normalizeRecipientField,
  parseRecipients,
  recipientsFieldValid,
} from "./lib/mailutil";
import { dispatchStoredMessage, flushScheduled, loadSettings, normalizeMessageId, registerWorkspaceRoutes, touchContact } from "./lib/workspace";
import { processQueuedNewsletterBlasts } from "./lib/studio-channels";
import { assertWithinLimit, assertSendRoom, assertStorageRoom, getEffectivePlan, messageStorageBytes, recordOutboundSend, registerBillingRoutes } from "./lib/billing";
import { registerDnsToolRoutes } from "./lib/dns-tools";
import { registerGrowthRoutes } from "./lib/growth";
import { registerInboundWebhookRoutes } from "./lib/inbound-webhook";
import { registerProductFeatureRoutes } from "./lib/product-features";
import { registerFeatureRoutes } from "./lib/feature-routes";
import {
  canSendFromDomain,
  canSendMail,
  defaultCustomerDnsRecords,
  deleteCustomerDomain,
  parseStoredDnsJson,
  provisionCustomerDomain,
} from "./lib/mail-provider";
import { afterDomainAdded, markFirstEmailSent } from "./lib/activation";
import {
  assertMailboxAccess,
  listAccessibleMailboxes,
  mailboxAccessClause,
  resolveWorkspace,
  setMailboxShared,
  type WorkspaceCtx,
} from "./lib/team";
import { isAddressSuppressed } from "./lib/inbound-webhook";
import { domainIsSendingReady, loadDomain } from "./lib/domain-readiness";
import { trackServerEvent } from "./lib/analytics";
import { InboxHub } from "./inbox-hub";
import { isKnownClientPath, normalizePathname } from "../shared/client-routes";

export { InboxHub };

type App = { Bindings: Env };
const app = new Hono<App>();

const FOLDERS = new Set(["inbox", "sent", "drafts", "spam", "trash", "archive", "scheduled"]);
const VIRTUAL_FOLDERS = new Set(["starred", "snoozed"]);
const DOMAIN_RE = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const MAX_OUTBOUND_ATTACHMENTS = 10;
const MAX_OUTBOUND_ATTACHMENT_BYTES = 25 * 1024 * 1024;
type OutboundAttachment = { filename?: string; content_type?: string; data?: string };

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Clerk needs FAPI / protect / Cloudflare challenge hosts. See:
  // https://clerk.com/docs/guides/secure/best-practices/csp-headers
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://challenges.cloudflare.com https://*.protect.clerk.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: cid: https://img.clerk.com",
      "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://*.protect.clerk.com",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.com https://clerk-telemetry.com https://*.clerk-telemetry.com https://img.clerk.com https://*.protect.clerk.com:*",
    ].join("; "),
  );
});

/**
 * SPA shells for app/auth paths.
 *
 * Critical: never forward Assets responses for `/index.html` — default
 * `html_handling: auto-trailing-slash` returns 307 Location:/ for that path,
 * which bounced hard-refresh of `/app` to the marketing homepage.
 * Serve the dedicated `/spa-shell` asset (or `/` body) with a forced 200.
 */
async function serveSpaShell(c: { env: Env; req: { raw: Request; url: string } }) {
  const origin = new URL(c.req.url).origin;
  const tryUrls = ["/spa-shell", "/", "/index.html"];
  let body: ReadableStream | null = null;
  for (const path of tryUrls) {
    try {
      const res = await c.env.ASSETS.fetch(new Request(new URL(path, origin), { redirect: "follow" }));
      if (res.ok && res.body) {
        body = res.body;
        break;
      }
    } catch (err) {
      // Dev-only: after a bad wrangler.jsonc HMR, ASSETS.fetch can throw "fetch failed".
      console.error("[spa-shell] ASSETS.fetch failed for", path, err);
    }
  }
  if (!body) {
    return new Response("Flap SPA shell unavailable — restart `npm run dev` if this persists after a wrangler config change.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-flap-shell": "spa",
    },
  });
}

/**
 * Marketing HTML: prefer prerendered Assets shell; if missing (Vite dev / incomplete
 * build) serve SPA index so React can route. Unknown paths under a prefix still get
 * the hard 404 asset (`not_found_handling: 404-page`).
 */
async function servePrerenderOrSpa(c: { env: Env; req: { raw: Request; url: string } }) {
  const url = new URL(c.req.url);
  const pathname = normalizePathname(url.pathname);
  const assetRes = await c.env.ASSETS.fetch(
    new Request(new URL(pathname, url.origin), {
      method: "GET",
      headers: c.req.raw.headers,
      redirect: "manual",
    }),
  );
  if (assetRes.ok && assetRes.body) {
    const headers = new Headers(assetRes.headers);
    headers.set("x-flap-shell", "prerender");
    return new Response(assetRes.body, { status: assetRes.status, headers });
  }
  if (isKnownClientPath(pathname)) {
    return serveSpaShell(c);
  }
  // Unknown slug under /blog/* etc. — keep hard 404 HTML from Assets.
  if (assetRes.status === 404 && assetRes.body) {
    return new Response(assetRes.body, {
      status: 404,
      headers: {
        "content-type": assetRes.headers.get("content-type") || "text/html; charset=utf-8",
        "cache-control": "no-store",
        "x-flap-shell": "hard-404",
      },
    });
  }
  return serveSpaShell(c);
}

app.get("/app", (c) => serveSpaShell(c));
app.get("/app/", (c) => serveSpaShell(c));
app.get("/app/*", (c) => serveSpaShell(c));
app.get("/signup", (c) => serveSpaShell(c));
app.get("/login", (c) => serveSpaShell(c));
app.get("/setup", (c) => serveSpaShell(c));
app.get("/verify-email", (c) => serveSpaShell(c));
app.get("/sso-callback", (c) => serveSpaShell(c));
app.get("/auth/verify", (c) => serveSpaShell(c));
app.get("/forgot-password", (c) => serveSpaShell(c));
app.get("/reset-password", (c) => serveSpaShell(c));
app.get("/invite", (c) => serveSpaShell(c));
app.get("/invite/*", (c) => serveSpaShell(c));
app.get("/settings/referrals", (c) => serveSpaShell(c));

app.get("/about", (c) => servePrerenderOrSpa(c));
app.get("/pricing", (c) => servePrerenderOrSpa(c));
app.get("/book/*", (c) => servePrerenderOrSpa(c));
app.get("/book", (c) => servePrerenderOrSpa(c));
app.get("/research/*", (c) => servePrerenderOrSpa(c));
app.get("/research", (c) => servePrerenderOrSpa(c));
app.get("/vs/*", (c) => servePrerenderOrSpa(c));
app.get("/vs", (c) => servePrerenderOrSpa(c));
app.get("/for/*", (c) => servePrerenderOrSpa(c));
app.get("/for", (c) => servePrerenderOrSpa(c));
app.get("/security", (c) => servePrerenderOrSpa(c));
app.get("/support", (c) => servePrerenderOrSpa(c));
app.get("/status", (c) => servePrerenderOrSpa(c));
app.get("/terms", (c) => servePrerenderOrSpa(c));
app.get("/privacy", (c) => servePrerenderOrSpa(c));
app.get("/billing-terms", (c) => servePrerenderOrSpa(c));
app.get("/tools", (c) => servePrerenderOrSpa(c));
app.get("/tools/*", (c) => servePrerenderOrSpa(c));
app.get("/docs", (c) => servePrerenderOrSpa(c));
app.get("/docs/*", (c) => servePrerenderOrSpa(c));
app.get("/guides", (c) => servePrerenderOrSpa(c));
app.get("/guides/*", (c) => servePrerenderOrSpa(c));
app.get("/blog", (c) => servePrerenderOrSpa(c));
app.get("/blog/*", (c) => servePrerenderOrSpa(c));
app.get("/google-workspace-alternative", (c) => servePrerenderOrSpa(c));
app.get("/email-hosting-for-multiple-domains", (c) => servePrerenderOrSpa(c));
app.get("/custom-domain-email", (c) => servePrerenderOrSpa(c));
app.get("/email-for-indie-hackers", (c) => servePrerenderOrSpa(c));
app.get("/email-for-side-projects", (c) => servePrerenderOrSpa(c));
app.get("/flap-vs-google-workspace", (c) => servePrerenderOrSpa(c));
app.get("/flap-vs-zoho", (c) => servePrerenderOrSpa(c));
app.get("/multiple-domains-one-inbox", (c) => servePrerenderOrSpa(c));
app.get("/cloudflare-email-routing-alternative", (c) => servePrerenderOrSpa(c));
app.get("/hydra-alternative", (c) => servePrerenderOrSpa(c));
app.get("/folio-alternative", (c) => servePrerenderOrSpa(c));
app.get("/justemails-alternative", (c) => servePrerenderOrSpa(c));
app.get("/migadu-alternative", (c) => servePrerenderOrSpa(c));
app.get("/improvmx-alternative", (c) => servePrerenderOrSpa(c));

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    name: "Flap",
    product: "useflap.online",
    time: Date.now(),
  }),
);

/** Authenticated WebSocket upgrade → workspace InboxHub (hibernation fan-out). */
app.get("/api/events/ws", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  if (!c.env.INBOX_HUB) return c.json({ error: "Realtime unavailable." }, 503);
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade." }, 426);
  }
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const id = c.env.INBOX_HUB.idFromName(ctx.workspaceId);
  const stub = c.env.INBOX_HUB.get(id);
  return stub.fetch(c.req.raw);
});

app.get("/api/setup/status", async (c) => {
  const n = await userCount(c.env.DB);
  const saas = (c.env.SAAS_MODE || "true").toLowerCase() !== "false";
  return c.json({ needs_setup: n === 0, signup_open: saas || n === 0 });
});

/** First-boot: open Clerk signup; product user is created on first authenticated API call. */
app.post("/api/setup", async (c) => {
  if ((await userCount(c.env.DB)) > 0) {
    return c.json({ error: "Setup is already complete. Sign in or create an account instead." }, 409);
  }
  if (!clerkConfigured(c.env)) {
    return c.json({ error: "Clerk is not configured. Set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY." }, 503);
  }
  return c.json({
    ok: true,
    redirect: "/signup",
    message: "Create the first account with Clerk on /signup.",
  });
});

app.get("/api/public-config", (c) =>
  c.json({
    clerkPublishableKey: (c.env.CLERK_PUBLISHABLE_KEY || "").trim(),
    clerkConfigured: clerkConfigured(c.env),
    /** Preferred public origin — SPA may redirect localhost ↔ 127.0.0.1 to match. */
    appUrl: (c.env.APP_URL || "").trim().replace(/\/$/, ""),
  }),
);

/** @deprecated Use Clerk on /signup. */
app.post("/api/signup", (c) =>
  c.json({ error: "Signup moved to Clerk. Use a magic link on /signup.", path: "/signup" }, 410),
);

/** @deprecated Use Clerk on /login. */
app.post("/api/login", (c) =>
  c.json({ error: "Login moved to Clerk. Use a magic link on /login.", path: "/login" }, 410),
);

/** Auth is Clerk magic-link only (no Google/GitHub in the Flap UI). */
app.get("/api/auth/providers", (c) => c.json({ google: false, github: false, clerk: clerkConfigured(c.env) }));

app.post("/api/logout", (c) => c.json({ ok: true }));

app.get("/api/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ user: null }, 401);
  const preferred = getCookie(c, "flap_ws") || undefined;
  const ctx = await resolveWorkspace(c.env.DB, user.id, preferred);
  const mailboxes = await listAccessibleMailboxes(c.env.DB, ctx);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_verified: user.emailVerified,
    },
    workspace: {
      id: ctx.workspaceId,
      role: ctx.role,
      is_owner: ctx.isOwner,
      can_manage_team: ctx.canManageTeam,
      can_manage_settings: ctx.canManageSettings,
    },
    mailboxes: mailboxes.results ?? [],
    auth: {
      has_password: false,
      providers: { google: false, github: false },
    },
  });
});

app.get("/api/domains", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) {
    return c.json({ domains: [], read_only: true });
  }
  const rows = await c.env.DB.prepare(
    `SELECT id, name, catch_all_mailbox_id, color, muted_until, mail_provider, provider_state, provider_region,
            identity_verified_at, mx_verified_at, inbound_rule_ready_at, receiving_ready_at,
            sending_ready_at, last_provider_check_at, last_provider_error, migration_from,
            migration_state, created_at
     FROM domains WHERE user_id = ? ORDER BY created_at ASC`,
  )
    .bind(ctx.workspaceId)
    .all();
  return c.json({ domains: rows.results ?? [] });
});

app.post("/api/domains", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can add domains." }, 403);

  const flapUser = await c.env.DB.prepare("SELECT email_verified_at FROM users WHERE id = ?")
    .bind(ctx.workspaceId)
    .first<{ email_verified_at: number | null }>();
  if (!flapUser?.email_verified_at) {
    return c.json({ error: "Verify your Flap account email before adding a domain." }, 403);
  }

  const body = await c.req.json().catch(() => ({})) as { name?: string };
  const name = normalizeDomain(body.name ?? "");
  if (!name) return c.json({ error: "Enter a domain, for example example.com." }, 400);

  // Reserved / system domains
  if (name === "useflap.online" || name.endsWith(".useflap.online") || name === "localhost") {
    return c.json({ error: "That domain is reserved." }, 400);
  }

  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?")
    .bind(ctx.workspaceId)
    .first<{ n: number }>();
  const limit = await assertWithinLimit(c.env.DB, ctx.workspaceId, "domains", Number(count?.n ?? 0));
  if (!limit.ok) {
    await trackServerEvent(c.env.DB, "plan_limit_reached", {
      userId: ctx.workspaceId,
      props: { limit: "domains" },
    });
    return c.json({ error: limit.error }, limit.status);
  }

  await trackServerEvent(c.env.DB, "domain_add_started", { userId: ctx.workspaceId, props: { domain: name } });

  const provisioned = await provisionCustomerDomain(c.env, name);
  if (!provisioned.ok) return c.json({ error: provisioned.error }, 502);

  const id = randomId("dom");
  try {
    await c.env.DB.prepare(
      `INSERT INTO domains (
         id, user_id, name, created_at, mail_provider, provider_state, provider_dns_json,
         provider_region, ses_identity_arn
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        ctx.workspaceId,
        name,
        nowMs(),
        provisioned.provider,
        provisioned.state,
        JSON.stringify(provisioned.dns),
        provisioned.region,
        provisioned.identityArn || null,
      )
      .run();
  } catch {
    return c.json({ error: "That domain is already on this account." }, 409);
  }
  await afterDomainAdded(c.env.DB, ctx.workspaceId);
  return c.json(
    {
      domain: {
        id,
        name,
        mail_provider: provisioned.provider,
        provider_state: provisioned.state,
        provider_region: provisioned.region,
        receiving_ready_at: null,
        sending_ready_at: null,
      },
      records: provisioned.dns,
    },
    201,
  );
});

app.delete("/api/domains/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can remove domains." }, 403);
  const existing = await c.env.DB.prepare(
    "SELECT id, name, mail_provider FROM domains WHERE id = ? AND user_id = ?",
  )
    .bind(c.req.param("id"), ctx.workspaceId)
    .first<{ id: string; name: string; mail_provider: string | null }>();
  if (!existing) return c.json({ error: "Domain not found." }, 404);
  await deleteCustomerDomain(c.env, existing.name, existing.mail_provider).catch(() => undefined);
  await c.env.DB.prepare("DELETE FROM domains WHERE id = ? AND user_id = ?")
    .bind(existing.id, ctx.workspaceId)
    .run();
  return c.json({ ok: true });
});

app.patch("/api/domains/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can update domains." }, 403);
  const body = await c.req.json().catch(() => ({})) as {
    catch_all_mailbox_id?: string | null;
    color?: string;
    muted_until?: number | null;
    muted_days?: number | null;
  };
  const domainId = c.req.param("id");
  const domain = await c.env.DB.prepare("SELECT id FROM domains WHERE id = ? AND user_id = ?")
    .bind(domainId, ctx.workspaceId)
    .first();
  if (!domain) return c.json({ error: "Domain not found." }, 404);
  let catchAll: string | null | undefined = body.catch_all_mailbox_id;
  if (catchAll) {
    const mailbox = await c.env.DB.prepare(
      "SELECT id FROM mailboxes WHERE id = ? AND user_id = ? AND domain_id = ?",
    )
      .bind(catchAll, ctx.workspaceId, domainId)
      .first();
    if (!mailbox) return c.json({ error: "Catch-all mailbox must belong to this domain." }, 400);
  }

  const patches: string[] = [];
  const binds: Array<string | number | null> = [];
  if ("catch_all_mailbox_id" in body) {
    patches.push("catch_all_mailbox_id = ?");
    binds.push(catchAll ?? null);
  }
  if (typeof body.color === "string") {
    patches.push("color = ?");
    binds.push(body.color.slice(0, 32));
  }
  if ("muted_until" in body) {
    patches.push("muted_until = ?");
    binds.push(body.muted_until == null ? null : Number(body.muted_until));
  } else if (typeof body.muted_days === "number") {
    patches.push("muted_until = ?");
    binds.push(body.muted_days > 0 ? nowMs() + body.muted_days * 86400000 : null);
  }
  if (!patches.length) return c.json({ error: "No updates provided." }, 400);
  binds.push(domainId, ctx.workspaceId);
  await c.env.DB.prepare(`UPDATE domains SET ${patches.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds)
    .run();
  return c.json({ ok: true });
});

app.get("/api/mailboxes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const rows = await listAccessibleMailboxes(c.env.DB, ctx);
  return c.json({ mailboxes: rows.results ?? [], workspace: { id: ctx.workspaceId, role: ctx.role } });
});

app.post("/api/mailboxes", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can create mailboxes." }, 403);
  const body = await c.req.json().catch(() => ({})) as { domain_id?: string; local_part?: string; is_shared?: boolean };
  const domain = await c.env.DB.prepare("SELECT id, name FROM domains WHERE id = ? AND user_id = ?")
    .bind(body.domain_id ?? "", ctx.workspaceId)
    .first<{ id: string; name: string }>();
  if (!domain) return c.json({ error: "Choose a domain first." }, 400);
  const local = (body.local_part ?? "").trim().toLowerCase();
  if (!/^[a-z0-9._+-]+$/.test(local)) {
    return c.json({ error: "Local part may use letters, numbers, dots, plus, underscore, and hyphen." }, 400);
  }
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM mailboxes WHERE user_id = ?")
    .bind(ctx.workspaceId)
    .first<{ n: number }>();
  const limit = await assertWithinLimit(c.env.DB, ctx.workspaceId, "mailboxes", Number(count?.n ?? 0));
  if (!limit.ok) return c.json({ error: limit.error }, limit.status);
  const isShared = body.is_shared === true ? 1 : 0;
  if (isShared) {
    const { limits } = await getEffectivePlan(c.env.DB, ctx.workspaceId);
    if (limits.team_seats <= 1) {
      return c.json({ error: "Shared mailboxes require a Team plan." }, 402);
    }
  }
  const address = `${local}@${domain.name}`;
  const id = randomId("mbx");
  try {
    await c.env.DB.prepare(
      "INSERT INTO mailboxes (id, user_id, domain_id, local_part, address, created_at, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, ctx.workspaceId, domain.id, local, address, nowMs(), isShared)
      .run();
  } catch {
    return c.json({ error: "That mailbox already exists." }, 409);
  }
  return c.json({ mailbox: { id, domain_id: domain.id, local_part: local, address, is_shared: isShared } }, 201);
});

app.patch("/api/mailboxes/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can update mailboxes." }, 403);
  const body = await c.req.json().catch(() => ({})) as { display_name?: string; is_shared?: boolean };
  if (typeof body.is_shared === "boolean") {
    const result = await setMailboxShared(c.env.DB, ctx, c.req.param("id"), body.is_shared);
    if (!result.ok) return c.json({ error: result.error }, result.status);
  }
  if (body.display_name !== undefined) {
    const res = await c.env.DB.prepare("UPDATE mailboxes SET display_name = ? WHERE id = ? AND user_id = ?")
      .bind(body.display_name.trim().slice(0, 80), c.req.param("id"), ctx.workspaceId)
      .run();
    if (!res.meta.changes) return c.json({ error: "Mailbox not found." }, 404);
  }
  return c.json({ ok: true });
});

app.delete("/api/mailboxes/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Only workspace owners and admins can delete mailboxes." }, 403);
  const res = await c.env.DB.prepare("DELETE FROM mailboxes WHERE id = ? AND user_id = ?")
    .bind(c.req.param("id"), ctx.workspaceId)
    .run();
  if (!res.meta.changes) return c.json({ error: "Mailbox not found." }, 404);
  return c.json({ ok: true });
});

app.get("/api/dns", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const domain = (c.req.query("domain") ?? "").trim().toLowerCase();
  const name = domain || "your-domain.com";
  if (domain) {
    const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
    const row = await c.env.DB.prepare(
      "SELECT provider_dns_json, mail_provider, provider_region FROM domains WHERE user_id = ? AND lower(name) = ?",
    )
      .bind(ctx.workspaceId, name)
      .first<{ provider_dns_json: string | null; mail_provider: string | null; provider_region: string | null }>();
    if (row) {
      await trackServerEvent(c.env.DB, "domain_dns_records_viewed", {
        userId: ctx.workspaceId,
        props: { domain: name, provider: row.mail_provider || "ses" },
      });
      return c.json({
        records: toClientDnsRecords(
          parseStoredDnsJson(row.provider_dns_json, name, {
            provider: row.mail_provider,
            region: row.provider_region,
          }),
        ),
      });
    }
  }
  return c.json({ records: toClientDnsRecords(defaultCustomerDnsRecords(name, c.env)) });
});

/** Start SES migration for a legacy Mailgun/CF domain (checklist only until MX cutover). */
app.post("/api/domains/:id/migrate-ses", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!ctx.canManageSettings) return c.json({ error: "Forbidden." }, 403);
  const row = await loadDomain(c.env.DB, c.req.param("id"));
  if (!row || row.user_id !== ctx.workspaceId) return c.json({ error: "Domain not found." }, 404);
  const from = (row.mail_provider || "mailgun").toLowerCase();
  if (from === "ses" && row.migration_state !== "rollback") {
    return c.json({ ok: true, already: true, domain: row });
  }
  const provisioned = await provisionCustomerDomain(c.env, row.name);
  if (!provisioned.ok) return c.json({ error: provisioned.error }, 502);
  await c.env.DB.prepare(
    `UPDATE domains SET
       mail_provider = 'ses',
       provider_state = ?,
       provider_dns_json = ?,
       provider_region = ?,
       ses_identity_arn = ?,
       migration_from = ?,
       migration_state = 'pending_mx_cutover',
       identity_verified_at = NULL,
       mx_verified_at = NULL,
       inbound_rule_ready_at = NULL,
       receiving_ready_at = NULL,
       sending_ready_at = NULL,
       last_provider_error = NULL
     WHERE id = ?`,
  )
    .bind(
      provisioned.state,
      JSON.stringify(provisioned.dns),
      provisioned.region,
      provisioned.identityArn || null,
      from,
      row.id,
    )
    .run();
  return c.json({
    ok: true,
    records: provisioned.dns,
    note: "Publish SES DNS, verify with Check setup, then replace legacy MX. Rollback window: keep old MX until SES receiving test passes.",
  });
});

const LIST_COLUMNS = `id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, has_attachments, unread, starred, snooze_until, scheduled_at, snippet, label, thread_id, rfc_message_id, assignee_user_id, workflow_status, plus_tag, created_at`;

/** Prefer the earliest copy when SES dual-rules stored the same Message-ID twice. */
function dedupeByRfcMessageId<T extends { id?: unknown; rfc_message_id?: unknown; date_ms?: unknown }>(
  rows: T[],
): T[] {
  const best = new Map<string, T>();
  const out: T[] = [];
  for (const row of rows) {
    const rfc = String(row.rfc_message_id || "");
    if (!rfc) {
      out.push(row);
      continue;
    }
    const prev = best.get(rfc);
    if (!prev) {
      best.set(rfc, row);
      out.push(row);
      continue;
    }
    const prevDate = Number(prev.date_ms) || 0;
    const nextDate = Number(row.date_ms) || 0;
    if (nextDate < prevDate) {
      const idx = out.indexOf(prev);
      if (idx >= 0) out[idx] = row;
      best.set(rfc, row);
    }
  }
  return out;
}

app.get("/api/mail", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  // Scheduled sends are flushed by cron — keep list reads free of send-side work.
  const folder = (c.req.query("folder") ?? "inbox").toLowerCase();
  if (!FOLDERS.has(folder) && !VIRTUAL_FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const mailboxId = c.req.query("mailbox");
  const domainId = c.req.query("domain");
  if (mailboxId) {
    const access = await assertMailboxAccess(c.env.DB, ctx, mailboxId);
    if (!access.ok) return c.json({ error: "Mailbox not found." }, 404);
  } else if (domainId) {
    const domain = await c.env.DB.prepare("SELECT id FROM domains WHERE id = ? AND user_id = ?")
      .bind(domainId, ctx.workspaceId)
      .first();
    if (!domain) return c.json({ error: "Domain not found." }, 404);
  }
  const now = nowMs();
  const access = mailboxAccessClause(ctx);
  let sql = `SELECT ${LIST_COLUMNS} FROM messages WHERE user_id = ?${access.sql}`;
  const binds: unknown[] = [ctx.workspaceId, ...access.binds];
  if (folder === "starred") {
    sql += " AND starred = 1 AND folder NOT IN ('trash', 'spam')";
  } else if (folder === "snoozed") {
    sql += " AND snooze_until > ?";
    binds.push(now);
  } else if (folder === "inbox") {
    sql += " AND folder = 'inbox' AND (snooze_until IS NULL OR snooze_until <= ?)";
    binds.push(now);
  } else {
    sql += " AND folder = ?";
    binds.push(folder);
  }
  if (mailboxId) {
    sql += " AND mailbox_id = ?";
    binds.push(mailboxId);
  } else if (domainId) {
    sql += " AND mailbox_id IN (SELECT id FROM mailboxes WHERE domain_id = ? AND user_id = ?)";
    binds.push(domainId, ctx.workspaceId);
  }
  sql += " ORDER BY date_ms DESC LIMIT 200";
  const rows = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({
    folder,
    messages: dedupeByRfcMessageId((rows.results ?? []) as Array<{ rfc_message_id?: string; date_ms?: number }>),
  });
});

app.get("/api/search", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ error: "Type at least two characters." }, 400);
  const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  const access = mailboxAccessClause(ctx);
  const rows = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS}
     FROM messages
     WHERE user_id = ?${access.sql}
       AND (subject LIKE ? ESCAPE '\\' OR from_addr LIKE ? ESCAPE '\\' OR to_addr LIKE ? ESCAPE '\\' OR snippet LIKE ? ESCAPE '\\' OR text_body LIKE ? ESCAPE '\\')
     ORDER BY date_ms DESC
     LIMIT 100`,
  )
    .bind(ctx.workspaceId, ...access.binds, like, like, like, like, like)
    .all();
  return c.json({ q, messages: rows.results ?? [] });
});

app.get("/api/mail/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const id = c.req.param("id");
  const access = mailboxAccessClause(ctx);
  const msg = await c.env.DB.prepare(
    `SELECT * FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
  )
    .bind(id, ctx.workspaceId, ...access.binds)
    .first();
  if (!msg) return c.json({ error: "Message not found." }, 404);
  if ((msg as { unread: number }).unread) {
    await c.env.DB.prepare("UPDATE messages SET unread = 0 WHERE id = ? AND user_id = ?")
      .bind(id, ctx.workspaceId)
      .run();
  }
  const atts = await c.env.DB.prepare(
    "SELECT id, filename, content_type, size FROM attachments WHERE message_id = ?",
  )
    .bind(id)
    .all();
  return c.json({ message: { ...msg, unread: 0 }, attachments: atts.results ?? [] });
});

app.get("/api/mail/:id/thread", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const id = c.req.param("id");
  const access = mailboxAccessClause(ctx);
  const root = await c.env.DB.prepare(
    `SELECT thread_id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
  )
    .bind(id, ctx.workspaceId, ...access.binds)
    .first<{ thread_id: string | null }>();
  if (!root) return c.json({ error: "Message not found." }, 404);
  const threadId = root.thread_id || id;
  const rows = await c.env.DB.prepare(
    `SELECT ${LIST_COLUMNS}
     FROM messages
     WHERE user_id = ?${access.sql} AND (thread_id = ? OR id = ?)
     ORDER BY date_ms ASC
     LIMIT 100`,
  )
    .bind(ctx.workspaceId, ...access.binds, threadId, id)
    .all<Record<string, unknown>>();

  // Collapse accidental duplicate copies (same RFC Message-ID from dual SES receipt rules).
  const messages = dedupeByRfcMessageId(
    (rows.results ?? []) as Array<{ rfc_message_id?: string; date_ms?: number }>,
  );

  return c.json({ thread_id: threadId, messages });
});

app.get("/api/mail/:id/attachments/:attId", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  if (!c.env.ATTACHMENTS) {
    return c.json({ error: "R2 bucket ATTACHMENTS is not bound. Attachments are unavailable." }, 501);
  }
  const access = mailboxAccessClause(ctx);
  const att = await c.env.DB.prepare(
    `SELECT a.id, a.r2_key, a.filename, a.content_type
     FROM attachments a
     JOIN messages m ON m.id = a.message_id
     WHERE a.id = ? AND a.message_id = ? AND m.user_id = ?${access.sql.replace(/mailbox_id/g, "m.mailbox_id")}`,
  )
    .bind(c.req.param("attId"), c.req.param("id"), ctx.workspaceId, ...access.binds)
    .first<{ id: string; r2_key: string; filename: string; content_type: string }>();
  if (!att) return c.json({ error: "Attachment not found." }, 404);
  const obj = await c.env.ATTACHMENTS.get(att.r2_key);
  if (!obj) return c.json({ error: "Attachment object is missing from R2." }, 404);
  return new Response(obj.body, {
    headers: {
      "content-type": safeContentType(att.content_type),
      "content-disposition": `attachment; filename="${safeFilename(att.filename)}"`,
    },
  });
});

app.post("/api/mail/:id/move", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const body = await c.req.json().catch(() => ({})) as { folder?: string };
  const folder = (body.folder ?? "").toLowerCase();
  if (!FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const access = mailboxAccessClause(ctx);
  const existing = await c.env.DB.prepare(
    `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
  )
    .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
    .first();
  if (!existing) return c.json({ error: "Message not found." }, 404);
  await c.env.DB.prepare("UPDATE messages SET folder = ?, snooze_until = NULL WHERE id = ? AND user_id = ?")
    .bind(folder, c.req.param("id"), ctx.workspaceId)
    .run();
  return c.json({ ok: true, folder });
});

app.post("/api/mail/:id/flags", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const body = await c.req.json().catch(() => ({})) as {
    unread?: boolean;
    starred?: boolean;
    snooze_until?: number | null;
  };
  const access = mailboxAccessClause(ctx);
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT id FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
  )
    .bind(id, ctx.workspaceId, ...access.binds)
    .first();
  if (!existing) return c.json({ error: "Message not found." }, 404);

  const patches: string[] = [];
  const binds: Array<string | number | null> = [];
  if (typeof body.unread === "boolean") {
    patches.push("unread = ?");
    binds.push(body.unread ? 1 : 0);
  }
  if (typeof body.starred === "boolean") {
    patches.push("starred = ?");
    binds.push(body.starred ? 1 : 0);
  }
  if ("snooze_until" in body) {
    patches.push("snooze_until = ?");
    binds.push(body.snooze_until == null ? null : Number(body.snooze_until));
    if (body.snooze_until) {
      patches.push("folder = ?");
      binds.push("inbox");
    }
  }
  if (!patches.length) return c.json({ error: "No flags provided." }, 400);
  binds.push(id, ctx.workspaceId);
  await c.env.DB.prepare(`UPDATE messages SET ${patches.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds)
    .run();
  return c.json({ ok: true });
});

app.post("/api/mail/mark-read", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const body = await c.req.json().catch(() => ({})) as { folder?: string; mailbox?: string };
  const folder = (body.folder || "inbox").toLowerCase();
  if (!FOLDERS.has(folder) && !VIRTUAL_FOLDERS.has(folder)) return c.json({ error: "Unknown folder." }, 400);
  const access = mailboxAccessClause(ctx);
  const binds: unknown[] = [ctx.workspaceId, ...access.binds];
  let where = `user_id = ?${access.sql} AND unread = 1`;
  if (folder === "starred") {
    where += " AND starred = 1 AND folder NOT IN ('trash', 'spam')";
  } else if (folder === "snoozed") {
    where += " AND snooze_until > ?";
    binds.push(nowMs());
  } else {
    where += " AND folder = ?";
    binds.push(folder);
  }
  if (body.mailbox) {
    where += " AND mailbox_id = ?";
    binds.push(body.mailbox);
  }
  const result = await c.env.DB.prepare(`UPDATE messages SET unread = 0 WHERE ${where}`).bind(...binds).run();
  return c.json({ ok: true, updated: result.meta.changes ?? 0 });
});

app.delete("/api/mail/:id", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const access = mailboxAccessClause(ctx);
  const row = await c.env.DB.prepare(
    `SELECT id, folder FROM messages WHERE id = ? AND user_id = ?${access.sql}`,
  )
    .bind(c.req.param("id"), ctx.workspaceId, ...access.binds)
    .first<{ id: string; folder: string }>();
  if (!row) return c.json({ error: "Message not found." }, 404);
  if (row.folder !== "trash" && row.folder !== "spam" && row.folder !== "drafts" && row.folder !== "scheduled") {
    return c.json({ error: "Move the message to Trash before deleting it permanently." }, 400);
  }
  const atts = await c.env.DB.prepare("SELECT r2_key FROM attachments WHERE message_id = ?")
    .bind(row.id)
    .all<{ r2_key: string }>();
  if (c.env.ATTACHMENTS) {
    await Promise.all((atts.results ?? []).map((att) => c.env.ATTACHMENTS!.delete(att.r2_key).catch(() => undefined)));
  }
  await c.env.DB.prepare("DELETE FROM attachments WHERE message_id = ?").bind(row.id).run();
  await c.env.DB.prepare("DELETE FROM messages WHERE id = ? AND user_id = ?").bind(row.id, ctx.workspaceId).run();
  return c.json({ ok: true });
});

app.post("/api/mail/send", async (c) => {
  const user = await requireUser(c);
  if (user instanceof Response) return user;
  const ctx = await resolveWorkspace(c.env.DB, user.id, getCookie(c, "flap_ws"));
  const body = await c.req.json().catch(() => ({})) as {
    id?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    text?: string;
    html?: string;
    from?: string;
    draft?: boolean;
    scheduled_at?: number | null;
    in_reply_to?: string;
    attachments?: OutboundAttachment[];
  };
  const to = normalizeRecipientField(String(body.to ?? ""));
  const cc = normalizeRecipientField(String(body.cc ?? ""));
  const bcc = normalizeRecipientField(String(body.bcc ?? ""));
  const subject = (body.subject ?? "").trim();
  const text = body.text ?? "";
  const html = body.html ?? "";
  // Accept boolean true or common JSON truthy variants from clients.
  const draft = body.draft === true || (body as { draft?: unknown }).draft === 1 || (body as { draft?: unknown }).draft === "true";
  const scheduledAt = typeof body.scheduled_at === "number" && body.scheduled_at > nowMs() ? body.scheduled_at : null;
  const incomingAttachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (to.length > 4_096 || cc.length > 4_096 || bcc.length > 4_096 || subject.length > 998 || text.length > 1_000_000 || html.length > 1_500_000) {
    return c.json({ error: "Message fields exceed Flap's supported size limits." }, 400);
  }
  const uniqueRecipients = [...new Set([...parseRecipients(to), ...parseRecipients(cc), ...parseRecipients(bcc)])];
  // Drafts may be empty or mid-typing; sends and schedules need 1–20 valid recipients.
  if (!draft) {
    if (!recipientsFieldValid(to) || !recipientsFieldValid(cc) || !recipientsFieldValid(bcc)) {
      return c.json({ error: "Enter between 1 and 20 valid recipient addresses, separated by commas." }, 400);
    }
    if (!uniqueRecipients.length || uniqueRecipients.length > 20) {
      return c.json({ error: "Enter between 1 and 20 valid recipient addresses, separated by commas." }, 400);
    }
  }
  if (!draft && !scheduledAt && !subject) return c.json({ error: "Subject is required." }, 400);
  if (!HEADER_VALUE_RE.test(subject)) return c.json({ error: "Subject cannot contain line breaks." }, 400);
  if (!draft && cc && !parseRecipients(cc).length) return c.json({ error: "Cc contains an invalid address." }, 400);
  if (!draft && bcc && !parseRecipients(bcc).length) return c.json({ error: "Bcc contains an invalid address." }, 400);

  if (!draft && !scheduledAt && !canSendMail(c.env)) {
    return c.json(
      {
        error:
          "Mail sending is not configured. Set AWS SES credentials for customer domains (and optionally SEB for useflap.online system mail).",
      },
      501,
    );
  }

  const fromMailbox = await pickFromMailbox(c.env.DB, ctx, body.from);
  if (!fromMailbox) {
    return c.json({ error: "Create a mailbox before sending, or pick an address you can send from." }, 400);
  }

  if (!draft && !scheduledAt && !canSendFromDomain(c.env, fromMailbox.address || fromMailbox.fromHeader)) {
    return c.json(
      {
        error:
          "Customer-domain sending needs Amazon SES credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). Cloudflare Email cannot deliver from your custom domain.",
      },
      501,
    );
  }

  // Resolve domain sending readiness for compose From.
  const mailboxDomain = await c.env.DB.prepare(
    `SELECT d.id, d.name, d.mail_provider, d.provider_state, d.provider_region, d.provider_dns_json,
            d.ses_identity_arn, d.identity_verified_at, d.mx_verified_at, d.inbound_rule_ready_at,
            d.receiving_ready_at, d.sending_ready_at, d.last_provider_check_at, d.last_provider_error,
            d.migration_from, d.migration_state, d.user_id
     FROM mailboxes m JOIN domains d ON d.id = m.domain_id WHERE m.id = ?`,
  )
    .bind(fromMailbox.id)
    .first<import("./lib/domain-readiness").DomainProviderRow>();

  if (!draft && !scheduledAt && mailboxDomain) {
    const sendingOk = domainIsSendingReady(mailboxDomain);
    if (!sendingOk) {
      return c.json(
        {
          error: `Finish sending setup for ${mailboxDomain.name} before composing from this address.`,
          code: "sending_not_ready",
          domain_id: mailboxDomain.id,
        },
        400,
      );
    }
  }

  if (!draft && !scheduledAt) {
    for (const addr of uniqueRecipients) {
      if (await isAddressSuppressed(c.env.DB, addr)) {
        return c.json({ error: `${addr} is on the suppression list (bounce or complaint).` }, 400);
      }
    }
  }

  const now = nowMs();
  const attachments = decodeOutboundAttachments(incomingAttachments);
  if (attachments instanceof Response) return attachments;
  if (attachments.length && !c.env.ATTACHMENTS) {
    return c.json({ error: "Attachments require the ATTACHMENTS R2 binding." }, 501);
  }

  const snippet = makeSnippet(text, html);
  const bodyBytes = messageStorageBytes({
    text_body: text,
    html_body: html,
    subject,
    snippet,
    from_addr: fromMailbox.fromHeader,
    to_addr: to,
    cc_addr: cc,
    bcc_addr: bcc,
  });
  const newAttBytes = attachments.reduce((sum, att) => sum + att.content.byteLength, 0);

  const folder = scheduledAt ? "scheduled" : "drafts";
  let replyHeader: string | null = null;
  let threadId: string | null = null;
  if (body.in_reply_to) {
    const parent = await c.env.DB.prepare(
      "SELECT id, rfc_message_id, thread_id FROM messages WHERE id = ? AND user_id = ?",
    )
      .bind(body.in_reply_to, ctx.workspaceId)
      .first<{ id: string; rfc_message_id: string | null; thread_id: string | null }>();
    if (parent) {
      replyHeader = normalizeMessageId(parent.rfc_message_id) || `<${parent.id}@flap.local>`;
      threadId = parent.thread_id || parent.id;
    } else {
      replyHeader = normalizeMessageId(body.in_reply_to) || body.in_reply_to;
    }
  }

  const willSendNow = !draft && !scheduledAt;
  if (willSendNow) {
    const sendLimit = await assertSendRoom(c.env.DB, ctx.workspaceId);
    if (!sendLimit.ok) return c.json({ error: sendLimit.error }, sendLimit.status);
  }

  let id = (body.id ?? "").trim();
  let oldBodyBytes = 0;
  if (id) {
    const existing = await c.env.DB.prepare("SELECT id, folder, storage_bytes FROM messages WHERE id = ? AND user_id = ?")
      .bind(id, ctx.workspaceId)
      .first<{ id: string; folder: string; storage_bytes: number }>();
    if (!existing || (existing.folder !== "drafts" && existing.folder !== "scheduled")) {
      return c.json({ error: "Draft not found." }, 404);
    }
    oldBodyBytes = Number(existing.storage_bytes ?? 0);
    const storageCheck = await assertStorageRoom(c.env.DB, ctx.workspaceId, bodyBytes - oldBodyBytes + newAttBytes);
    if (!storageCheck.ok) return c.json({ error: storageCheck.error }, storageCheck.status);
    await c.env.DB.prepare(
      `UPDATE messages SET mailbox_id = ?, folder = ?, from_addr = ?, to_addr = ?, cc_addr = ?, bcc_addr = ?, subject = ?, date_ms = ?, text_body = ?, html_body = ?, has_attachments = CASE WHEN ? = 1 THEN 1 ELSE has_attachments END, unread = 0, snippet = ?, scheduled_at = ?, in_reply_to = COALESCE(?, in_reply_to), thread_id = COALESCE(?, thread_id), storage_bytes = ?
       WHERE id = ? AND user_id = ?`,
    )
      .bind(fromMailbox.id, folder, fromMailbox.fromHeader, to, cc, bcc, subject, now, text, html, attachments.length ? 1 : 0, snippet, scheduledAt, replyHeader, threadId, bodyBytes, id, ctx.workspaceId)
      .run();
  } else {
    const storageCheck = await assertStorageRoom(c.env.DB, ctx.workspaceId, bodyBytes + newAttBytes);
    if (!storageCheck.ok) return c.json({ error: storageCheck.error }, storageCheck.status);
    id = randomId("msg");
    const rfcId = `<${id}@${(fromMailbox.address.split("@")[1] || "flap.local")}>`;
    await c.env.DB.prepare(
      `INSERT INTO messages
        (id, user_id, mailbox_id, folder, from_addr, to_addr, cc_addr, bcc_addr, subject, date_ms, text_body, html_body, has_attachments, unread, snippet, scheduled_at, in_reply_to, rfc_message_id, thread_id, storage_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, ctx.workspaceId, fromMailbox.id, folder, fromMailbox.fromHeader, to, cc, bcc, subject, now, text, html, attachments.length ? 1 : 0, snippet, scheduledAt, replyHeader, rfcId, threadId || id, bodyBytes, now)
      .run();
  }
  if (attachments.length) {
    await saveOutboundAttachments(c.env, id, attachments, now);
  }

  for (const address of uniqueRecipients) {
    await touchContact(c.env.DB, ctx.workspaceId, address);
  }

  if (draft) return c.json({ ok: true, draft: true, id });
  if (scheduledAt) return c.json({ ok: true, scheduled: true, id, scheduled_at: scheduledAt });

  // Undo-send: short delay via scheduled folder instead of immediate SES dispatch.
  const prefs = await loadSettings(c.env.DB, ctx.workspaceId).catch(() => ({ undo_send_seconds: 10 }));
  const undoSeconds = Math.max(0, Math.min(60, Number(prefs.undo_send_seconds ?? 10)));
  if (undoSeconds > 0) {
    const undoAt = now + undoSeconds * 1000;
    await c.env.DB.prepare(
      "UPDATE messages SET folder = 'scheduled', scheduled_at = ? WHERE id = ? AND user_id = ?",
    )
      .bind(undoAt, id, ctx.workspaceId)
      .run();
    return c.json({ ok: true, scheduled: true, undo: true, id, scheduled_at: undoAt, undo_seconds: undoSeconds });
  }

  const error = await dispatchStoredMessage(c.env, {
    id,
    user_id: ctx.workspaceId,
    mailbox_id: fromMailbox.id,
    from_addr: fromMailbox.fromHeader,
    to_addr: to,
    cc_addr: cc,
    bcc_addr: bcc,
    subject,
    text_body: text,
    html_body: html,
    in_reply_to: replyHeader,
  });
  if (error) {
    return c.json(
      {
        error: `Outbound send failed: ${error}. The message was saved as a draft. Confirm Email Routing destination addresses and a paid Workers plan.`,
        id,
        draft: true,
      },
      502,
    );
  }

  await c.env.DB.prepare("UPDATE messages SET folder = 'sent', scheduled_at = NULL, date_ms = ?, unread = 0 WHERE id = ? AND user_id = ?")
    .bind(now, id, ctx.workspaceId)
    .run();
  await recordOutboundSend(c.env.DB, ctx.workspaceId);
  await markFirstEmailSent(c.env.DB, ctx.workspaceId);
  return c.json({ ok: true, id });
});

function decodeOutboundAttachments(input: OutboundAttachment[]): Array<{ filename: string; contentType: string; content: Uint8Array }> | Response {
  if (input.length > MAX_OUTBOUND_ATTACHMENTS) return new Response(JSON.stringify({ error: `Attach at most ${MAX_OUTBOUND_ATTACHMENTS} files.` }), { status: 400, headers: { "content-type": "application/json" } });
  let total = 0;
  const files: Array<{ filename: string; contentType: string; content: Uint8Array }> = [];
  for (const item of input) {
    if (typeof item.data !== "string" || !item.data.startsWith("data:")) return new Response(JSON.stringify({ error: "An attachment is malformed." }), { status: 400, headers: { "content-type": "application/json" } });
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(item.data);
    if (!match) return new Response(JSON.stringify({ error: "Attachments must be base64 data URLs." }), { status: 400, headers: { "content-type": "application/json" } });
    const binary = atob(match[2]);
    const content = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    total += content.byteLength;
    if (total > MAX_OUTBOUND_ATTACHMENT_BYTES) return new Response(JSON.stringify({ error: "Attachments exceed Flap's 25 MB limit." }), { status: 400, headers: { "content-type": "application/json" } });
    files.push({ filename: safeFilename(item.filename ?? "attachment"), contentType: safeContentType(item.content_type ?? match[1]), content });
  }
  return files;
}

async function saveOutboundAttachments(env: Env, messageId: string, attachments: Array<{ filename: string; contentType: string; content: Uint8Array }>, now: number) {
  if (!attachments.length || !env.ATTACHMENTS) return;
  for (const attachment of attachments) {
    const id = randomId("att");
    const key = `attachments/${messageId}/${id}/${safeFilename(attachment.filename)}`;
    await env.ATTACHMENTS.put(key, attachment.content, { httpMetadata: { contentType: attachment.contentType } });
    await env.DB.prepare("INSERT INTO attachments (id, message_id, r2_key, filename, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, messageId, key, attachment.filename, attachment.contentType, attachment.content.byteLength, now)
      .run();
  }
}

function toClientDnsRecords(bundle: ReturnType<typeof defaultCustomerDnsRecords>) {
  const domain = bundle.spf?.name || "";
  const primaryDkim = bundle.dkim[0] ?? {
    type: "TXT",
    name: `one._domainkey.${domain}`,
    value: "Provision the domain in Flap to load exact DKIM values.",
  };
  const dmarc = bundle.dmarc ?? {
    type: "TXT",
    name: domain ? `_dmarc.${domain}` : "_dmarc",
    value: domain
      ? `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`
      : "v=DMARC1; p=none",
  };
  return {
    provider: bundle.provider,
    note: bundle.note,
    mx: bundle.mx,
    spf: bundle.spf,
    dkim: primaryDkim,
    dkim_records: bundle.dkim,
    verification: bundle.verification ?? [],
    dmarc,
    worker_rule: bundle.worker_rule,
    send_note: bundle.send_note,
    region: bundle.region,
  };
}

function normalizeDomain(raw: string): string {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  return DOMAIN_RE.test(domain) ? domain : "";
}

function safeFilename(value: string): string {
  return value.replace(/["\r\n]/g, "_").slice(0, 180) || "attachment";
}

function safeContentType(value: string): string {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;[^\r\n]*)?$/i.test(value)
    ? value
    : "application/octet-stream";
}

async function pickFromMailbox(db: D1Database, ctx: WorkspaceCtx, from?: string) {
  let row: { id: string; address: string; display_name: string } | null = null;
  if (from) {
    const candidate = await db
      .prepare("SELECT id, address, display_name FROM mailboxes WHERE user_id = ? AND lower(address) = ?")
      .bind(ctx.workspaceId, from.trim().toLowerCase())
      .first<{ id: string; address: string; display_name: string }>();
    if (candidate) {
      const ok = await assertMailboxAccess(db, ctx, candidate.id);
      if (ok.ok) row = candidate;
    }
  } else {
    const list = await listAccessibleMailboxes(db, ctx);
    const first = (list.results ?? [])[0] as { id: string; address: string; display_name: string } | undefined;
    if (first) row = first;
  }
  if (!row) return null;
  const name = (row.display_name ?? "").trim().replace(/["\r\n]/g, "");
  return {
    id: row.id,
    address: row.address,
    fromHeader: name ? `"${name}" <${row.address}>` : row.address,
  };
}

registerWorkspaceRoutes(app);
registerBillingRoutes(app);
registerDnsToolRoutes(app);
registerGrowthRoutes(app);
registerInboundWebhookRoutes(app);
registerProductFeatureRoutes(app);
registerFeatureRoutes(app);

export default {
  fetch: app.fetch,
  email: handleEmail,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await flushScheduled(env);
        await processQueuedNewsletterBlasts(env);
      })(),
    );
  },
};
