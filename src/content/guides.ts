import { GUIDE_PAGES } from "./marketing";

export type GuideBody = {
  heading: string;
  intro: string;
  definition: string;
  updated: string;
  steps: string[];
  mistakes: string[];
  records_note: string;
  verification: string;
  proxy_notes?: string;
  faqs: Array<{ q: string; a: string }>;
  related: Array<{ href: string; label: string }>;
};

const UPDATED = "2026-09-06";

const SHARED_RELATED = [
  { href: "/tools", label: "All Flap tools" },
  { href: "/tools/email-setup-checker", label: "Email setup checker" },
  { href: "/tools/mx-checker", label: "MX checker" },
  { href: "/blog/mx-spf-dmarc-setup-checklist", label: "MX/SPF/DMARC checklist" },
  { href: "/custom-domain-email", label: "Custom domain email" },
  { href: "/#pricing", label: "Pricing" },
];

const SHARED_STEPS_TAIL = [
  "Add or merge SPF so it includes include:amazonses.com (only one SPF TXT per name).",
  "Add the SES verification TXT (_amazonses) and Easy DKIM CNAMEs Flap shows.",
  "Optional: add DMARC at _dmarc (start with p=none).",
  "In Flap, use Check setup. Send a test from an external inbox (Gmail, etc.).",
];

export const GUIDE_CONTENT: Record<string, GuideBody> = {
  cloudflare: {
    heading: "Cloudflare DNS for Flap email",
    intro:
      "If your domain’s nameservers are on Cloudflare, add Flap’s MX/SPF/DKIM in the DNS tab. Your domain does not need Cloudflare Email Routing — Flap receives mail via Amazon SES after those records publish.",
    definition:
      "Flap on Cloudflare DNS means you publish SES MX (inbound-smtp.<region>.amazonaws.com), SPF include:amazonses.com, and SES Easy DKIM CNAMEs at Cloudflare DNS (grey-cloud / DNS-only for mail records). Mailbox, aliases, and catch-all are configured in Flap — not as Cloudflare Email Routing Worker rules.",
    updated: UPDATED,
    steps: [
      "In Flap: Settings → Setup → Add your domain and create a mailbox (e.g. hello@).",
      "In Cloudflare: DNS → Records. Copy the MX records Flap shows (inbound-smtp.<region>.amazonaws.com). MX must be DNS-only (grey cloud), never proxied.",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "Orange-cloud / proxied MX (mail breaks).",
      "Leaving Cloudflare Email Routing MX (route*.mx.cloudflare.net) when you intend to use Flap’s SES path — pick one inbound provider.",
      "SPF that does not include amazonses.com.",
      "Leaving old Google/Zoho/Microsoft MX alongside Flap MX.",
    ],
    records_note:
      "Always copy live values from Flap Settings → Setup. DKIM is provisioned with the domain; do not invent selectors.",
    verification:
      "Flap’s Check setup looks for SES MX + SPF (legacy Cloudflare Routing MX still passes for older setups). Propagation can take minutes to hours depending on TTL.",
    proxy_notes:
      "MX and mail-related TXT/CNAME must not be proxied. Website A/AAAA can stay orange-clouded; that is unrelated to mail delivery.",
    faqs: [
      {
        q: "Do I need Cloudflare Email Routing?",
        a: "No. Flap’s current path is DNS → Amazon SES → Flap ingest. Email Routing Worker rules are only needed for legacy setups that still point MX at route*.mx.cloudflare.net.",
      },
      {
        q: "Why grey cloud on MX?",
        a: "Mail exchange records must resolve to the real MX hosts. Proxying MX breaks SMTP.",
      },
      {
        q: "Is catch-all supported?",
        a: "Enable catch-all on a Flap mailbox for the domain (plan allowing). No extra Cloudflare routing rule is required on the SES path.",
      },
    ],
    related: [
      { href: "/guides/namecheap-custom-domain-email", label: "Namecheap guide" },
      { href: "/guides/vercel-custom-domain-email", label: "Vercel guide" },
      ...SHARED_RELATED,
    ],
  },

  vercel: {
    heading: "Vercel DNS for Flap email",
    intro:
      "If your domain uses vercel-dns.com nameservers, add Flap’s MX/SPF/DKIM in the Vercel Domains DNS UI. No Cloudflare zone or Email Routing is required.",
    definition:
      "Using Vercel DNS with Flap means nameservers stay on Vercel while MX/TXT/CNAME publish Flap’s SES DNS values so you can send and receive at useflap.online.",
    updated: UPDATED,
    steps: [
      "Add the domain and a mailbox in Flap (Settings → Setup).",
      "Open Vercel → Domains → your domain → DNS Records.",
      "Add the MX records Flap lists (inbound-smtp.<region>.amazonaws.com). Remove conflicting MX from another mail product.",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "Editing DNS at the registrar while nameservers still point at Vercel.",
      "Leaving Vercel or third-party email MX in place.",
      "Assuming you need a Cloudflare account — you do not for Flap mail.",
    ],
    records_note:
      "Vercel apex host is usually @ or blank. Subdomains use the subdomain label only. Copy values from Flap.",
    verification:
      "Confirm MX with /tools/mx-checker. Flap Check setup should turn green once MX + SPF match expectations.",
    faqs: [
      {
        q: "Can my site stay on Vercel?",
        a: "Yes. Only mail records change. Keep A/CNAME for the website as they are.",
      },
      {
        q: "Do I need a Cloudflare account?",
        a: "No. Flap runs on Cloudflare Workers for the app, but your customer domain DNS can stay entirely on Vercel.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      ...SHARED_RELATED,
    ],
  },

  namecheap: {
    heading: "Namecheap DNS for Flap email",
    intro: "Publish Flap’s MX/SPF/DKIM in Namecheap Advanced DNS so mail for your domain lands in Flap.",
    definition:
      "Namecheap + Flap means you add SES MX/SPF/DKIM in Namecheap Advanced DNS and manage the inbox at useflap.online — no requirement that the domain be a Cloudflare zone.",
    updated: UPDATED,
    steps: [
      "Add the domain in Flap and create your first address.",
      "In Namecheap → Domain List → Manage → Advanced DNS (nameservers must be Namecheap BasicDNS / PremiumDNS for these edits to matter).",
      "Add the MX records Flap shows (typically priority 10 → inbound-smtp.<region>.amazonaws.com).",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "Leaving old MX records in place.",
      "Host field mistakes (@ vs blank vs domain.com).",
      "Editing Advanced DNS while nameservers point elsewhere.",
    ],
    records_note: "Use Host @ for apex MX/TXT unless Namecheap’s UI requires the bare domain. Copy exact values from Flap.",
    verification:
      "Wait for TTL, then Flap Check setup or /tools/email-setup-checker. Namecheap TTL defaults can delay visible changes.",
    faqs: [
      {
        q: "Namecheap email forwarding still on?",
        a: "Disable or remove forwarding MX that conflicts. Only Flap’s SES MX should remain.",
      },
      {
        q: "Private email from Namecheap?",
        a: "You cannot run Namecheap Private Email MX and Flap MX on the same domain at once. Choose one inbound path.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      { href: "/guides/porkbun-custom-domain-email", label: "Porkbun guide" },
      ...SHARED_RELATED,
    ],
  },

  porkbun: {
    heading: "Porkbun DNS for Flap email",
    intro: "Add Flap’s mail DNS records in Porkbun so your domain’s mail lands in Flap.",
    definition:
      "Porkbun + Flap means MX/TXT/CNAME at Porkbun publish Flap’s SES DNS values; you use the inbox at useflap.online.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Porkbun → Domain → DNS.",
      "Create MX records exactly as Flap lists them (inbound-smtp.<region>.amazonaws.com).",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "TTL confusion — wait for propagation before assuming failure.",
      "Duplicate SPF records.",
      "Leaving Porkbun forwarding MX active.",
    ],
    records_note: "Porkbun usually uses blank host for apex. Paste values from Flap without adding trailing dots unless the UI requires them.",
    verification: "Use Flap Check setup and /tools/spf-checker after TTL. Send an external test to hello@ once green.",
    faqs: [
      {
        q: "Can I keep the site on Porkbun URL forwarding?",
        a: "Website forwarding/DNS for web is separate from MX. Just avoid conflicting mail records.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      { href: "/guides/namecheap-custom-domain-email", label: "Namecheap guide" },
      ...SHARED_RELATED,
    ],
  },

  godaddy: {
    heading: "GoDaddy DNS for Flap email",
    intro: "Replace or add MX/TXT at GoDaddy so mail routes to Flap via Amazon SES.",
    definition:
      "GoDaddy DNS for Flap means your GoDaddy-hosted DNS zone publishes Flap’s SES MX/SPF/DKIM; Flap hosts the inbox.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "GoDaddy → DNS Management for the correct domain.",
      "Remove conflicting MX if present; add Flap’s MX values.",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "GoDaddy parking or Microsoft 365 / GoDaddy email MX left enabled.",
      "Editing the wrong domain in a multi-domain account.",
      "Two SPF TXT records on @.",
    ],
    records_note: "Name/host is typically @ for apex records. Copy priorities and hosts from the Flap setup panel.",
    verification:
      "GoDaddy changes can take longer than Cloudflare-native DNS. Re-check with Flap and /tools/mx-checker after 15–60 minutes.",
    faqs: [
      {
        q: "Domain registered at GoDaddy but DNS elsewhere?",
        a: "Edit records at the DNS host shown by your nameservers — not necessarily GoDaddy’s DNS panel.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      { href: "/guides/squarespace-custom-domain-email", label: "Squarespace guide" },
      ...SHARED_RELATED,
    ],
  },

  squarespace: {
    heading: "Squarespace Domains DNS for Flap",
    intro: "If DNS is on Squarespace Domains, add Flap’s MX/SPF/DKIM values there — no Cloudflare Email Routing step.",
    definition:
      "Squarespace Domains + Flap means mail records in Squarespace DNS point at Amazon SES while Flap hosts the inbox.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Squarespace Domains → DNS settings for the domain.",
      "Add MX records exactly as Flap lists.",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "Squarespace email forwarding still owning MX.",
      "Not waiting for DNS TTL.",
      "Editing the site builder DNS when nameservers are not on Squarespace.",
    ],
    records_note: "Follow Squarespace’s host field conventions for apex vs subdomain. Prefer values copied from Flap.",
    verification: "After TTL, run Flap Check setup and send a test from Gmail or another external provider.",
    faqs: [
      {
        q: "Can the website stay on Squarespace?",
        a: "Yes. Change only mail-related records; keep web records intact.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      { href: "/guides/godaddy-custom-domain-email", label: "GoDaddy guide" },
      ...SHARED_RELATED,
    ],
  },

  route53: {
    heading: "Route 53 DNS for Flap email",
    intro: "Create MX and TXT/CNAME records in your Amazon Route 53 hosted zone for Flap (Amazon SES), then use the inbox at useflap.online.",
    definition:
      "Route 53 + Flap means the hosted zone publishes SES MX/SPF/DKIM; Flap stores mail in D1/R2. Customer mail uses SES inbound; this guide is only about publishing the DNS records Flap shows.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Route 53 → Hosted zone for the domain → Create records.",
      "MX: records Flap lists (inbound-smtp.<region>.amazonaws.com).",
      ...SHARED_STEPS_TAIL,
    ],
    mistakes: [
      "Wrong hosted zone (especially with multiple accounts).",
      "SPF character escaping / quoting quirks in the console.",
      "Leaving Google Workspace or other provider MX sets active.",
    ],
    records_note:
      "Record name is usually the apex (blank / zone name) for MX and SPF. DKIM uses the selector hostname Flap shows (e.g. smtp._domainkey).",
    verification:
      "dig MX / TXT from your laptop or use Flap’s checkers. Route 53 is authoritative quickly once records save — client caches may lag.",
    faqs: [
      {
        q: "Does Flap use SES?",
        a: "Yes for customer domains. Point MX at the inbound-smtp host Flap shows for your region, plus SES verification and DKIM records from Settings.",
      },
      {
        q: "Subdomain mail only?",
        a: "You can publish MX on a subdomain if that is the domain you added in Flap — otherwise use apex records for that domain name.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide" },
      { href: "/guides/vercel-custom-domain-email", label: "Vercel guide" },
      ...SHARED_RELATED,
    ],
  },
};

export function getGuideMeta(path: string) {
  return GUIDE_PAGES.find((g) => g.path === path) ?? null;
}

export function getGuideBody(provider: string): GuideBody | null {
  return GUIDE_CONTENT[provider] ?? null;
}
