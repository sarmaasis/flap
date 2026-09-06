/**
 * Phrases that must not appear in current-path SEO / setup content.
 * Legacy comparison pages may mention Cloudflare Email Routing when clearly labeled.
 */
/**
 * Phrases that must not appear as current-path setup instructions.
 * Legacy comparison pages may discuss Cloudflare Email Routing when labeled as competitor/migration.
 */
export const OBSOLETE_SETUP_PHRASES = [
  "finish the Cloudflare Email Routing Worker rule",
  "finish the Worker routing rule",
  "Cloudflare Worker routing rule",
  "route1/2/3.mx.cloudflare.net",
  "route1.mx.cloudflare.net",
  "route2.mx.cloudflare.net",
  "route3.mx.cloudflare.net",
  "Solo 3, Builder 10",
  "Solo 3, Builder 10, Studio 40",
  "Solo $9 (3 domains)",
  "Builder $19 (10)",
  "Solo $9",
  "prove MX on one domain",
  "Free includes 1 domain",
  "Free: 1 domain",
  "DKIM from Cloudflare Email Routing",
  "Via Cloudflare Email Routing → Flap Worker",
  "For Flap inbound via Cloudflare Routing, include include:_spf.mx.cloudflare.net",
  "Point MX to Cloudflare Email Routing as Flap documents",
  "publish Cloudflare Email Routing MX/SPF/DKIM",
] as const;

/** Stale hard-coded plan numbers that contradict shared/plans.ts (current: Free 2 / Solo 5 / Builder 20 / Solo $7). */
export const OBSOLETE_PLAN_PHRASES = [
  "Solo 3, Builder 10",
  "Solo 3, Builder 10, Studio 40",
  "Solo $9",
  "for up to 10 domains — savings",
  "Solo $9 (3 domains), Builder $19 (10)",
] as const;
