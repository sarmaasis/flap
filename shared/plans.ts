/** Central plan catalog — used by Worker quotas and marketing UI. */

export type PlanId = "free" | "solo" | "pro" | "team" | "scale";

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
  saved_views: number;
  notify_channels: number;
  newsletter_sends_per_month: number;
  newsletter_subscribers: number;
};

export type PlanDef = {
  id: PlanId;
  name: string;
  price_monthly: number;
  /** Annual = monthly * 10 (Shipmail-clean sticker math). Scale uses per-mailbox helpers. */
  price_yearly: number;
  blurb: string;
  features: string[];
  limits: PlanLimits;
  highlighted?: boolean;
  branding_footer?: boolean;
  per_mailbox?: boolean;
};

/** Annual price: 10× monthly (2 months free). */
export function yearlyPriceFromMonthly(monthly: number): number {
  if (monthly <= 0) return 0;
  return Math.round(monthly * 10);
}

export function monthlyEquivalentFromYearly(yearly: number): number {
  if (yearly <= 0) return 0;
  return Math.round((yearly / 12) * 100) / 100;
}

export const SCALE_MIN_MAILBOXES = 13;
export const SCALE_MAX_MAILBOXES = 300;
export const SCALE_UNIT_MONTHLY = 2.5;
export const SCALE_UNIT_YEARLY = 25;

export function clampScaleMailboxes(n: number): number {
  const v = Math.floor(Number(n) || 0);
  return Math.min(SCALE_MAX_MAILBOXES, Math.max(SCALE_MIN_MAILBOXES, v));
}

export function scaleMonthlyPrice(mailboxes: number): number {
  return clampScaleMailboxes(mailboxes) * SCALE_UNIT_MONTHLY;
}

export function scaleYearlyPrice(mailboxes: number): number {
  return clampScaleMailboxes(mailboxes) * SCALE_UNIT_YEARLY;
}

/**
 * Flap pricing (Shipmail-inspired, docs/shipmail-redesign.md §3.3).
 * Free keeps real mailboxes (Flap conversion wedge). Solo $5 / Pro $12 / Team $29.
 * Domains remain first-class; storage is pooled org-wide until per-mailbox metering exists.
 * Annual = 10× monthly.
 */
export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    price_yearly: 0,
    blurb: "Real mailboxes on two domains. Prove MX before you pay.",
    features: [
      "2 custom domains",
      "2 mailboxes",
      "10 aliases",
      "500 MB storage",
      "200 sends / month",
      "Rules, contacts, signatures",
      "Export & restore",
      "1 seat",
      "Sent with Flap footer",
    ],
    branding_footer: true,
    limits: {
      domains: 2,
      mailboxes: 2,
      aliases: 10,
      storage_bytes: 500 * 1024 * 1024,
      send_per_month: 200,
      api_keys: 0,
      webhooks: 0,
      team_seats: 1,
      saved_views: 3,
      notify_channels: 0,
      newsletter_sends_per_month: 0,
      newsletter_subscribers: 0,
    },
  },
  solo: {
    id: "solo",
    name: "Solo",
    price_monthly: 5,
    price_yearly: yearlyPriceFromMonthly(5),
    blurb: "A few side projects, catch-all, no footer.",
    features: [
      "5 domains",
      "4 mailboxes",
      "Unlimited aliases",
      "5 GB storage",
      "5,000 sends / month",
      "500 newsletter sends / 200 subs",
      "Catch-all",
      "API keys + webhooks",
      "1 seat",
      "No Flap footer",
    ],
    limits: {
      domains: 5,
      mailboxes: 4,
      aliases: 10_000,
      storage_bytes: 5 * 1024 * 1024 * 1024,
      send_per_month: 5_000,
      api_keys: 5,
      webhooks: 3,
      team_seats: 1,
      saved_views: 25,
      notify_channels: 1,
      newsletter_sends_per_month: 500,
      newsletter_subscribers: 200,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 12,
    price_yearly: yearlyPriceFromMonthly(12),
    blurb: "Serial launchers and small teams.",
    features: [
      "15 domains",
      "12 mailboxes",
      "Unlimited aliases",
      "25 GB storage",
      "25,000 sends / month",
      "5,000 newsletter sends / 2,500 subs",
      "Shared inboxes",
      "Up to 5 seats",
      "API, MCP, webhooks",
      "AI draft assist",
    ],
    highlighted: true,
    limits: {
      domains: 15,
      mailboxes: 12,
      aliases: 50_000,
      storage_bytes: 25 * 1024 * 1024 * 1024,
      send_per_month: 25_000,
      api_keys: 25,
      webhooks: 15,
      team_seats: 5,
      saved_views: 100,
      notify_channels: 10,
      newsletter_sends_per_month: 5_000,
      newsletter_subscribers: 2_500,
    },
  },
  team: {
    id: "team",
    name: "Team",
    price_monthly: 29,
    price_yearly: yearlyPriceFromMonthly(29),
    blurb: "Studios and agencies across many brands.",
    features: [
      "40 domains",
      "30 mailboxes",
      "Unlimited aliases",
      "75 GB storage",
      "100,000 sends / month",
      "25,000 newsletter sends / 10,000 subs",
      "Unlimited seats",
      "Shared inboxes & delegation",
      "Priority support target",
      "API, SDKs, CLI, MCP",
    ],
    limits: {
      domains: 40,
      mailboxes: 30,
      aliases: 100_000,
      storage_bytes: 75 * 1024 * 1024 * 1024,
      send_per_month: 100_000,
      api_keys: 100,
      webhooks: 50,
      team_seats: 10_000,
      saved_views: 500,
      notify_channels: 50,
      newsletter_sends_per_month: 25_000,
      newsletter_subscribers: 10_000,
    },
  },
  scale: {
    id: "scale",
    name: "Scale",
    price_monthly: SCALE_UNIT_MONTHLY,
    price_yearly: SCALE_UNIT_YEARLY,
    blurb: "13–300 mailboxes at a per-mailbox rate.",
    per_mailbox: true,
    features: [
      "$2.50 / mailbox / mo ($25 / yr)",
      "13–300 mailboxes",
      "50 domains included",
      "25 GB / mailbox equiv storage",
      "10,000 sends / mailbox / mo",
      "Team newsletter caps",
      "Unlimited seats",
      "API, SDKs, CLI, MCP, webhooks",
    ],
    limits: {
      domains: 50,
      mailboxes: SCALE_MIN_MAILBOXES,
      aliases: 100_000,
      storage_bytes: SCALE_MIN_MAILBOXES * 25 * 1024 * 1024 * 1024,
      send_per_month: SCALE_MIN_MAILBOXES * 10_000,
      api_keys: 200,
      webhooks: 100,
      team_seats: 10_000,
      saved_views: 1_000,
      notify_channels: 100,
      newsletter_sends_per_month: 25_000,
      newsletter_subscribers: 10_000,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "solo", "pro", "team", "scale"];

export const PAID_PLAN_IDS: PlanId[] = ["solo", "pro", "team", "scale"];

export const GOOGLE_WORKSPACE_USD_PER_USER = 7;

export type DodoProductEnv = {
  DODO_PRODUCT_SOLO?: string;
  DODO_PRODUCT_PRO?: string;
  DODO_PRODUCT_TEAM?: string;
  DODO_PRODUCT_SCALE?: string;
  DODO_PRODUCT_SOLO_ANNUAL?: string;
  DODO_PRODUCT_PRO_ANNUAL?: string;
  DODO_PRODUCT_TEAM_ANNUAL?: string;
  DODO_PRODUCT_SCALE_ANNUAL?: string;
  /** @deprecated → pro */
  DODO_PRODUCT_BUILDER?: string;
  /** @deprecated → team */
  DODO_PRODUCT_STUDIO?: string;
  /** @deprecated → solo */
  DODO_PRODUCT_STARTER?: string;
  /** @deprecated → team */
  DODO_PRODUCT_BUSINESS?: string;
  DODO_PRODUCT_BUILDER_ANNUAL?: string;
  DODO_PRODUCT_STUDIO_ANNUAL?: string;
};

export function normalizePlanId(raw: string | null | undefined): PlanId {
  const v = (raw || "").toLowerCase().trim();
  if (v === "solo") return "solo";
  if (v === "pro" || v === "builder") return "pro";
  if (v === "team" || v === "studio" || v === "business") return "team";
  if (v === "scale") return "scale";
  if (v === "starter") return "solo";
  return "free";
}

export function planFromProductId(productId: string | null | undefined, env: DodoProductEnv): PlanId {
  if (!productId) return "free";
  const solo = (env.DODO_PRODUCT_SOLO || env.DODO_PRODUCT_STARTER || "").trim();
  const pro = (env.DODO_PRODUCT_PRO || env.DODO_PRODUCT_BUILDER || "").trim();
  const team = (env.DODO_PRODUCT_TEAM || env.DODO_PRODUCT_STUDIO || env.DODO_PRODUCT_BUSINESS || "").trim();
  const scale = (env.DODO_PRODUCT_SCALE || "").trim();
  const soloY = (env.DODO_PRODUCT_SOLO_ANNUAL || "").trim();
  const proY = (env.DODO_PRODUCT_PRO_ANNUAL || env.DODO_PRODUCT_BUILDER_ANNUAL || "").trim();
  const teamY = (env.DODO_PRODUCT_TEAM_ANNUAL || env.DODO_PRODUCT_STUDIO_ANNUAL || "").trim();
  const scaleY = (env.DODO_PRODUCT_SCALE_ANNUAL || "").trim();
  if (solo && productId === solo) return "solo";
  if (pro && productId === pro) return "pro";
  if (team && productId === team) return "team";
  if (scale && productId === scale) return "scale";
  if (soloY && productId === soloY) return "solo";
  if (proY && productId === proY) return "pro";
  if (teamY && productId === teamY) return "team";
  if (scaleY && productId === scaleY) return "scale";
  return "free";
}

export function productIdForPlan(
  plan: PlanId,
  env: DodoProductEnv,
  interval: "month" | "year" = "month",
): string | null {
  if (plan === "solo") {
    if (interval === "year") return (env.DODO_PRODUCT_SOLO_ANNUAL || "").trim() || null;
    return (env.DODO_PRODUCT_SOLO || env.DODO_PRODUCT_STARTER || "").trim() || null;
  }
  if (plan === "pro") {
    if (interval === "year") {
      return (env.DODO_PRODUCT_PRO_ANNUAL || env.DODO_PRODUCT_BUILDER_ANNUAL || "").trim() || null;
    }
    return (env.DODO_PRODUCT_PRO || env.DODO_PRODUCT_BUILDER || "").trim() || null;
  }
  if (plan === "team") {
    if (interval === "year") {
      return (env.DODO_PRODUCT_TEAM_ANNUAL || env.DODO_PRODUCT_STUDIO_ANNUAL || "").trim() || null;
    }
    return (env.DODO_PRODUCT_TEAM || env.DODO_PRODUCT_STUDIO || env.DODO_PRODUCT_BUSINESS || "").trim() || null;
  }
  if (plan === "scale") {
    if (interval === "year") return (env.DODO_PRODUCT_SCALE_ANNUAL || "").trim() || null;
    return (env.DODO_PRODUCT_SCALE || "").trim() || null;
  }
  return null;
}

export function flapPlanForMailboxes(mailboxes: number): PlanDef {
  const n = Math.max(0, Math.floor(mailboxes));
  if (n <= PLANS.free.limits.mailboxes) return PLANS.free;
  if (n <= PLANS.solo.limits.mailboxes) return PLANS.solo;
  if (n <= PLANS.pro.limits.mailboxes) return PLANS.pro;
  if (n <= PLANS.team.limits.mailboxes) return PLANS.team;
  return PLANS.scale;
}

export function flapPlanForDomains(domains: number): PlanDef {
  const d = Math.max(0, Math.floor(domains));
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    if (plan.limits.domains >= d) return plan;
  }
  return PLANS.scale;
}

export function googleWorkspaceMonthlyCost(domains: number, usersPerDomain: number): number {
  const d = Math.max(0, Math.floor(domains));
  const u = Math.max(1, Math.floor(usersPerDomain));
  return d * u * GOOGLE_WORKSPACE_USD_PER_USER;
}

export function savingsVsGoogle(domains: number, usersPerDomain = 1) {
  const google = googleWorkspaceMonthlyCost(domains, usersPerDomain);
  const flap = flapPlanForDomains(Math.max(1, Math.floor(domains)));
  const flapMonthly =
    flap.id === "scale"
      ? scaleMonthlyPrice(Math.max(SCALE_MIN_MAILBOXES, Math.floor(domains)))
      : flap.price_monthly;
  const monthly = Math.max(0, google - flapMonthly);
  return {
    domains: Math.max(0, Math.floor(domains)),
    users_per_domain: Math.max(1, Math.floor(usersPerDomain)),
    google_monthly: google,
    flap_monthly: flapMonthly,
    flap_yearly:
      flap.id === "scale"
        ? scaleYearlyPrice(Math.max(SCALE_MIN_MAILBOXES, Math.floor(domains)))
        : flap.price_yearly,
    flap_plan_id: flap.id,
    flap_plan_name: flap.name,
    savings_monthly: monthly,
    savings_annual: monthly * 12,
  };
}
