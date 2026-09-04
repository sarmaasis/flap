/** Central plan catalog — used by Worker quotas and marketing UI. */

export type PlanId = "free" | "solo" | "builder" | "studio";

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
  /** Free-plan outbound messages include subtle Flap branding when true. */
  branding_footer?: boolean;
};

/**
 * Domain-first pricing for founders who keep launching products.
 * Free is a tight trial; Solo/Builder/Studio scale primarily by domain count.
 *
 * Storage quota = D1 message bodies (UTF-8) + R2 attachment bytes.
 * Send quota = successful outbound sends; resets on UTC calendar month.
 */
export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    blurb: "Prove MX on one project domain.",
    features: [
      "1 custom domain",
      "2 mailboxes",
      "5 aliases",
      "25 MB storage",
      "100 sends / month",
      "Rules, contacts, signatures",
      "Export & restore",
      "1 seat (you only)",
      "Sent with Flap footer",
    ],
    branding_footer: true,
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
  solo: {
    id: "solo",
    name: "Solo",
    price_monthly: 9,
    blurb: "A few side projects, one inbox.",
    features: [
      "3 domains",
      "10 mailboxes",
      "Unlimited aliases",
      "2 GB storage",
      "500 sends / month",
      "Catch-all",
      "No Flap footer",
      "1 seat (solo)",
    ],
    limits: {
      domains: 3,
      mailboxes: 10,
      aliases: 10_000,
      storage_bytes: 2 * 1024 * 1024 * 1024,
      send_per_month: 500,
      api_keys: 5,
      webhooks: 3,
      team_seats: 1,
    },
  },
  builder: {
    id: "builder",
    name: "Builder",
    price_monthly: 19,
    blurb: "Serial launchers with many domains.",
    features: [
      "10 domains",
      "30 mailboxes",
      "Unlimited aliases & disposables",
      "15 GB storage",
      "2,000 sends / month",
      "Catch-all & filters",
      "API keys + webhooks",
      "Priority support",
      "1 seat (solo)",
    ],
    highlighted: true,
    limits: {
      domains: 10,
      mailboxes: 30,
      aliases: 50_000,
      storage_bytes: 15 * 1024 * 1024 * 1024,
      send_per_month: 2_000,
      api_keys: 25,
      webhooks: 15,
      team_seats: 1,
    },
  },
  studio: {
    id: "studio",
    name: "Studio",
    price_monthly: 39,
    blurb: "Studios and small teams across many brands.",
    features: [
      "40 domains",
      "100 mailboxes",
      "Unlimited aliases",
      "50 GB storage",
      "10,000 sends / month",
      "Up to 10 team seats",
      "Shared inboxes (support@, hello@)",
      "Mailbox delegation & roles",
      "Priority support",
    ],
    limits: {
      domains: 40,
      mailboxes: 100,
      aliases: 100_000,
      storage_bytes: 50 * 1024 * 1024 * 1024,
      send_per_month: 10_000,
      api_keys: 100,
      webhooks: 50,
      team_seats: 10,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "solo", "builder", "studio"];

export const PAID_PLAN_IDS: PlanId[] = ["solo", "builder", "studio"];

/** Google Workspace Business Starter list price (USD / user / month) for savings calculator. */
export const GOOGLE_WORKSPACE_USD_PER_USER = 7;

export type DodoProductEnv = {
  DODO_PRODUCT_SOLO?: string;
  DODO_PRODUCT_BUILDER?: string;
  DODO_PRODUCT_STUDIO?: string;
  /** @deprecated → builder */
  DODO_PRODUCT_PRO?: string;
  /** @deprecated → studio */
  DODO_PRODUCT_TEAM?: string;
  /** @deprecated → solo */
  DODO_PRODUCT_STARTER?: string;
  /** @deprecated → studio */
  DODO_PRODUCT_BUSINESS?: string;
};

/** Map legacy plan ids from existing subscriptions onto the new catalog. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  const v = (raw || "").toLowerCase().trim();
  if (v === "solo") return "solo";
  if (v === "builder") return "builder";
  if (v === "studio") return "studio";
  if (v === "pro" || v === "starter") return v === "starter" ? "solo" : "builder";
  if (v === "team" || v === "business") return "studio";
  return "free";
}

export function planFromProductId(productId: string | null | undefined, env: DodoProductEnv): PlanId {
  if (!productId) return "free";
  const solo = (env.DODO_PRODUCT_SOLO || env.DODO_PRODUCT_STARTER || "").trim();
  const builder = (env.DODO_PRODUCT_BUILDER || env.DODO_PRODUCT_PRO || "").trim();
  const studio = (env.DODO_PRODUCT_STUDIO || env.DODO_PRODUCT_TEAM || env.DODO_PRODUCT_BUSINESS || "").trim();
  if (solo && productId === solo) return "solo";
  if (builder && productId === builder) return "builder";
  if (studio && productId === studio) return "studio";
  return "free";
}

export function productIdForPlan(plan: PlanId, env: DodoProductEnv): string | null {
  if (plan === "solo") return (env.DODO_PRODUCT_SOLO || env.DODO_PRODUCT_STARTER || "").trim() || null;
  if (plan === "builder") return (env.DODO_PRODUCT_BUILDER || env.DODO_PRODUCT_PRO || "").trim() || null;
  if (plan === "studio") return (env.DODO_PRODUCT_STUDIO || env.DODO_PRODUCT_TEAM || env.DODO_PRODUCT_BUSINESS || "").trim() || null;
  return null;
}

/** Pick the cheapest Flap plan that covers `domains` (ignoring referral bonuses). */
export function flapPlanForDomains(domains: number): PlanDef {
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    if (plan.limits.domains >= domains) return plan;
  }
  return PLANS.studio;
}

export function googleWorkspaceMonthlyCost(domains: number, usersPerDomain: number): number {
  const d = Math.max(0, Math.floor(domains));
  const u = Math.max(1, Math.floor(usersPerDomain));
  return d * u * GOOGLE_WORKSPACE_USD_PER_USER;
}

export function savingsVsGoogle(domains: number, usersPerDomain = 1) {
  const google = googleWorkspaceMonthlyCost(domains, usersPerDomain);
  const flap = flapPlanForDomains(Math.max(1, Math.floor(domains)));
  const monthly = Math.max(0, google - flap.price_monthly);
  return {
    domains: Math.max(0, Math.floor(domains)),
    users_per_domain: Math.max(1, Math.floor(usersPerDomain)),
    google_monthly: google,
    flap_monthly: flap.price_monthly,
    flap_plan_id: flap.id,
    flap_plan_name: flap.name,
    savings_monthly: monthly,
    savings_annual: monthly * 12,
  };
}
