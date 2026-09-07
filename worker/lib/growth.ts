import { Hono } from "hono";
import { requireUser, getSessionUser } from "./auth";
import { ensureReferralCode } from "./referrals";
import { getActivationState } from "./activation";
import { nowMs } from "./ids";
import { ANALYTICS_EVENTS, trackServerEvent } from "./analytics";

type App = { Bindings: Env };

export function registerGrowthRoutes(app: Hono<App>) {
  app.get("/api/referrals", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const code = await ensureReferralCode(c.env.DB, user.id);
    const origin = (c.env.APP_URL || "https://useflap.online").replace(/\/$/, "");
    const link = `${origin}/signup?ref=${encodeURIComponent(code)}`;

    const bonus = await c.env.DB
      .prepare("SELECT referral_bonus_domains FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ referral_bonus_domains: number }>();

    const rows = await c.env.DB
      .prepare(
        `SELECT r.id, r.status, r.reward_domains, r.created_at, r.qualified_at, r.rewarded_at,
                r.block_reason, u.email AS referred_email
         FROM referrals r
         JOIN users u ON u.id = r.referred_user_id
         WHERE r.referrer_user_id = ?
         ORDER BY r.created_at DESC
         LIMIT 50`,
      )
      .bind(user.id)
      .all<{
        id: string;
        status: string;
        reward_domains: number;
        created_at: number;
        qualified_at: number | null;
        rewarded_at: number | null;
        block_reason: string | null;
        referred_email: string;
      }>();

    const list = rows.results ?? [];
    const successful = list.filter((r) => r.status === "rewarded").length;
    const pending = list.filter((r) => r.status === "pending").length;

    return c.json({
      code,
      link,
      domains_earned: Number(bonus?.referral_bonus_domains ?? 0),
      successful_referrals: successful,
      pending_referrals: pending,
      reward_rule:
        "Invite a founder → both accounts get +1 domain permanently after they verify email and connect a domain.",
      abuse_controls: [
        "Self-referral blocked",
        "Disposable email domains blocked",
        "Shared Dodo customer_id / payment fingerprint blocks reward",
      ],
      history: list.map((r) => ({
        id: r.id,
        status: r.status,
        reward_domains: r.reward_domains,
        created_at: r.created_at,
        qualified_at: r.qualified_at,
        rewarded_at: r.rewarded_at,
        block_reason: r.block_reason,
        referred_email: maskEmail(r.referred_email),
      })),
    });
  });

  app.get("/api/activation", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    const state = await getActivationState(c.env.DB, user.id);
    return c.json(state);
  });

  app.post("/api/activation/dismiss-onboarding", async (c) => {
    const user = await requireUser(c);
    if (user instanceof Response) return user;
    await c.env.DB.prepare("UPDATE users SET onboarding_dismissed = 1 WHERE id = ?").bind(user.id).run();
    return c.json({ ok: true });
  });

  app.get("/api/analytics/bootstrap", async (c) => {
    return c.json({ ok: true, ts: nowMs(), product: "flap" });
  });

  /**
   * First-party analytics ingest. Accepts sendBeacon / fetch POST.
   * Body: { e: eventName, p?: props, t?: clientTs, s?: sessionId, path?: string }
   * or { events: [...] } for batches.
   */
  app.post("/api/analytics", async (c) => {
    const sessionUser = await getSessionUser(c);
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") return c.json({ ok: false }, 400);

    const items: unknown[] = Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : [body];

    let accepted = 0;
    for (const raw of items.slice(0, 40)) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as {
        e?: string;
        event?: string;
        p?: Record<string, string | number | boolean | null>;
        props?: Record<string, string | number | boolean | null>;
        s?: string;
        session_id?: string;
        path?: string;
      };
      const event = item.e || item.event;
      if (!event || !ANALYTICS_EVENTS.has(event)) continue;
      await trackServerEvent(c.env.DB, event, {
        userId: sessionUser?.id ?? null,
        sessionId: item.s || item.session_id || null,
        props: item.p || item.props,
        path: item.path || null,
      });
      accepted++;
    }

    return c.json({ ok: true, accepted });
  });

  /**
   * Verification mail is owned by Clerk. This endpoint confirms session state;
   * the client should call Clerk prepareVerification / email link flow.
   */
  app.post("/api/account/resend-verification", async (c) => {
    const sessionUser = await getSessionUser(c);
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || sessionUser?.email || "").trim().toLowerCase();
    if (!email) {
      return c.json({ error: "Sign in required, or provide an email to resend." }, 401);
    }
    if (sessionUser && sessionUser.email.trim().toLowerCase() !== email) {
      return c.json({ error: "Email does not match the signed-in account." }, 400);
    }
    if (sessionUser?.emailVerified) {
      return c.json({ ok: true, sent: false, reason: "already_verified", message: "Email is already verified." });
    }
    if (!sessionUser) {
      return c.json({
        error: "Sign in required to resend verification. Prefer a magic link on /login.",
      }, 401);
    }
    return c.json({
      ok: true,
      sent: false,
      use_clerk_client: true,
      message: "Request a verification link from the verify-email page (Clerk sends the email).",
    });
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = (local || "").slice(0, 2);
  return `${visible}***@${domain}`;
}
