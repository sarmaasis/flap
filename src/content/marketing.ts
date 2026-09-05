import { PLANS, PLAN_ORDER, type PlanId } from "../../shared/plans";

export const SITE_URL = "https://useflap.online";
export const SUPPORT_EMAIL = "support@useflap.online";

export const MARKETING = {
  product_name: "Flap",
  one_line: "One inbox for every startup you build.",
  short_description:
    "Send and receive email across all your startup domains from one inbox, without setting up a separate email workspace for every project.",
  long_description:
    "Flap is custom-domain email for indie hackers, serial founders, and small studios. Connect every project domain, send as you@yourstartup.com, and keep one inbox — instead of paying for a separate Google Workspace (or similar) for each launch.",
  primary_tagline: "One inbox for every startup you build.",
  founder_tagline: "Email infrastructure for people who keep launching things.",
  product_hunt_tagline: "One inbox for every startup you build",
  hero_subheadline:
    "Connect all your domains and send & receive email as you@yourstartup.com without paying for a separate Workspace account for every project.",
  microcopy: "Multiple domains. One inbox. Setup in minutes.",
  seo_title: "Flap — One inbox for every startup you build",
  seo_description:
    "Custom-domain email for founders who launch multiple projects. One inbox across all your domains — faster and cheaper than a Workspace per startup.",
  key_features: [
    "Multiple domains in one inbox",
    "Send as any project identity",
    "Catch-all and aliases",
    "Guided DNS setup",
    "Team seats on Studio",
    "API keys and webhooks on paid plans",
  ],
} as const;

export const ICP_LINES = [
  "Built for people who keep launching things",
  "Stop creating a new mailbox setup for every side project",
  "Use professional email on every domain you own",
  "Manage all your startup identities from one place",
  "Launch a new domain without adding another email subscription",
] as const;

/** Qualitative credibility until real testimonials exist — do not invent stats. */
export const CREDIBILITY = [
  { title: "Secure domain verification", body: "Guided MX/SPF checks with precise errors — not a vague “verification failed.”" },
  { title: "Proper DNS authentication", body: "SPF and DKIM records you control — published at any DNS host for Flap’s mail provider." },
  { title: "Founder-built", body: "Shipped for indie hackers and studios — not enterprise procurement theater." },
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
      blurb: p.blurb,
      features: p.features,
      highlighted: Boolean(p.highlighted),
      badge: p.highlighted ? "Most popular" : undefined,
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
    description: "Get you@yourdomain.com with a real inbox, aliases, and send — setup in minutes on Flap.",
  },
  {
    path: "/email-for-indie-hackers",
    title: "Email for indie hackers | Flap",
    description: "Professional email for every side project domain — one inbox, no per-project Workspace tax.",
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
      "Compare Flap and Google Workspace when you run several small products — cost scaling, unified inbox, and setup.",
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
  { path: "/tools/google-workspace-cost-calculator", title: "Google Workspace cost calculator | Flap", description: "Estimate Workspace spend across projects vs Flap — interactive savings calculator." },
  { path: "/tools/spf-checker", title: "SPF checker | Flap", description: "Check your domain’s SPF TXT record and whether it includes Flap’s mail provider (Amazon SES / include:amazonses.com)." },
  { path: "/tools/dmarc-checker", title: "DMARC checker | Flap", description: "Look up _dmarc TXT for your domain and read a plain-English summary." },
  { path: "/tools/dkim-checker", title: "DKIM checker | Flap", description: "Verify a DKIM selector TXT or CNAME record exists for your domain." },
  { path: "/tools/mx-checker", title: "MX record checker | Flap", description: "Check MX records and whether they point at Flap (Amazon SES)." },
  { path: "/tools/email-setup-checker", title: "Email setup checker | Flap", description: "Combined MX, SPF, and DMARC check for custom-domain email readiness." },
] as const;

export const GUIDE_PAGES = [
  {
    path: "/guides/cloudflare-custom-domain-email",
    title: "Cloudflare DNS for Flap email",
    description: "Exact MX/SPF/DKIM records and proxy settings when DNS is on Cloudflare — no Email Routing required.",
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

/** Blog post paths — keep in sync with src/content/blog.ts */
export const BLOG_INDEX = {
  path: "/blog",
  title: "Blog — custom domain email for founders | Flap",
  description:
    "Practical posts on multi-domain email, Workspace cost, DNS (MX/SPF/DMARC), and hosted vs self-host mail — from Flap (useflap.online).",
} as const;

export const BLOG_SLUGS = [
  "custom-domain-email-without-google-workspace",
  "cost-of-google-workspace-multiple-domains",
  "mx-spf-dmarc-setup-checklist",
  "self-host-vs-hosted-email-startups",
  "catchall-aliases-indie-founders",
] as const;
