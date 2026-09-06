/**
 * Path-only client routes shared by App.tsx, Worker SPA fallback, and wrangler run_worker_first.
 * Full page bodies stay in src/content — keep these lists in sync when adding routes.
 */

/** Auth / app shells — always served by Worker (no prerender). */
export const AUTH_SPA_PREFIXES = [
  "/app",
  "/signup",
  "/login",
  "/setup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/settings/referrals",
] as const;

/** Marketing HTML prefixes for wrangler run_worker_first (Worker tries prerender asset, else SPA). */
export const MARKETING_HTML_PREFIXES = [
  "/about",
  "/pricing",
  "/support",
  "/status",
  "/terms",
  "/privacy",
  "/billing-terms",
  "/tools",
  "/docs",
  "/guides",
  "/blog",
  "/security",
  "/for",
  "/vs",
  "/research",
  "/book",
] as const;


export const FOR_PATHS = [
  "/for/indie-hackers",
  "/for/startups",
  "/for/freelancers",
  "/for/developers",
  "/for/agencies",
  "/for/ecommerce",
  "/for/creators",
] as const;

export const VS_PATHS = [
  "/vs/google-workspace",
  "/vs/microsoft-365",
  "/vs/zoho-mail",
  "/vs/shipmail",
  "/vs/hydra",
  "/vs/folio",
  "/vs/cloudflare-email-routing",
  "/vs/migadu",
  "/vs/fastmail",
  "/vs/improvmx",
] as const;

export const SEO_PATHS = [
  "/google-workspace-alternative",
  "/email-hosting-for-multiple-domains",
  "/custom-domain-email",
  "/email-for-indie-hackers",
  "/email-for-side-projects",
  "/flap-vs-google-workspace",
  "/flap-vs-zoho",
  "/multiple-domains-one-inbox",
  "/cloudflare-email-routing-alternative",
  "/hydra-alternative",
  "/folio-alternative",
  "/justemails-alternative",
  "/migadu-alternative",
  "/improvmx-alternative",
] as const;

export const BLOG_PATHS = [
  "/blog/custom-domain-email-without-google-workspace",
  "/blog/cost-of-google-workspace-multiple-domains",
  "/blog/mx-spf-dmarc-setup-checklist",
  "/blog/self-host-vs-hosted-email-startups",
  "/blog/catchall-aliases-indie-founders",
] as const;

export const DNS_TOOL_PATHS = [
  "/tools/spf-checker",
  "/tools/dmarc-checker",
  "/tools/dkim-checker",
  "/tools/mx-checker",
  "/tools/email-setup-checker",
  "/tools/header-analyzer",
  "/tools/blacklist-checker",
  "/tools/dmarc-generator",
  "/tools/spf-flattener",
  "/tools/deliverability-scorecard",
  "/tools/bimi-checker",
  "/tools/mta-sts-checker",
  "/tools/catchall-detector",
  "/tools/dns-propagation",
  "/tools/dkim-generator",
  "/tools/plus-address-tester",
  "/tools/from-mismatch",
  "/tools/ptr-checker",
  "/tools/smtp-banner",
  "/tools/whois-ns",
  "/tools/arc-explainer",
  "/tools/registrar-copy",
] as const;

export const GUIDE_PATHS = [
  "/guides/cloudflare-custom-domain-email",
  "/guides/vercel-custom-domain-email",
  "/guides/namecheap-custom-domain-email",
  "/guides/porkbun-custom-domain-email",
  "/guides/godaddy-custom-domain-email",
  "/guides/squarespace-custom-domain-email",
  "/guides/route53-custom-domain-email",
] as const;

/** Exact marketing collection / product pages (plus nested tool/guide/blog paths above). */
const MARKETING_EXACT = [
  "/",
  "/about",
  "/pricing",
  "/support",
  "/status",
  "/terms",
  "/privacy",
  "/billing-terms",
  "/tools",
  "/tools/google-workspace-cost-calculator",
  "/tools/flap-vs-workspace-share",
  "/docs",
  "/docs/api",
  "/guides",
  "/blog",
  "/security",
  "/for",
  "/vs",
  "/research",
] as const;

const KNOWN_CLIENT_PATHS = new Set<string>([
  ...MARKETING_EXACT,
  ...SEO_PATHS,
  ...BLOG_PATHS,
  ...DNS_TOOL_PATHS,
  ...GUIDE_PATHS,
  ...FOR_PATHS,
  ...VS_PATHS,
  "/for",
  "/vs",
  "/security",
  "/research",
  "/book",
]);

export function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function isSpaShellPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return AUTH_SPA_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True when App.tsx can render this path (SPA shell OK if prerender HTML is missing). */
export function isKnownClientPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (KNOWN_CLIENT_PATHS.has(path)) return true;
  if (isSpaShellPath(path)) return true;
  return false;
}
