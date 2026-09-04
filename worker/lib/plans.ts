/** Plan catalog for Flap hosted SaaS. Product IDs come from Dodo dashboard env vars. */

export type PlanId = "free" | "pro" | "team";

export type PlanLimits = {
  domains: number;
  mailboxes: number;
  aliases: number;
  storage_bytes: number;
  /** Outbound sends per UTC calendar month (drafts / scheduled until flush do not count). */
  send_per_month: number;
  api_keys: number;
  webhooks: number;
  team_seats: number;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  price_monthly: number;
  blurb: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
};

/**
 * Hosted SaaS pricing vs DIY self-host one-time licenses.
 * Flap charges for convenience (managed delivery + inbox) and real team seats.
 *
 * Storage quota = D1 message bodies (UTF-8) + R2 attachment bytes.
 * Send quota = successful outbound sends; resets on UTC calendar month.
 * Free caps are intentionally tight so shared CF free-tier inclusions are not burned unbounded.
 */
export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    blurb: "Solo trial — prove MX on one brand domain.",
    features: [
      "1 custom domain",
      "2 mailboxes",
      "5 aliases",
      "25 MB storage",
      "100 sends / month",
      "Rules, contacts, signatures",
      "Export & restore",
      "1 seat (you only)",
    ],
    limits: {
      domains: 1,
      mailboxes: 2,
      aliases: 5,
      storage_bytes: 25 * 1024 * 1024,
      send_per_month: 100,
      api_keys: 0,
      webhooks: 0,
      team_seats: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 15,
    blurb: "Solo founders with multiple brands — no team seats.",
    features: [
      "5 domains",
      "20 mailboxes",
      "Unlimited aliases & disposables",
      "15 GB storage",
      "2,000 sends / month",
      "API keys + webhooks",
      "Catch-all & filters",
      "1 seat (solo)",
    ],
    highlighted: true,
    limits: {
      domains: 5,
      mailboxes: 20,
      aliases: 10_000,
      storage_bytes: 15 * 1024 * 1024 * 1024,
      send_per_month: 2_000,
      api_keys: 25,
      webhooks: 15,
      team_seats: 1,
    },
  },
  team: {
    id: "team",
    name: "Team",
    price_monthly: 39,
    blurb: "Multi-seat workspaces with shared mailboxes.",
    features: [
      "15 domains",
      "75 mailboxes",
      "Unlimited aliases",
      "50 GB storage",
      "10,000 sends / month",
      "Up to 10 team seats",
      "Shared inboxes (support@, hello@)",
      "Mailbox delegation & roles",
      "Priority support",
    ],
    limits: {
      domains: 15,
      mailboxes: 75,
      aliases: 50_000,
      storage_bytes: 50 * 1024 * 1024 * 1024,
      send_per_month: 10_000,
      api_keys: 100,
      webhooks: 50,
      team_seats: 10,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "team"];

/** Map legacy plan ids from existing subscriptions onto the new catalog. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (raw === "pro") return "pro";
  if (raw === "team" || raw === "business") return "team";
  if (raw === "starter") return "pro";
  return "free";
}

export function planFromProductId(
  productId: string | null | undefined,
  env: {
    DODO_PRODUCT_PRO?: string;
    DODO_PRODUCT_TEAM?: string;
    /** @deprecated mapped to pro */
    DODO_PRODUCT_STARTER?: string;
    /** @deprecated mapped to team */
    DODO_PRODUCT_BUSINESS?: string;
  },
): PlanId {
  if (!productId) return "free";
  if (env.DODO_PRODUCT_PRO && productId === env.DODO_PRODUCT_PRO) return "pro";
  if (env.DODO_PRODUCT_TEAM && productId === env.DODO_PRODUCT_TEAM) return "team";
  if (env.DODO_PRODUCT_STARTER && productId === env.DODO_PRODUCT_STARTER) return "pro";
  if (env.DODO_PRODUCT_BUSINESS && productId === env.DODO_PRODUCT_BUSINESS) return "team";
  return "free";
}

export function productIdForPlan(
  plan: PlanId,
  env: {
    DODO_PRODUCT_PRO?: string;
    DODO_PRODUCT_TEAM?: string;
    DODO_PRODUCT_STARTER?: string;
    DODO_PRODUCT_BUSINESS?: string;
  },
): string | null {
  if (plan === "pro") return env.DODO_PRODUCT_PRO || env.DODO_PRODUCT_STARTER || null;
  if (plan === "team") return env.DODO_PRODUCT_TEAM || env.DODO_PRODUCT_BUSINESS || null;
  return null;
}
