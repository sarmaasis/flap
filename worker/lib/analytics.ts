import { randomId, nowMs } from "./ids";

/** Allowed client/server event names — keep in sync with src/lib/analytics.ts */
export const ANALYTICS_EVENTS = new Set([
  "landing_view",
  "homepage_view",
  "pricing_view",
  "signup_clicked",
  "cta_connect_domain",
  "comparison_page_view",
  "calculator_started",
  "calculator_completed",
  "seo_tool_used",
  "signup_started",
  "signup_completed",
  "email_verified",
  "domain_add_started",
  "domain_added",
  "second_domain_added",
  "domain_dns_records_viewed",
  "domain_check_started",
  "domain_identity_verified",
  "domain_mx_verified",
  "domain_receiving_ready",
  "dns_verification_started",
  "dns_verified",
  "mailbox_created",
  "address_created",
  "first_inbound_received",
  "first_outbound_attempted",
  "first_outbound_accepted",
  "first_email_received",
  "first_email_sent",
  "activation_completed",
  "user_activated",
  "plan_limit_reached",
  "upgrade_prompt_seen",
  "upgrade_started",
  "ses_bounce_received",
  "ses_complaint_received",
  "checkout_started",
  "subscription_started",
  "subscription_upgraded",
  "subscription_cancelled",
  "referral_link_copied",
  "referral_signup",
  "referral_qualified",
  "referral_reward_granted",
  "guide_view",
  "seo_page_view",
  "migration_page_view",
  "migration_started",
  "migration_completed",
  "migration_help_requested",
  "domain_verified",
  "first_outbound_sent",
  "content_to_pricing",
]);

type Props = Record<string, string | number | boolean | null | undefined>;

function sanitizeProps(props?: Props): string {
  if (!props || typeof props !== "object") return "{}";
  const out: Record<string, string | number | boolean | null> = {};
  let n = 0;
  for (const [k, v] of Object.entries(props)) {
    if (n >= 24) break;
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (v === undefined) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (v === null) out[k] = null;
    n++;
  }
  return JSON.stringify(out);
}

/**
 * Persist a first-party analytics event. Failures are swallowed so product
 * flows never break on telemetry.
 */
export async function trackServerEvent(
  db: D1Database,
  event: string,
  opts?: {
    userId?: string | null;
    sessionId?: string | null;
    props?: Props;
    path?: string | null;
  },
): Promise<void> {
  if (!ANALYTICS_EVENTS.has(event)) return;
  try {
    await db
      .prepare(
        `INSERT INTO analytics_events (id, event, user_id, session_id, props_json, path, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        randomId("aev"),
        event,
        opts?.userId || null,
        opts?.sessionId ? String(opts.sessionId).slice(0, 64) : null,
        sanitizeProps(opts?.props),
        opts?.path ? String(opts.path).slice(0, 240) : null,
        nowMs(),
      )
      .run();
  } catch (err) {
    console.warn("analytics insert failed", event, err);
  }
}

/** Emit only the first time a milestone column flips for this user. */
export async function trackOncePerUser(
  db: D1Database,
  userId: string,
  event: string,
  props?: Props,
): Promise<void> {
  const existing = await db
    .prepare("SELECT id FROM analytics_events WHERE user_id = ? AND event = ? LIMIT 1")
    .bind(userId, event)
    .first();
  if (existing) return;
  await trackServerEvent(db, event, { userId, props });
}
