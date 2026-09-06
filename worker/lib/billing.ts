import type { Context } from "hono";
import { Hono } from "hono";
import { requireUser } from "./auth";
import { randomId, nowMs } from "./ids";
import { createCheckoutSession, createCustomerPortalSession, resolveDodoMode, verifyDodoWebhook } from "./dodo";
import {
  PLANS,
  PLAN_ORDER,
  PAID_PLAN_IDS,
  normalizePlanId,
  planFromProductId,
  productIdForPlan,
  type PlanId,
  type PlanLimits,
} from "./plans";
import { trackOncePerUser, trackServerEvent } from "./analytics";
import { storePaymentIdentity } from "./referrals";

function envStr(v: string | undefined): string {
  return (v || "").trim();
}

const LOCAL_APP_ORIGIN = "http://127.0.0.1:5173";

/**
 * Absolute public origin for Dodo return_url / portal redirects.
 * Dodo rejects empty and relative URLs with: return_url: must be a valid URL.
 */
function asHttpOrigin(raw: string | undefined | null): string | null {
  const trimmed = envStr(raw ?? undefined);
  if (!trimmed || trimmed === "/" || trimmed === "null" || trimmed === "undefined") return null;

  const candidates = [trimmed];
  // host:port without scheme (e.g. localhost:5173) — only prepend http when there is no ://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    candidates.unshift(`http://${trimmed}`);
  }

  for (const candidate of candidates) {
    try {
      const u = new URL(candidate);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      if (!u.hostname) continue;
      return u.origin;
    } catch {
      /* try next */
    }
  }
  return null;
}

function resolvePublicAppUrl(c: Context<{ Bindings: Env }>): string {
  const fromEnv = asHttpOrigin(c.env.APP_URL);
  if (fromEnv) return fromEnv;

  const fromOrigin = asHttpOrigin(c.req.header("Origin"));
  if (fromOrigin) return fromOrigin;

  const referer = c.req.header("Referer");
  if (referer) {
    try {
      const fromReferer = asHttpOrigin(new URL(referer).origin);
      if (fromReferer) return fromReferer;
    } catch {
      /* ignore */
    }
  }

  try {
    const fromReq = asHttpOrigin(new URL(c.req.url).origin);
    if (fromReq) return fromReq;
  } catch {
    /* ignore */
  }

  return LOCAL_APP_ORIGIN;
}

function billingReturnUrl(c: Context<{ Bindings: Env }>, pathAndQuery: string): string {
  const origin = resolvePublicAppUrl(c);
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  let url: URL;
  try {
    url = new URL(path, `${origin}/`);
  } catch {
    throw new Error(
      `APP_URL is invalid (${JSON.stringify(c.env.APP_URL || "")}). Set APP_URL to an absolute URL, e.g. ${LOCAL_APP_ORIGIN} for local test.`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`APP_URL must be http(s). Got ${url.protocol} — set APP_URL=${LOCAL_APP_ORIGIN} for local test.`);
  }
  if (!url.hostname) {
    throw new Error(`APP_URL is missing a host. Set APP_URL=${LOCAL_APP_ORIGIN} for local test.`);
  }
  return url.href;
}

/** Checkout is enabled when an API key and at least one paid product ID are set (test or live). */
function billingConfigured(env: Env): boolean {
  return Boolean(envStr(env.DODO_PAYMENTS_API_KEY)) && Boolean(
    envStr(env.DODO_PRODUCT_SOLO) ||
      envStr(env.DODO_PRODUCT_BUILDER) ||
      envStr(env.DODO_PRODUCT_STUDIO) ||
      envStr(env.DODO_PRODUCT_PRO) ||
      envStr(env.DODO_PRODUCT_TEAM) ||
      envStr(env.DODO_PRODUCT_STARTER) ||
      envStr(env.DODO_PRODUCT_BUSINESS),
  );
}

/** Human-readable gaps so Settings can explain “Contact to upgrade” instead of implying test mode is blocked. */
function checkoutMissing(env: Env): string[] {
  const missing: string[] = [];
  if (!envStr(env.DODO_PAYMENTS_API_KEY)) missing.push("DODO_PAYMENTS_API_KEY");
  if (
    !envStr(env.DODO_PRODUCT_SOLO) &&
    !envStr(env.DODO_PRODUCT_STARTER) &&
    !envStr(env.DODO_PRODUCT_BUILDER) &&
    !envStr(env.DODO_PRODUCT_PRO)
  ) {
    missing.push("DODO_PRODUCT_SOLO or DODO_PRODUCT_BUILDER");
  }
  if (
    !envStr(env.DODO_PRODUCT_STUDIO) &&
    !envStr(env.DODO_PRODUCT_TEAM) &&
    !envStr(env.DODO_PRODUCT_BUSINESS)
  ) {
    missing.push("DODO_PRODUCT_STUDIO");
  }
  return missing;
}

function checkoutDiagnostics(env: Env) {
  const mode = resolveDodoMode(env);
  const missing = checkoutMissing(env);
  return {
    checkout_configured: billingConfigured(env),
    dodo_environment: mode,
    checkout_missing: missing,
  };
}

type App = { Bindings: Env };

export type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  dodo_subscription_id: string | null;
  dodo_customer_id: string | null;
  dodo_product_id: string | null;
  current_period_end: number | null;
  cancel_at_period_end: number;
  created_at: number;
  updated_at: number;
};

export async function ensureSubscription(db: D1Database, userId: string): Promise<SubscriptionRow> {
  const existing = await db
    .prepare("SELECT * FROM subscriptions WHERE user_id = ?")
    .bind(userId)
    .first<SubscriptionRow>();
  if (existing) return existing;
  const now = nowMs();
  const id = randomId("sub");
  await db
    .prepare(
      `INSERT INTO subscriptions (id, user_id, plan_id, status, created_at, updated_at)
       VALUES (?, ?, 'free', 'active', ?, ?)`,
    )
    .bind(id, userId, now, now)
    .run();
  return {
    id,
    user_id: userId,
    plan_id: "free",
    status: "active",
    dodo_subscription_id: null,
    dodo_customer_id: null,
    dodo_product_id: null,
    current_period_end: null,
    cancel_at_period_end: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function getEffectivePlan(db: D1Database, userId: string) {
  const sub = await ensureSubscription(db, userId);
  const active = sub.status === "active" || sub.status === "trialing";
  const plan_id = normalizePlanId(active ? sub.plan_id : "free");
  const def = PLANS[plan_id] ?? PLANS.free;
  const bonusRow = await db
    .prepare("SELECT referral_bonus_domains FROM users WHERE id = ?")
    .bind(userId)
    .first<{ referral_bonus_domains: number | null }>();
  const bonus = Math.max(0, Number(bonusRow?.referral_bonus_domains ?? 0));
  const limits: PlanLimits = {
    ...def.limits,
    domains: def.limits.domains + bonus,
  };
  return {
    plan_id: def.id,
    status: sub.status,
    limits,
    referral_bonus_domains: bonus,
    branding_footer: Boolean(def.branding_footer),
    subscription: sub,
  };
}

export async function assertWithinLimit(
  db: D1Database,
  userId: string,
  resource: keyof PlanLimits,
  currentCount: number,
): Promise<{ ok: true } | { ok: false; error: string; status: 402 }> {
  const { plan_id, limits } = await getEffectivePlan(db, userId);
  const max = limits[resource];
  if (currentCount >= max) {
    const label =
      resource === "send_per_month"
        ? "outbound sends per month"
        : resource === "storage_bytes"
          ? "storage"
          : String(resource).replace(/_/g, " ");
    return {
      ok: false,
      status: 402,
      error: `Your ${PLANS[plan_id].name} plan allows ${formatLimitValue(resource, max)} ${label}. Upgrade to add more.`,
    };
  }
  return { ok: true };
}

const textEncoder = new TextEncoder();

/** UTF-8 byte length for D1 body accounting. */
export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

/** Bytes attributed to a message row (bodies + common header fields stored in D1). */
export function messageStorageBytes(fields: {
  text_body?: string | null;
  html_body?: string | null;
  subject?: string | null;
  snippet?: string | null;
  from_addr?: string | null;
  to_addr?: string | null;
  cc_addr?: string | null;
  bcc_addr?: string | null;
}): number {
  return (
    utf8ByteLength(fields.text_body ?? "") +
    utf8ByteLength(fields.html_body ?? "") +
    utf8ByteLength(fields.subject ?? "") +
    utf8ByteLength(fields.snippet ?? "") +
    utf8ByteLength(fields.from_addr ?? "") +
    utf8ByteLength(fields.to_addr ?? "") +
    utf8ByteLength(fields.cc_addr ?? "") +
    utf8ByteLength(fields.bcc_addr ?? "")
  );
}

/** UTC calendar month key `YYYY-MM` — send counters reset when this changes. */
export function utcMonthKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getStorageUsedBytes(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT
         COALESCE((SELECT SUM(storage_bytes) FROM messages WHERE user_id = ?), 0) +
         COALESCE((
           SELECT SUM(a.size) FROM attachments a
           JOIN messages m ON m.id = a.message_id
           WHERE m.user_id = ?
         ), 0) AS n`,
    )
    .bind(userId, userId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function assertStorageRoom(
  db: D1Database,
  userId: string,
  additionalBytes: number,
): Promise<{ ok: true } | { ok: false; error: string; status: 402 }> {
  if (additionalBytes <= 0) return { ok: true };
  const { plan_id, limits } = await getEffectivePlan(db, userId);
  const used = await getStorageUsedBytes(db, userId);
  if (used + additionalBytes > limits.storage_bytes) {
    return {
      ok: false,
      status: 402,
      error: `Storage full on the ${PLANS[plan_id].name} plan (${formatBytes(used)} / ${formatBytes(limits.storage_bytes)}). Delete mail or upgrade to free space.`,
    };
  }
  return { ok: true };
}

export async function getSendsThisMonth(
  db: D1Database,
  userId: string,
): Promise<{ count: number; month_key: string }> {
  const monthKey = utcMonthKey();
  const row = await db
    .prepare("SELECT sends_this_month, sends_month_key FROM users WHERE id = ?")
    .bind(userId)
    .first<{ sends_this_month: number; sends_month_key: string }>();
  if (!row) return { count: 0, month_key: monthKey };
  if ((row.sends_month_key || "") !== monthKey) {
    return { count: 0, month_key: monthKey };
  }
  return { count: Number(row.sends_this_month ?? 0), month_key: monthKey };
}

export async function assertSendRoom(
  db: D1Database,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 402 }> {
  const { plan_id, limits } = await getEffectivePlan(db, userId);
  const { count } = await getSendsThisMonth(db, userId);
  if (count >= limits.send_per_month) {
    return {
      ok: false,
      status: 402,
      error: `Monthly send limit reached on the ${PLANS[plan_id].name} plan (${count} / ${limits.send_per_month}). Resets next UTC calendar month, or upgrade.`,
    };
  }
  return { ok: true };
}

/** Increment outbound send counter after a successful dispatch (not drafts). */
export async function recordOutboundSend(db: D1Database, userId: string): Promise<void> {
  const monthKey = utcMonthKey();
  const row = await db
    .prepare("SELECT sends_this_month, sends_month_key FROM users WHERE id = ?")
    .bind(userId)
    .first<{ sends_this_month: number; sends_month_key: string }>();
  if (!row) return;
  if ((row.sends_month_key || "") !== monthKey) {
    await db
      .prepare("UPDATE users SET sends_this_month = 1, sends_month_key = ? WHERE id = ?")
      .bind(monthKey, userId)
      .run();
    return;
  }
  await db
    .prepare("UPDATE users SET sends_this_month = sends_this_month + 1 WHERE id = ?")
    .bind(userId)
    .run();
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatLimitValue(resource: keyof PlanLimits, max: number): string {
  if (resource === "storage_bytes") return formatBytes(max);
  return String(max);
}

export function registerBillingRoutes(app: Hono<App>) {
  app.get("/api/billing/plans", (c) => {
    const diag = checkoutDiagnostics(c.env);
    return c.json({
      ...diag,
      support_email: "support@useflap.online",
      plans: PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        return {
          id: p.id,
          name: p.name,
          price_monthly: p.price_monthly,
          price_yearly: p.price_yearly,
          blurb: p.blurb,
          features: p.features,
          limits: p.limits,
          highlighted: !!p.highlighted,
          checkout_available: id === "free" ? false : diag.checkout_configured && !!productIdForPlan(id, c.env),
        };
      }),
    });
  });

  app.get("/api/billing/subscription", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const { plan_id, status, limits, subscription, referral_bonus_domains, branding_footer } =
      await getEffectivePlan(c.env.DB, user.id);
    const usage = await collectUsage(c.env.DB, user.id);
    const diag = checkoutDiagnostics(c.env);
    return c.json({
      plan_id,
      status,
      limits,
      usage,
      referral_bonus_domains,
      branding_footer,
      /** Send counters reset on UTC calendar month (`YYYY-MM`). Storage = message bodies + attachments. */
      quota_reset: "utc_calendar_month" as const,
      ...diag,
      portal_available: diag.checkout_configured && Boolean(subscription.dodo_customer_id),
      support_email: "support@useflap.online",
      subscription: {
        id: subscription.id,
        dodo_subscription_id: subscription.dodo_subscription_id,
        dodo_customer_id: subscription.dodo_customer_id,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: !!subscription.cancel_at_period_end,
      },
      plan: PLANS[plan_id],
    });
  });

  app.post("/api/billing/checkout", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const body = (await c.req.json().catch(() => ({}))) as { plan?: string; interval?: string };
    const plan = normalizePlanId((body.plan || "").toLowerCase());
    if (plan === "free" || !PAID_PLAN_IDS.includes(plan)) {
      return c.json({ error: "Choose solo, pro, team, or scale." }, 400);
    }
    const interval = body.interval === "year" ? "year" as const : "month" as const;
    const productId = productIdForPlan(plan, c.env, interval) || productIdForPlan(plan, c.env, "month");
    if (!envStr(c.env.DODO_PAYMENTS_API_KEY)) {
      return c.json({
        error:
          "Self-serve checkout is not configured yet. Set DODO_PAYMENTS_API_KEY (and product IDs) in .dev.vars for local test_mode, or Worker secrets in production.",
      }, 503);
    }
    if (!productId) {
      return c.json({
        error: `Checkout for ${plan} is not configured yet (missing DODO_PRODUCT_${plan.toUpperCase()}). Create the product in the Dodo ${resolveDodoMode(c.env)} dashboard and set the pdt_… id in env.`,
      }, 503);
    }
    let returnUrl: string;
    try {
      returnUrl = billingReturnUrl(c, "/app/settings?tab=billing&checkout=success");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "APP_URL is misconfigured." }, 400);
    }
    try {
      const session = await createCheckoutSession(c.env, {
        product_id: productId,
        customer_email: user.email,
        customer_name: user.email.split("@")[0],
        return_url: returnUrl,
        metadata: { flap_user_id: user.id, flap_plan: plan },
      });
      return c.json({ checkout_url: session.checkout_url, session_id: session.session_id });
    } catch (err) {
      console.error("Dodo checkout error", err);
      return c.json({ error: err instanceof Error ? err.message : "Could not start checkout." }, 502);
    }
  });

  app.post("/api/billing/portal", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    if (!envStr(c.env.DODO_PAYMENTS_API_KEY)) {
      return c.json({
        error: "Billing portal is not configured. Email support@useflap.online to manage your subscription.",
      }, 503);
    }
    const { subscription } = await getEffectivePlan(c.env.DB, user.id);
    if (!subscription.dodo_customer_id) {
      return c.json({
        error: "No payment customer is linked yet. Complete a checkout first, or email support@useflap.online to cancel or change plans.",
      }, 400);
    }
    let returnUrl: string;
    try {
      returnUrl = billingReturnUrl(c, "/app/settings?tab=billing");
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "APP_URL is misconfigured." }, 400);
    }
    try {
      const session = await createCustomerPortalSession(
        c.env,
        subscription.dodo_customer_id,
        returnUrl,
      );
      return c.json({ portal_url: session.link });
    } catch (err) {
      console.error("Dodo portal error", err);
      return c.json({
        error: err instanceof Error ? err.message : "Could not open billing portal. Contact support@useflap.online.",
      }, 502);
    }
  });

  app.post("/api/billing/webhook", async (c) => {
    const rawBody = await c.req.text();
    const headers = {
      id: c.req.header("webhook-id") || "",
      timestamp: c.req.header("webhook-timestamp") || "",
      signature: c.req.header("webhook-signature") || "",
    };

    const live = resolveDodoMode(c.env) === "live_mode";

    if (envStr(c.env.DODO_PAYMENTS_WEBHOOK_KEY)) {
      const ok = await verifyDodoWebhook(c.env, rawBody, headers);
      if (!ok) return c.json({ error: "Invalid webhook signature." }, 401);
    } else if (live) {
      return c.json({ error: "Webhook signing secret required in live mode." }, 503);
    } else {
      console.warn("DODO_PAYMENTS_WEBHOOK_KEY unset — accepting webhook without verification (dev/test only)");
    }

    let event: { type?: string; data?: Record<string, unknown> };
    try {
      event = JSON.parse(rawBody) as { type?: string; data?: Record<string, unknown> };
    } catch {
      return c.json({ error: "Invalid JSON." }, 400);
    }

    const webhookId = headers.id || randomId("whk");
    const existing = await c.env.DB.prepare("SELECT id FROM billing_events WHERE webhook_id = ?")
      .bind(webhookId)
      .first();
    if (existing) return c.json({ ok: true, duplicate: true });

    const type = event.type || "unknown";
    const data = event.data || {};
    const now = nowMs();

    try {
      await applyBillingEvent(c, type, data);
    } catch (err) {
      console.error("Billing webhook handler failed", type, err);
      return c.json({ error: "Handler failed." }, 500);
    }

    const userId = extractUserId(data);
    await c.env.DB.prepare(
      `INSERT INTO billing_events (id, webhook_id, event_type, user_id, payload, processed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(randomId("bev"), webhookId, type, userId, rawBody.slice(0, 100_000), now)
      .run();

    return c.json({ ok: true });
  });
}

async function collectUsage(db: D1Database, userId: string) {
  const [domains, mailboxes, aliases, keys, webhooks, seats, storage_bytes, sends] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM mailboxes WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM aliases WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM webhooks WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ?").bind(userId).first<{ n: number }>(),
    getStorageUsedBytes(db, userId),
    getSendsThisMonth(db, userId),
  ]);
  return {
    domains: Number(domains?.n ?? 0),
    mailboxes: Number(mailboxes?.n ?? 0),
    aliases: Number(aliases?.n ?? 0),
    api_keys: Number(keys?.n ?? 0),
    webhooks: Number(webhooks?.n ?? 0),
    storage_bytes,
    send_per_month: sends.count,
    team_seats: Number(seats?.n ?? 0),
  };
}

function extractUserId(data: Record<string, unknown>): string | null {
  const meta = (data.metadata || {}) as Record<string, string>;
  if (meta.flap_user_id) return meta.flap_user_id;
  return null;
}

function extractProductId(data: Record<string, unknown>): string | null {
  if (typeof data.product_id === "string") return data.product_id;
  const items = data.product_cart || data.items;
  if (Array.isArray(items) && items[0] && typeof (items[0] as { product_id?: string }).product_id === "string") {
    return (items[0] as { product_id: string }).product_id;
  }
  return null;
}

function extractSubId(data: Record<string, unknown>): string | null {
  if (typeof data.subscription_id === "string") return data.subscription_id;
  if (typeof data.subscriptionId === "string") return data.subscriptionId;
  return null;
}

function extractCustomerId(data: Record<string, unknown>): string | null {
  if (typeof data.customer_id === "string") return data.customer_id;
  if (typeof data.customer === "object" && data.customer && typeof (data.customer as { customer_id?: string }).customer_id === "string") {
    return (data.customer as { customer_id: string }).customer_id;
  }
  return null;
}

function extractEmail(data: Record<string, unknown>): string | null {
  if (typeof data.email === "string") return data.email;
  if (typeof data.customer === "object" && data.customer && typeof (data.customer as { email?: string }).email === "string") {
    return (data.customer as { email: string }).email;
  }
  return null;
}

async function applyBillingEvent(c: Context<App>, type: string, data: Record<string, unknown>) {
  const meta = (data.metadata || {}) as Record<string, string>;
  let userId: string | null = meta.flap_user_id || null;
  const subId = extractSubId(data);

  if (!userId && subId) {
    const row = await c.env.DB.prepare("SELECT user_id FROM subscriptions WHERE dodo_subscription_id = ?")
      .bind(subId)
      .first<{ user_id: string }>();
    userId = row?.user_id ?? null;
  }

  if (!userId) {
    const email = extractEmail(data);
    if (email) {
      const row = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?")
        .bind(email.toLowerCase())
        .first<{ id: string }>();
      userId = row?.id ?? null;
    }
  }

  if (!userId) {
    console.warn("Billing event without resolvable user", type);
    return;
  }

  await ensureSubscription(c.env.DB, userId);
  const now = nowMs();
  const productId = extractProductId(data);
  const planFromMeta = meta.flap_plan ? normalizePlanId(meta.flap_plan) : null;
  const planId = (planFromMeta && planFromMeta !== "free" ? planFromMeta : planFromProductId(productId, c.env)) as PlanId;
  const customerId = extractCustomerId(data);
  const periodEnd =
    typeof data.next_billing_date === "string"
      ? Date.parse(data.next_billing_date)
      : typeof data.current_period_end === "number"
        ? data.current_period_end
        : null;

  const grantAccess = ["subscription.active", "subscription.renewed", "subscription.plan_changed", "subscription.updated"].includes(type);
  const hold = type === "subscription.on_hold" || type === "subscription.paused";
  const cancel = type === "subscription.cancelled" || type === "subscription.expired" || type === "subscription.failed";

  const paymentFp = extractPaymentFingerprint(data);
  await storePaymentIdentity(c.env.DB, userId, {
    customerId,
    paymentFingerprint: paymentFp,
  });

  if (grantAccess) {
    const prev = await c.env.DB.prepare("SELECT plan_id, status FROM subscriptions WHERE user_id = ?")
      .bind(userId)
      .first<{ plan_id: string; status: string }>();
    const payloadStatus = typeof data.status === "string" ? data.status : "active";
    const status = payloadStatus === "on_hold" ? "on_hold" : "active";
    const effectivePlan = planId === "free" ? "pro" : planId;
    await c.env.DB.prepare(
      `UPDATE subscriptions SET plan_id = ?, status = ?, dodo_subscription_id = COALESCE(?, dodo_subscription_id),
       dodo_customer_id = COALESCE(?, dodo_customer_id), dodo_product_id = COALESCE(?, dodo_product_id),
       current_period_end = COALESCE(?, current_period_end), updated_at = ? WHERE user_id = ?`,
    )
      .bind(effectivePlan, status, subId, customerId, productId, periodEnd, now, userId)
      .run();
    await c.env.DB.prepare("UPDATE users SET plan_id = ? WHERE id = ?").bind(effectivePlan, userId).run();

    const wasPaid = prev && prev.plan_id !== "free" && prev.status === "active";
    if (!wasPaid && type === "subscription.active") {
      await trackOncePerUser(c.env.DB, userId, "subscription_started", { plan: effectivePlan });
    } else if (wasPaid && prev && prev.plan_id !== effectivePlan) {
      await trackServerEvent(c.env.DB, "subscription_upgraded", {
        userId,
        props: { from: prev.plan_id, to: effectivePlan },
      });
    } else if (type === "subscription.plan_changed") {
      await trackServerEvent(c.env.DB, "subscription_upgraded", {
        userId,
        props: { to: effectivePlan },
      });
    }
  } else if (hold) {
    await c.env.DB.prepare(`UPDATE subscriptions SET status = 'on_hold', updated_at = ? WHERE user_id = ?`)
      .bind(now, userId)
      .run();
  } else if (cancel) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE subscriptions SET plan_id = 'free', status = ?, dodo_product_id = NULL, updated_at = ? WHERE user_id = ?`,
      ).bind(type.includes("failed") ? "failed" : "cancelled", now, userId),
      c.env.DB.prepare("UPDATE users SET plan_id = 'free' WHERE id = ?").bind(userId),
    ]);
    await trackServerEvent(c.env.DB, "subscription_cancelled", {
      userId,
      props: { reason: type },
    });
  }
}

/** Best-effort extraction — Dodo subscription webhooks usually lack card fingerprints. */
function extractPaymentFingerprint(data: Record<string, unknown>): string | null {
  const candidates = [
    data.payment_method_id,
    data.payment_method_fingerprint,
    data.card_fingerprint,
    data.fingerprint,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim().slice(0, 120);
  }
  const pm = data.payment_method;
  if (typeof pm === "string" && pm.trim()) return pm.trim().slice(0, 120);
  if (pm && typeof pm === "object") {
    const obj = pm as Record<string, unknown>;
    for (const key of ["id", "payment_method_id", "fingerprint", "card_fingerprint"]) {
      if (typeof obj[key] === "string" && (obj[key] as string).trim()) {
        return (obj[key] as string).trim().slice(0, 120);
      }
    }
  }
  const card = data.card;
  if (card && typeof card === "object") {
    const fp = (card as { fingerprint?: string }).fingerprint;
    if (typeof fp === "string" && fp.trim()) return fp.trim().slice(0, 120);
  }
  return null;
}
