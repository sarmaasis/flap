import { PLANS, PLAN_ORDER, type PlanId } from "../../shared/plans";

export const SITE_URL = "https://useflap.online";
export const SUPPORT_EMAIL = "support@useflap.online";

export const MARKETING = {
  product_name: "Flap",
  one_line: "One inbox for every product you build.",
  short_description:
    "One inbox for every product you build. Connect multiple custom domains, receive everything in one place, and reply from the correct sender identity.",
  long_description:
    "Flap is multi-domain email infrastructure and inbox for indie hackers, serial founders, and small studios. Connect every project domain to one inbox, preserve each brand’s sender identity on reply, and skip a separate Google Workspace (or similar) subscription per launch. From $6/mo. Free plan includes real mailboxes.",
  primary_tagline: "One inbox for every product you build.",
  founder_tagline: "Email infrastructure for people who keep launching things.",
  product_hunt_tagline: "One inbox for every domain you own, without a Workspace per project",
  hero_subheadline:
    "Connect all your custom domains, receive every message in one place, and reply automatically from the correct address.",
  secondary_line: "No extra Workspace account. No forwarding hack. No SMTP juggling.",
  microcopy: "Same product surface on every paid plan. Upgrade for mailboxes, seats, and send capacity.",
  seo_title: "Flap — One Inbox for All Your Custom Domains",
  seo_description:
    "Manage email for every SaaS, side project, client, or business domain from one inbox. Receive centrally and reply automatically from the correct address.",
  key_features: [
    "Many domains → one inbox",
    "Reply from the receiving address",
    "Guided DNS (MX/SPF/DKIM)",
    "Shared inboxes & seats when you grow",
    "Export anytime (.mbox / JSON)",
    "API, newsletters, bookings once domains are connected",
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

/** Qualitative credibility until real testimonials exist - do not invent stats or star ratings. */
export const CREDIBILITY = [
  { title: "Guided domain verification", body: "MX/SPF/DKIM checks with precise errors — not a vague “verification failed.”" },
  { title: "DNS you control", body: "Publish SPF and DKIM at any registrar. Customer mail runs on Amazon SES." },
  { title: "Export anytime", body: "JSON workspace backup and per-mailbox .mbox downloads from Settings." },
  { title: "Transparent pricing", body: "Up to 50 domains on every paid plan. Capacity is mailboxes and seats, not a per-domain seat tax." },
  { title: "Founder-operated", body: "Built and supported by Ashish Sharma — see About for contact and infrastructure." },
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
    path: "/email-for-multiple-domains",
    title: "Email for multiple domains — one inbox | Flap",
    description:
      "Run professional email across every domain you own from one Flap inbox. Receive centrally, reply from the correct address.",
  },
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
    path: "/email-for-founders",
    title: "Email for founders with multiple products | Flap",
    description: "Founder email across every product domain — one inbox, correct reply-from identity.",
  },
  {
    path: "/email-for-side-projects",
    title: "Email for side projects | Flap",
    description: "Launch another domain without another email subscription. Flap is one inbox for all your projects.",
  },
  {
    path: "/email-for-multiple-saas-products",
    title: "Email for multiple SaaS products — one inbox | Flap",
    description:
      "Run hello@ and support@ across every SaaS product domain from one Flap inbox.",
  },
  {
    path: "/email-for-venture-studios",
    title: "Email for venture studios — portfolio domains, one inbox | Flap",
    description:
      "Operate email across venture studio and portfolio company domains from one Flap inbox.",
  },
  {
    path: "/how-to-manage-email-for-multiple-domains",
    title: "How to manage email for multiple domains | Flap",
    description: "Practical playbook for operating email across many domains — inventory, DNS, and cutover.",
  },
  {
    path: "/how-to-send-email-from-multiple-domains",
    title: "How to send email from multiple domains | Flap",
    description:
      "Send as the correct domain across many brands — SPF/DKIM and reply-from identity.",
  },
  {
    path: "/google-workspace-multiple-domains",
    title: "Google Workspace multiple domains — when Flap fits better | Flap",
    description:
      "Workspace multi-domain options vs Flap’s one-inbox model for separate product brands.",
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
