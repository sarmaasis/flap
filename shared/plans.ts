/** Central plan catalog: used by Worker quotas and marketing UI. */

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
  /** Annual = monthly * 10 (2 months free). Scale uses per-mailbox helpers. */
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

export const SCALE_MIN_MAILBOXES = 19;
export const SCALE_MAX_MAILBOXES = 300;
export const SCALE_UNIT_MONTHLY = 3;
export const SCALE_UNIT_YEARLY = 30;

/**
 * Paid plans use the same core workflow. Capacity differs.
 * IMAP/SMTP not included yet (webmail + API).
 */
export const SHARED_STACK_FEATURES = [
  "Multi-domain web inbox",
  "Reply from the receiving address",
  "Guided MX, SPF, and DKIM setup",
  "API keys and signed webhooks",
  "Webmail",
  "Mailbox export",
  "Rules and saved views",
  "Domain labels",
  "Team access controls",
  "Newsletter sends with caps",
  "Calendar and booking previews",
  "Transactional email",
  "Catch-all addresses",
  "Email filtering",
  "SES-backed delivery logs",
] as const;

/**
 * Pricing rationale:
 * Flap keeps a useful free tier and charges around the multi-domain workflow.
 * Stack COGS: Cloudflare Workers/D1/R2 + Amazon SES (~$0.10/1k sends) + Clerk.
 * Paid plans scale by mailbox count, team access, storage, API usage, and send capacity.
 */
export const PRICING_RATIONALE =
  "Free forever proves the DNS and inbox flow. Solo and Pro fund meaningful SES send caps, storage, and support. Team and Scale are priced for agencies that manage several branded domains in one place.";

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

function gb(n: number): number {
  return n * 1024 * 1024 * 1024;
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price_monthly: 0,
    price_yearly: 0,
    blurb: "Real mailboxes on two domains. Prove MX before you pay. No credit card required.",
    features: [
      "2 custom domains",
      "2 mailboxes",
      "4 aliases",
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
      aliases: 4,
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
    price_monthly: 6,
    price_yearly: yearlyPriceFromMonthly(6),
    blurb: "One founder, one operational inbox, and room for every active project domain.",
    features: [
      "3 mailboxes",
      "12 GB pooled storage",
      "1 team member",
      "8,000 email sends/month",
      "500 newsletter sends/month",
      "500 active subscribers",
      "25 custom domains",
      "API keys and webhooks",
    ],
    limits: {
      domains: 25,
      mailboxes: 3,
      aliases: 6,
      storage_bytes: gb(12),
      send_per_month: 8_000,
      api_keys: 10,
      webhooks: 10,
      team_seats: 1,
      saved_views: 50,
      notify_channels: 5,
      newsletter_sends_per_month: 500,
      newsletter_subscribers: 500,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 15,
    price_yearly: yearlyPriceFromMonthly(15),
    blurb: "Small teams that need more branded addresses, shared work, and product email.",
    features: [
      "8 mailboxes",
      "40 GB pooled storage",
      "Up to 5 team members",
      "25,000 email sends/month",
      "2,500 newsletter sends/month",
      "2,500 active subscribers",
      "40 custom domains",
      "Shared inboxes and assignments",
    ],
    highlighted: true,
    limits: {
      domains: 40,
      mailboxes: 8,
      aliases: 16,
      storage_bytes: gb(40),
      send_per_month: 25_000,
      api_keys: 25,
      webhooks: 25,
      team_seats: 5,
      saved_views: 100,
      notify_channels: 15,
      newsletter_sends_per_month: 2_500,
      newsletter_subscribers: 2_500,
    },
  },
  team: {
    id: "team",
    name: "Team",
    price_monthly: 35,
    price_yearly: yearlyPriceFromMonthly(35),
    blurb: "Studios and agencies running client or portfolio mail from one workspace.",
    features: [
      "18 mailboxes",
      "120 GB pooled storage",
      "Up to 25 team members",
      "80,000 email sends/month",
      "10,000 newsletter sends/month",
      "10,000 active subscribers",
      "75 custom domains",
      "Agency-ready access controls",
    ],
    limits: {
      domains: 75,
      mailboxes: 18,
      aliases: 36,
      storage_bytes: gb(120),
      send_per_month: 80_000,
      api_keys: 100,
      webhooks: 50,
      team_seats: 25,
      saved_views: 500,
      notify_channels: 50,
      newsletter_sends_per_month: 10_000,
      newsletter_subscribers: 10_000,
    },
  },
  scale: {
    id: "scale",
    name: "Scale",
    price_monthly: SCALE_UNIT_MONTHLY,
    price_yearly: SCALE_UNIT_YEARLY,
    blurb: "For portfolios that need predictable mailbox expansion beyond Team.",
    per_mailbox: true,
    features: [
      "$3 / mailbox / mo ($30 / yr)",
      "19–300 mailboxes",
      "10 GB storage added per mailbox",
      "5,000 sends / mailbox / mo",
      "Up to 50 team members",
      "100 custom domains included",
      "Concierge domain onboarding",
    ],
    limits: {
      domains: 100,
      mailboxes: SCALE_MIN_MAILBOXES,
      aliases: SCALE_MIN_MAILBOXES * 2,
      storage_bytes: SCALE_MIN_MAILBOXES * gb(10),
      send_per_month: SCALE_MIN_MAILBOXES * 5_000,
      api_keys: 200,
      webhooks: 100,
      team_seats: 50,
      saved_views: 1_000,
      notify_channels: 100,
      newsletter_sends_per_month: 15_000,
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
