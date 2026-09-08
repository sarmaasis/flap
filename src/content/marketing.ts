import { PLANS, PLAN_ORDER, type PlanId } from "../../shared/plans";

export const SITE_URL = "https://useflap.online";
export const SUPPORT_EMAIL = "support@useflap.online";

export const MARKETING = {
  product_name: "Flap",
  one_line: "Custom-domain email for every project you ship.",
  short_description:
    "Custom-domain email for indie hackers, serial founders, and agencies. One inbox for all your domains. Webmail, shared inboxes, AI assistant, newsletters, booking pages, and a transactional API.",
  long_description:
    "Flap is custom-domain email hosting for indie hackers, serial founders, and small studios. Connect every project domain, send and receive as you@yourstartup.com, and keep webmail, calendar, newsletters, bookings, AI assistant, and a developer API in one subscription. From $6/mo. Free plan includes real mailboxes.",
  primary_tagline: "Custom-domain email for every project you ship.",
  founder_tagline: "Email infrastructure for people who keep launching things.",
  product_hunt_tagline: "One inbox for every domain you own, without a Workspace per project",
  hero_subheadline:
    "Shared inboxes, AI-assisted replies, newsletters, booking pages, and a transactional API, all on your own custom domain.",
  microcopy: "Same features on every paid plan. Pick how many mailboxes you need.",
  seo_title: "Flap: Custom-domain email for every project you ship",
  seo_description:
    "Custom-domain email hosting for founders with multiple projects. Shared inboxes, AI assistant, newsletters, calendar, and transactional email API, all on your own domain. Free plan includes real mailboxes. From $6/mo.",
  key_features: [
    "Webmail across every domain",
    "Calendars & booking pages",
    "Newsletters from your domain",
    "AI assistant (confirm-before-send)",
    "API, webhooks, MCP, thin SDKs",
    "Guided DNS setup on Amazon SES",
  ],
  architecture_line:
    "Customer mail on Amazon SES. App on Cloudflare. Your DNS stays at any registrar.",
} as const;

export const ICP_LINES = [
  "Built for people who keep launching things",
  "Stop creating a new mailbox setup for every side project",
  "Use professional email on every domain you own",
  "Manage all your startup identities from one place",
  "Launch a new domain without adding another email subscription",
] as const;

/** Qualitative credibility until real testimonials exist - do not invent stats. */
export const CREDIBILITY = [
  { title: "Secure domain verification", body: "Guided MX/SPF checks with precise errors - not a vague “verification failed.”" },
  { title: "Proper DNS authentication", body: "SPF and DKIM records you control - published at any DNS host for Flap’s mail provider." },
  { title: "Founder-built", body: "Shipped for indie hackers and studios - not enterprise procurement theater." },
  { title: "Transparent pricing", body: "Domain-first plans. No surprise seat tax for every side project." },
  { title: "Fast setup", body: "Add domain → point DNS → create hello@ → inbox." },
] as const;

/** Empty until real customer quotes are collected. */
export const TESTIMONIALS: Array<{ quote: string; name: string; role: string }> = [];

export function planCards() {
  return PLAN_ORDER.map((id: PlanId) => {
    const p = PLANS[id];
    return {
      id: p.id,
      name: p.name,
      price: p.price_monthly === 0 ? "$0" : `$${p.price_monthly}`,
      price_monthly: p.price_monthly,
      price_yearly: p.price_yearly,
      blurb: p.blurb,
      features: p.features,
      highlighted: Boolean(p.highlighted),
      badge: p.highlighted ? "Most popular" : p.id === "team" ? "Unlimited seats" : p.id === "pro" ? "Up to 5 seats" : undefined,
      cta: p.id === "free" ? "Start free" : `Get ${p.name}`,
      limits: p.limits,
    };
  });
}

export const SEO_PAGES = [
  {
    path: "/google-workspace-alternative",
    title: "Google Workspace alternative for multi-domain founders | Flap",
    description:
      "Need hello@ on every project without a Workspace subscription each time? Flap gives founders one inbox across domains.",
  },
  {
    path: "/email-hosting-for-multiple-domains",
    title: "Email hosting for multiple domains | Flap",
    description:
      "Host email for many domains in one inbox. Built for indie hackers and studios juggling side projects.",
  },
  {
    path: "/custom-domain-email",
    title: "Custom domain email without Workspace | Flap",
    description: "Get you@yourdomain.com with a real inbox, aliases, and send - setup in minutes on Flap.",
  },
  {
    path: "/email-for-indie-hackers",
    title: "Email for indie hackers | Flap",
    description: "Professional email for every side project domain - one inbox, no per-project Workspace tax.",
  },
  {
    path: "/email-for-side-projects",
    title: "Email for side projects | Flap",
    description: "Launch another domain without another email subscription. Flap is one inbox for all your projects.",
  },
  {
    path: "/flap-vs-google-workspace",
    title: "Flap vs Google Workspace for multi-project founders",
    description:
      "Compare Flap and Google Workspace when you run several small products - cost scaling, unified inbox, and setup.",
  },
  {
    path: "/flap-vs-zoho",
    title: "Flap vs Zoho Mail for multi-domain founders",
    description: "When you need simpler multi-project email than managing separate Zoho setups per domain.",
  },
  {
    path: "/multiple-domains-one-inbox",
    title: "Multiple domains, one inbox | Flap",
    description: "Connect every startup domain to a single Flap inbox. Send and receive as each brand identity.",
  },
] as const;

export const TOOL_PAGES = [
  { path: "/tools/google-workspace-cost-calculator", title: "Google Workspace cost calculator | Flap", description: "Estimate Workspace spend across projects vs Flap - interactive savings calculator.", kind: "calculator" },
  { path: "/tools/flap-vs-workspace-share", title: "Flap vs Workspace share card | Flap", description: "Generate a shareable savings card comparing Flap to Google Workspace.", kind: "share" },
  { path: "/tools/spf-checker", title: "SPF checker | Flap", description: "Check your domain SPF TXT record and whether it includes Amazon SES.", kind: "dns", tool: "spf" },
  { path: "/tools/dmarc-checker", title: "DMARC checker | Flap", description: "Look up _dmarc TXT for your domain and read a plain-English summary.", kind: "dns", tool: "dmarc" },
  { path: "/tools/dkim-checker", title: "DKIM checker | Flap", description: "Verify a DKIM selector TXT or CNAME record exists for your domain.", kind: "dns", tool: "dkim" },
  { path: "/tools/mx-checker", title: "MX record checker | Flap", description: "Check MX records and whether they point at Flap (Amazon SES).", kind: "dns", tool: "mx" },
  { path: "/tools/email-setup-checker", title: "Email setup checker | Flap", description: "Combined MX, SPF, and DMARC check for custom-domain email readiness.", kind: "dns", tool: "setup" },
  { path: "/tools/header-analyzer", title: "Email header analyzer | Flap", description: "Paste raw message headers to decode Received, Auth-Results, and routing.", kind: "local", tool: "headers" },
  { path: "/tools/blacklist-checker", title: "Email blacklist / RBL checker | Flap", description: "Check if your domain or IP appears on common RBLs.", kind: "dns", tool: "rbl" },
  { path: "/tools/dmarc-generator", title: "DMARC record generator | Flap", description: "Build a paste-ready DMARC TXT record with policy and rua.", kind: "local", tool: "dmarc-gen" },
  { path: "/tools/spf-flattener", title: "SPF generator / flattener helper | Flap", description: "Build SPF and see lookup-count warnings before you hit the 10-lookup limit.", kind: "local", tool: "spf-flat" },
  { path: "/tools/deliverability-scorecard", title: "Deliverability scorecard | Flap", description: "Grade A-F deliverability from MX, SPF, and DMARC presence.", kind: "dns", tool: "scorecard" },
  { path: "/tools/bimi-checker", title: "BIMI checker | Flap", description: "Look up default._bimi TXT for brand indicators.", kind: "dns", tool: "bimi" },
  { path: "/tools/mta-sts-checker", title: "MTA-STS / TLS-RPT checker | Flap", description: "Check _mta-sts and TLS reporting TXT records.", kind: "dns", tool: "mta-sts" },
  { path: "/tools/catchall-detector", title: "Catch-all detector | Flap", description: "DNS hints plus guidance to test catch-all safely.", kind: "dns", tool: "catchall" },
  { path: "/tools/dns-propagation", title: "DNS propagation checker | Flap", description: "Compare MX across public resolvers.", kind: "dns", tool: "propagation" },
  { path: "/tools/dkim-generator", title: "DKIM generator assist | Flap", description: "Guidance for SES Easy DKIM CNAMEs and selector naming.", kind: "local", tool: "dkim-gen" },
  { path: "/tools/plus-address-tester", title: "Plus-address / alias tester | Flap", description: "Build you+tag@domain addresses for signup hygiene.", kind: "local", tool: "plus" },
  { path: "/tools/from-mismatch", title: "From-domain mismatch educator | Flap", description: "Why replying from the wrong domain burns reputation.", kind: "local", tool: "from-mismatch" },
  { path: "/tools/ptr-checker", title: "PTR / reverse DNS checker | Flap", description: "Reverse-lookup PTR for a domain A record or IP.", kind: "dns", tool: "ptr" },
  { path: "/tools/smtp-banner", title: "SMTP banner probe (safe) | Flap", description: "Safe guidance for SMTP banner checks without sending mail.", kind: "dns", tool: "smtp-banner" },
  { path: "/tools/whois-ns", title: "WHOIS / nameserver quick view | Flap", description: "See NS hosts and a WHOIS link-out for your DNS host.", kind: "dns", tool: "ns" },
  { path: "/tools/arc-explainer", title: "ARC / forward DMARC explainer | Flap", description: "Why forwarded mail fails DMARC and how ARC helps.", kind: "local", tool: "arc" },
  { path: "/tools/registrar-copy", title: "Registrar DNS copy-block | Flap", description: "Paste-ready MX/SPF/DKIM blocks for common registrars.", kind: "local", tool: "registrar" },
] as const;

export const GUIDE_PAGES = [
  {
    path: "/guides/cloudflare-custom-domain-email",
    title: "Cloudflare DNS for Flap email",
    description: "Exact MX/SPF/DKIM records and proxy settings when DNS is on Cloudflare - no Email Routing required.",
    provider: "cloudflare",
  },
  {
    path: "/guides/vercel-custom-domain-email",
    title: "Vercel DNS for Flap email",
    description: "Add Flap MX/SPF/DKIM in Vercel Domains when nameservers are on vercel-dns.com.",
    provider: "vercel",
  },
  {
    path: "/guides/namecheap-custom-domain-email",
    title: "Namecheap DNS for Flap email",
    description: "Add MX and SPF at Namecheap so Flap can receive mail on your domain.",
    provider: "namecheap",
  },
  {
    path: "/guides/porkbun-custom-domain-email",
    title: "Porkbun DNS for Flap email",
    description: "Point Porkbun DNS at Flap’s Amazon SES MX/SPF/DKIM records.",
    provider: "porkbun",
  },
  {
    path: "/guides/godaddy-custom-domain-email",
    title: "GoDaddy DNS for Flap email",
    description: "Add Flap MX and SPF records in GoDaddy DNS.",
    provider: "godaddy",
  },
  {
    path: "/guides/squarespace-custom-domain-email",
    title: "Squarespace Domains DNS for Flap",
    description: "Configure Squarespace Domains DNS for Flap custom-domain email.",
    provider: "squarespace",
  },
  {
    path: "/guides/route53-custom-domain-email",
    title: "Route 53 DNS for Flap email",
    description: "Publish Flap Amazon SES MX/SPF/DKIM in an Amazon Route 53 hosted zone.",
    provider: "route53",
  },
] as const;

/** Blog post paths - keep in sync with src/content/blog.ts */
export const BLOG_INDEX = {
  path: "/blog",
  title: "Blog - custom domain email for founders | Flap",
  description:
    "Practical posts on multi-domain email, Workspace cost, DNS (MX/SPF/DMARC), and hosted vs self-host mail - from Flap (useflap.online).",
} as const;

export const BLOG_SLUGS = [
  "custom-domain-email-without-google-workspace",
  "cost-of-google-workspace-multiple-domains",
  "mx-spf-dmarc-setup-checklist",
  "self-host-vs-hosted-email-startups",
  "catchall-aliases-indie-founders",
] as const;
