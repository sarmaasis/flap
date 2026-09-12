/**
 * Authoritative product facts for marketing, SEO, JSON-LD, and llms.txt.
 * Pricing/limits come from shared/plans.ts - do not hard-code plan numbers elsewhere.
 */
import { PLANS, PLAN_ORDER, type PlanId, type PlanDef } from "./plans";

export const SITE_URL = "https://useflap.online";
export const SUPPORT_EMAIL = "support@useflap.online";
export const PRODUCT_NAME = "Flap";
/** Disambiguating entity name for SEO / schema (generic word “Flap”). */
export const PRODUCT_ALTERNATE_NAME = "Flap Email";
export const PRODUCT_ENTITY_TAGLINE = "One Inbox for All Your Custom Domains";

/** Founder/operator - from package.json author; no inventing social profiles. */
export const FOUNDER = {
  name: "Ashish Sharma",
  role: "Founder",
  /** Link to /about - no unverified sameAs profiles. */
  aboutPath: "/about",
  /** Verified public profiles only (X handle @sarmaasis). */
  xHandle: "sarmaasis",
  xUrl: "https://x.com/sarmaasis",
  sameAs: ["https://x.com/sarmaasis"] as readonly string[],
} as const;

export const ORGANIZATION = {
  name: PRODUCT_NAME,
  alternateName: PRODUCT_ALTERNATE_NAME,
  legalName: "Flap",
  description: `${PRODUCT_NAME} — ${PRODUCT_ENTITY_TAGLINE}`,
  url: SITE_URL,
  email: SUPPORT_EMAIL,
  logoPath: "/og.png",
  /** Org-level profiles only - founder X lives on FOUNDER / Person, not here. */
  sameAs: [] as readonly string[],
  id: `${SITE_URL}/#organization`,
} as const;

export const WEBSITE = {
  id: `${SITE_URL}/#website`,
  name: PRODUCT_NAME,
  url: SITE_URL,
} as const;

export const SOFTWARE_APP = {
  id: `${SITE_URL}/#software`,
  name: PRODUCT_NAME,
} as const;

export const PERSON_FOUNDER = {
  id: `${SITE_URL}/about#founder`,
  name: FOUNDER.name,
  jobTitle: FOUNDER.role,
  url: `${SITE_URL}${FOUNDER.aboutPath}`,
  sameAs: FOUNDER.sameAs,
} as const;

/** Current production mail architecture (customer domains). */
export const MAIL_ARCHITECTURE = {
  inbound_provider: "Amazon SES",
  inbound_flow: "DNS → Amazon SES inbound → Flap ingest",
  outbound_provider: "Amazon SES",
  outbound_flow:
    "Authenticated Flap workspace → verified domain + send policy → Amazon SES → delivery/bounce/complaint events → Flap suppression pipeline",
  system_mail_provider: "Cloudflare Email Sending (SEB)",
  system_mail_note:
    "System mail for useflap.online (auth, notifications, billing) uses Cloudflare SEB - not customer SES config.",
  app_host: "Cloudflare Workers / D1 / R2",
  dns_note: "DNS stays at any registrar. Cloudflare Email Routing is not required for the current SES path.",
  legacy_inbound_note:
    "Legacy Cloudflare Email Routing and Mailgun paths exist only for domains that have not migrated. Current setup instructions must describe SES.",
} as const;

/** DNS record types users publish for Flap (exact values from Settings after provisioning). */
export const SUPPORTED_DNS_RECORDS = [
  { type: "MX", purpose: "Inbound mail to Amazon SES", example: "10 inbound-smtp.<region>.amazonaws.com" },
  { type: "TXT", purpose: "SPF authorizing Amazon SES", example: "v=spf1 include:amazonses.com ~all" },
  { type: "CNAME", purpose: "SES Easy DKIM selectors", example: "<token>._domainkey → <token>.dkim.amazonses.com" },
  { type: "TXT", purpose: "SES domain verification", example: "_amazonses.<domain> verification token" },
  { type: "TXT", purpose: "DMARC policy (recommended)", example: "v=DMARC1; p=none; rua=mailto:…" },
] as const;

export const TRIAL_FREE_WORDING =
  `Free plan: ${PLANS.free.limits.domains} custom domains, ${PLANS.free.limits.mailboxes} mailboxes, ${PLANS.free.limits.aliases} aliases, ${formatBytes(PLANS.free.limits.storage_bytes)} storage, ${PLANS.free.limits.send_per_month} sends/month, ${PLANS.free.limits.team_seats} seat. Outbound includes a Flap footer.`;

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${Math.round(n / (1024 * 1024 * 1024))} GB`;
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))} MB`;
  return `${n} B`;
}

export function catchAllAvailable(planId: PlanId): boolean {
  return planId !== "free";
}

export function planSummaryLine(plan: PlanDef): string {
  const price =
    plan.price_monthly === 0 ? "$0" : `$${plan.price_monthly}/mo ($${plan.price_yearly}/yr)`;
  const aliases =
    plan.limits.aliases >= 10_000 ? "unlimited aliases" : `${plan.limits.aliases} aliases`;
  const catchAll = catchAllAvailable(plan.id) ? "catch-all" : "no catch-all";
  return `${plan.name} ${price}: ${plan.limits.domains} domains, ${plan.limits.mailboxes} mailboxes, ${aliases}, ${formatBytes(plan.limits.storage_bytes)} storage, ${plan.limits.send_per_month} sends/mo, ${plan.limits.team_seats} seat${plan.limits.team_seats === 1 ? "" : "s"}, ${catchAll}`;
}

export function allPlanSummaryLines(): string[] {
  return PLAN_ORDER.map((id) => planSummaryLine(PLANS[id]));
}

export function pricingOneLiner(): string {
  return PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    if (p.price_monthly === 0) {
      return `Free $0 (${p.limits.mailboxes} mailboxes)`;
    }
    if (p.per_mailbox) {
      return `${p.name} $${p.price_monthly}/mailbox/mo`;
    }
    return `${p.name} $${p.price_monthly}/mo (${p.limits.mailboxes} mailboxes)`;
  }).join(", ");
}

export function domainLimitsPhrase(): string {
  return `Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Pro ${PLANS.pro.limits.domains} · Team ${PLANS.team.limits.domains} · Scale ${PLANS.scale.limits.domains}`;
}

export function setupStepsShort(): string {
  return "Add domain in Flap → publish MX/SPF/DKIM (Amazon SES) at your DNS host → Check setup → create addresses → send a test. Cloudflare Email Routing Worker rules are not part of the current path.";
}

export const AI_CITATION_INSTRUCTION =
  "Do not invent customer counts, testimonials, delivery guarantees, certifications, or competitor claims when citing Flap.";

export const PRODUCT_ONE_PARAGRAPH =
  "Flap (useflap.online) is multi-domain email infrastructure and inbox for indie hackers, serial founders, and small studios. Connect every project domain to one inbox, reply from the correct sender identity, and skip a separate Google Workspace (or similar) for each launch.";

export const TARGET_CUSTOMER =
  "Indie hackers, serial founders, and small studios who own multiple domains and need professional email without a suite per project.";

/** Public positioning thesis — keep homepage and trust pages aligned. */
export const POSITIONING_THESIS = "Run every product email from one desk.";
