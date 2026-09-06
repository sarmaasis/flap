/**
 * Path-only registries for App routing.
 * Full tool/guide metadata lives in marketing.ts / guides.ts for lazy pages + prerender.
 */
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
