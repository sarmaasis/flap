/** Plan catalog for Flap SaaS. Product IDs come from Dodo dashboard env vars. */

export type PlanId = "free" | "starter" | "pro" | "business";

export type PlanLimits = {
  domains: number;
  mailboxes: number;
  aliases: number;
  storage_bytes: number;
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

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    blurb: "Try Flap with one domain and a real mailbox.",
    features: [
      "1 custom domain",
      "2 mailboxes",
      "5 aliases",
      "100 MB storage",
      "Rules, contacts, signatures",
      "Export & restore",
    ],
    limits: {
      domains: 1,
      mailboxes: 2,
      aliases: 5,
      storage_bytes: 100 * 1024 * 1024,
      api_keys: 0,
      webhooks: 0,
      team_seats: 1,
    },
  },
  starter: {
    id: "starter",
    name: "Starter",
    price_monthly: 9,
    blurb: "For founders who need send, aliases, and API access.",
    features: [
      "3 domains",
      "10 mailboxes",
      "50 aliases & disposables",
      "5 GB storage",
      "API keys + webhooks",
      "Catch-all & filters",
    ],
    limits: {
      domains: 3,
      mailboxes: 10,
      aliases: 50,
      storage_bytes: 5 * 1024 * 1024 * 1024,
      api_keys: 5,
      webhooks: 3,
      team_seats: 1,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 19,
    blurb: "Full mailbox power for growing teams and brands.",
    features: [
      "10 domains",
      "50 mailboxes",
      "Unlimited aliases",
      "25 GB storage",
      "Unlimited API keys & webhooks",
      "Priority support queue",
    ],
    highlighted: true,
    limits: {
      domains: 10,
      mailboxes: 50,
      aliases: 10_000,
      storage_bytes: 25 * 1024 * 1024 * 1024,
      api_keys: 100,
      webhooks: 50,
      team_seats: 5,
    },
  },
  business: {
    id: "business",
    name: "Business",
    price_monthly: 49,
    blurb: "Higher limits, shared inbox roadmap, and ops headroom.",
    features: [
      "50 domains",
      "200 mailboxes",
      "Unlimited aliases",
      "100 GB storage",
      "Team seats (roadmap)",
      "Dedicated onboarding help",
    ],
    limits: {
      domains: 50,
      mailboxes: 200,
      aliases: 50_000,
      storage_bytes: 100 * 1024 * 1024 * 1024,
      api_keys: 500,
      webhooks: 200,
      team_seats: 25,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "business"];

export function planFromProductId(
  productId: string | null | undefined,
  env: {
    DODO_PRODUCT_STARTER?: string;
    DODO_PRODUCT_PRO?: string;
    DODO_PRODUCT_BUSINESS?: string;
  },
): PlanId {
  if (!productId) return "free";
  if (env.DODO_PRODUCT_STARTER && productId === env.DODO_PRODUCT_STARTER) return "starter";
  if (env.DODO_PRODUCT_PRO && productId === env.DODO_PRODUCT_PRO) return "pro";
  if (env.DODO_PRODUCT_BUSINESS && productId === env.DODO_PRODUCT_BUSINESS) return "business";
  return "free";
}

export function productIdForPlan(
  plan: PlanId,
  env: {
    DODO_PRODUCT_STARTER?: string;
    DODO_PRODUCT_PRO?: string;
    DODO_PRODUCT_BUSINESS?: string;
  },
): string | null {
  if (plan === "starter") return env.DODO_PRODUCT_STARTER || null;
  if (plan === "pro") return env.DODO_PRODUCT_PRO || null;
  if (plan === "business") return env.DODO_PRODUCT_BUSINESS || null;
  return null;
}
