import type { Context } from "hono";
import { Hono } from "hono";
import { requireUser } from "./auth";
import { randomId, nowMs } from "./ids";
import { createCheckoutSession, createCustomerPortalSession, verifyDodoWebhook } from "./dodo";
import { PLANS, PLAN_ORDER, planFromProductId, productIdForPlan, type PlanId, type PlanLimits } from "./plans";

function billingConfigured(env: Env): boolean {
  return Boolean(env.DODO_PAYMENTS_API_KEY) && Boolean(
    env.DODO_PRODUCT_STARTER || env.DODO_PRODUCT_PRO || env.DODO_PRODUCT_BUSINESS,
  );
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
  const plan_id = (active ? sub.plan_id : "free") as PlanId;
  const def = PLANS[plan_id] ?? PLANS.free;
  return { plan_id: def.id, status: sub.status, limits: def.limits, subscription: sub };
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
    return {
      ok: false,
      status: 402,
      error: `Your ${PLANS[plan_id].name} plan allows ${max} ${String(resource).replace(/_/g, " ")}. Upgrade to add more.`,
    };
  }
  return { ok: true };
}

export function registerBillingRoutes(app: Hono<App>) {
  app.get("/api/billing/plans", (c) => {
    const configured = billingConfigured(c.env);
    return c.json({
      checkout_configured: configured,
      support_email: "support@useflap.online",
      plans: PLAN_ORDER.map((id) => {
        const p = PLANS[id];
        return {
          id: p.id,
          name: p.name,
          price_monthly: p.price_monthly,
          blurb: p.blurb,
          features: p.features,
          limits: p.limits,
          highlighted: !!p.highlighted,
          checkout_available: id === "free" ? false : configured && !!productIdForPlan(id, c.env),
        };
      }),
    });
  });

  app.get("/api/billing/subscription", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const { plan_id, status, limits, subscription } = await getEffectivePlan(c.env.DB, user.id);
    const usage = await collectUsage(c.env.DB, user.id);
    const configured = billingConfigured(c.env);
    return c.json({
      plan_id,
      status,
      limits,
      usage,
      checkout_configured: configured,
      portal_available: configured && Boolean(subscription.dodo_customer_id),
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
    const body = (await c.req.json().catch(() => ({}))) as { plan?: string };
    const plan = (body.plan || "").toLowerCase() as PlanId;
    if (!["starter", "pro", "business"].includes(plan)) {
      return c.json({ error: "Choose starter, pro, or business." }, 400);
    }
    const productId = productIdForPlan(plan, c.env);
    if (!c.env.DODO_PAYMENTS_API_KEY) {
      return c.json({
        error: "Self-serve checkout is not configured yet. Email support@useflap.online to upgrade, or set DODO_PAYMENTS_API_KEY.",
      }, 503);
    }
    if (!productId) {
      return c.json({
        error: `Checkout for ${plan} is not configured yet (missing DODO_PRODUCT_${plan.toUpperCase()}). Contact support@useflap.online.`,
      }, 503);
    }
    const appUrl = (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
    try {
      const session = await createCheckoutSession(c.env, {
        product_id: productId,
        customer_email: user.email,
        customer_name: user.email.split("@")[0],
        return_url: `${appUrl}/app/settings?tab=billing&checkout=done`,
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
    if (!c.env.DODO_PAYMENTS_API_KEY) {
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
    const appUrl = (c.env.APP_URL || new URL(c.req.url).origin).replace(/\/$/, "");
    try {
      const session = await createCustomerPortalSession(
        c.env,
        subscription.dodo_customer_id,
        `${appUrl}/app/settings?tab=billing`,
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

    const live =
      (c.env.DODO_PAYMENTS_ENVIRONMENT || "").toLowerCase() === "live_mode" ||
      (c.env.DODO_PAYMENTS_ENVIRONMENT || "").toLowerCase() === "live";

    if (c.env.DODO_PAYMENTS_WEBHOOK_KEY) {
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
  const [domains, mailboxes, aliases, keys, webhooks, storage] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM domains WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM mailboxes WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM aliases WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM webhooks WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(a.size), 0) AS n FROM attachments a
         JOIN messages m ON m.id = a.message_id WHERE m.user_id = ?`,
      )
      .bind(userId)
      .first<{ n: number }>(),
  ]);
  return {
    domains: Number(domains?.n ?? 0),
    mailboxes: Number(mailboxes?.n ?? 0),
    aliases: Number(aliases?.n ?? 0),
    api_keys: Number(keys?.n ?? 0),
    webhooks: Number(webhooks?.n ?? 0),
    storage_bytes: Number(storage?.n ?? 0),
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
  const planFromMeta = (meta.flap_plan as PlanId) || null;
  const planId = (planFromMeta && PLANS[planFromMeta] ? planFromMeta : planFromProductId(productId, c.env)) as PlanId;
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

  if (grantAccess) {
    const payloadStatus = typeof data.status === "string" ? data.status : "active";
    const status = payloadStatus === "on_hold" ? "on_hold" : "active";
    const effectivePlan = planId === "free" ? "starter" : planId;
    await c.env.DB.prepare(
      `UPDATE subscriptions SET plan_id = ?, status = ?, dodo_subscription_id = COALESCE(?, dodo_subscription_id),
       dodo_customer_id = COALESCE(?, dodo_customer_id), dodo_product_id = COALESCE(?, dodo_product_id),
       current_period_end = COALESCE(?, current_period_end), updated_at = ? WHERE user_id = ?`,
    )
      .bind(effectivePlan, status, subId, customerId, productId, periodEnd, now, userId)
      .run();
    await c.env.DB.prepare("UPDATE users SET plan_id = ? WHERE id = ?").bind(effectivePlan, userId).run();
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
  }
}
