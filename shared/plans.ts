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

export const SCALE_MIN_MAILBOXES = 13;
export const SCALE_MAX_MAILBOXES = 300;
export const SCALE_UNIT_MONTHLY = 2.5;
export const SCALE_UNIT_YEARLY = 25;

/**
 * Paid plans share the same product surface. Capacity differs.
 * IMAP/SMTP not included yet (webmail + API).
 */
export const SHARED_STACK_FEATURES = [
  "AI assistant (beta)",
  "Up to 50 custom domains",
  "2 aliases per mailbox (org pool)",
  "API + SDK + CLI + MCP",
  "Webmail",
  "Webhooks",
  "Newsletters",
  "Calendars & contacts",
  "Shared inboxes",
  "Booking pages",
  "Transactional email",
  "Catch-all addresses",
  "Email filtering",
  "Spam protection auto-setup",
] as const;

/**
 * Pricing rationale (not a blind Shipmail clone):
 * Shipmail: Free=$0/0 mailboxes + card trial; Solo $4 / Pro $9 / Team $29 / Scale $2.50.
 * Flap: Free forever with 2 real mailboxes (conversion wedge); Solo $6 / Pro $12 / Team $29 / Scale $2.50.
 * Stack COGS: Cloudflare Workers/D1/R2 + Amazon SES (~$0.10/1k sends) + Clerk.
 * Shipmail Solo $4 / 20k sends leaves ~$2 SES headroom before CF/Clerk/support, too tight for Flap Free wedge.
 * Solo $6 / Pro $12 balances acquisition vs margin; Team/Scale stickers match Shipmail where capacity is similar.
 */
export const PRICING_RATIONALE =
  "Free forever (real mailboxes) funds itself via Solo $6+. SES outbound at Solo caps is ~$1.50–2/mo; remaining covers CF, Clerk, and support. Pro $12 is the highlighted growth plan. Team $29 and Scale $2.50/mailbox match Shipmail capacity stickers.";

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
    blurb: "One person, one inbox, up to 50 domains. The lowest-cost way to cover every project.",
    features: [
      "3 mailboxes",
      "15 GB storage per mailbox",
      "1 team member",
      "15,000 email sends/month",
      "1,000 newsletter sends/month",
      "500 active subscribers",
      "Up to 50 custom domains",
      "Same stack as every paid plan",
    ],
    limits: {
      domains: 50,
      mailboxes: 3,
      aliases: 6,
      storage_bytes: 3 * gb(15),
      send_per_month: 15_000,
      api_keys: 10,
      webhooks: 10,
      team_seats: 1,
      saved_views: 50,
      notify_channels: 5,
      newsletter_sends_per_month: 1_000,
      newsletter_subscribers: 500,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price_monthly: 12,
    price_yearly: yearlyPriceFromMonthly(12),
    blurb: "Small teams: shared inboxes, up to 5 seats, and 6 mailboxes across 50 domains.",
    features: [
      "6 mailboxes",
      "15 GB storage per mailbox",
      "Up to 5 team members",
      "40,000 email sends/month",
      "5,000 newsletter sends/month",
      "2,500 active subscribers",
      "Up to 50 custom domains",
      "Same stack as every paid plan",
    ],
    highlighted: true,
    limits: {
      domains: 50,
      mailboxes: 6,
      aliases: 12,
      storage_bytes: 6 * gb(15),
      send_per_month: 40_000,
      api_keys: 25,
      webhooks: 25,
      team_seats: 5,
      saved_views: 100,
      notify_channels: 15,
      newsletter_sends_per_month: 5_000,
      newsletter_subscribers: 2_500,
    },
  },
  team: {
    id: "team",
    name: "Team",
    price_monthly: 29,
    price_yearly: yearlyPriceFromMonthly(29),
    blurb: "Studios and agencies: unlimited seats, 12 mailboxes, and 50 domains in one account.",
    features: [
      "12 mailboxes",
      "25 GB storage per mailbox",
      "Unlimited team members",
      "120,000 email sends/month",
      "25,000 newsletter sends/month",
      "10,000 active subscribers",
      "Up to 50 custom domains",
      "Same stack as every paid plan",
    ],
    limits: {
      domains: 50,
      mailboxes: 12,
      aliases: 24,
      storage_bytes: 12 * gb(25),
      send_per_month: 120_000,
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
    blurb: "13–300 mailboxes at a flat per-mailbox rate.",
    per_mailbox: true,
    features: [
      "$2.50 / mailbox / mo ($25 / yr)",
      "13–300 mailboxes",
      "25 GB storage per mailbox",
      "10,000 sends / mailbox / mo",
      "Unlimited team members",
      "Up to 50 custom domains",
      "Same stack as every paid plan",
    ],
    limits: {
      domains: 50,
      mailboxes: SCALE_MIN_MAILBOXES,
      aliases: SCALE_MIN_MAILBOXES * 2,
      storage_bytes: SCALE_MIN_MAILBOXES * gb(25),
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
