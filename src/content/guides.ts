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

const UPDATED = "2026-09-04";

const SHARED_RELATED = [
  { href: "/tools/email-setup-checker", label: "Email setup checker" },
  { href: "/tools/mx-checker", label: "MX checker" },
  { href: "/blog/mx-spf-dmarc-setup-checklist", label: "MX/SPF/DMARC checklist" },
  { href: "/custom-domain-email", label: "Custom domain email" },
  { href: "/#pricing", label: "Pricing" },
];

export const GUIDE_CONTENT: Record<string, GuideBody> = {
  cloudflare: {
    heading: "Cloudflare custom domain email with Flap",
    intro:
      "Most Flap mailers already use Cloudflare. Email Routing + Worker delivery is how Flap receives mail. Keep proxy status correct and copy records exactly from Flap and the Cloudflare dashboard.",
    definition:
      "Flap custom-domain email on Cloudflare means your domain’s MX points at Cloudflare Email Routing (route*.mx.cloudflare.net), SPF includes _spf.mx.cloudflare.net, DKIM is published from Cloudflare, and a routing rule sends matching addresses to the Flap Worker so mail appears in your Flap inbox at useflap.online.",
    updated: UPDATED,
    steps: [
      "In Flap: Settings → Setup → Add your domain and create a mailbox (e.g. hello@).",
      "In Cloudflare: Email → Email Routing → enable routing for the domain if prompted.",
      "Copy the MX records Flap shows (route1/2/3.mx.cloudflare.net) into DNS. MX must be DNS-only (grey cloud), never proxied.",
      "Add or update the SPF TXT so it includes include:_spf.mx.cloudflare.net. Merge with existing SPF carefully — only one SPF TXT per name.",
      "Copy DKIM from Cloudflare Email Routing → Settings (selector often cf2024-1) into a TXT record.",
      "Create a Routing rule: match your mailbox (or catch-all) → Send to a Worker → select the Flap Worker.",
      "Optional: add a DMARC TXT at _dmarc (start with p=none if you are learning).",
      "Back in Flap, use Check DNS. Send a test message from an external account.",
    ],
    mistakes: [
      "Orange-cloud / proxied MX (mail breaks).",
      "Forgetting the Worker routing rule after MX is live.",
      "SPF that does not include _spf.mx.cloudflare.net.",
      "Creating the mailbox in Flap but not the matching routing rule.",
      "Leaving old Google/Zoho/Microsoft MX alongside Cloudflare MX.",
    ],
    records_note:
      "Flap displays the MX/SPF values to paste. DKIM values come from the Cloudflare Email Routing dashboard — Flap does not generate DKIM keys. Always copy the live values from your Flap setup screen and Cloudflare.",
    verification:
      "Flap’s Check DNS looks for expected MX and SPF. Use /tools/mx-checker and /tools/spf-checker for a second opinion. Propagation can take minutes to hours depending on TTL.",
    proxy_notes:
      "MX and mail-related TXT must not be proxied. Website A/AAAA records can stay orange-clouded; that is unrelated to mail delivery.",
    faqs: [
      {
        q: "Do I need Cloudflare nameservers?",
        a: "Email Routing is a Cloudflare product. Many founders use Cloudflare DNS; if DNS is elsewhere, you still publish Cloudflare’s MX/SPF/DKIM values at that host and complete routing in Cloudflare Email Routing.",
      },
      {
        q: "Why grey cloud on MX?",
        a: "Mail exchange records must resolve to the real MX hosts. Proxying MX breaks SMTP.",
      },
      {
        q: "Is catch-all supported?",
        a: "Create a catch-all routing rule in Cloudflare Email Routing and enable catch-all on a paid Flap plan when you want any local-part delivered.",
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
      "If your domain uses vercel-dns.com nameservers, add Flap’s Cloudflare Email Routing MX/SPF records in the Vercel Domains DNS UI, then finish the Worker rule in Cloudflare Email Routing.",
    definition:
      "Using Vercel DNS with Flap means the domain’s nameservers stay on Vercel while MX/TXT records publish Cloudflare Email Routing values so Flap can receive and send custom-domain email.",
    updated: UPDATED,
    steps: [
      "Add the domain and a mailbox in Flap (Settings → Setup).",
      "Open Vercel → Domains → your domain → DNS Records.",
      "Add the three MX records Flap lists (priorities → route1/2/3.mx.cloudflare.net). Remove conflicting MX from another mail product.",
      "Add or merge SPF TXT so it includes include:_spf.mx.cloudflare.net.",
      "Add DKIM TXT from Cloudflare Email Routing settings (Vercel hosts the TXT; Cloudflare Email Routing still owns the keys).",
      "In Cloudflare Email Routing, create the Worker rule that delivers to Flap.",
      "In Flap, Check DNS (auto-poll watches while records propagate).",
    ],
    mistakes: [
      "Editing DNS at the registrar while nameservers still point at Vercel.",
      "Leaving Vercel or third-party email MX in place.",
      "Skipping the Cloudflare Worker routing rule — MX alone is not enough for Flap.",
    ],
    records_note:
      "Vercel apex host is usually @ or blank. Subdomains use the subdomain label only. Flap still receives mail via Cloudflare Email Routing even when DNS is hosted on Vercel.",
    verification:
      "Confirm MX with /tools/mx-checker from outside Vercel’s UI. Flap Check DNS should turn green once MX + SPF match expectations.",
    faqs: [
      {
        q: "Can my site stay on Vercel?",
        a: "Yes. Only mail records change. Keep A/CNAME for the website as they are.",
      },
      {
        q: "Do I need a Cloudflare account?",
        a: "Yes for Email Routing and the Worker delivery path Flap uses — even if DNS stays on Vercel.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      ...SHARED_RELATED,
    ],
  },

  namecheap: {
    heading: "Namecheap DNS for Flap email",
    intro: "Point Namecheap Advanced DNS at Cloudflare Email Routing so Flap can receive mail on your custom domain.",
    definition:
      "Namecheap + Flap means you publish Cloudflare Email Routing MX/SPF/DKIM in Namecheap Advanced DNS, complete the Flap Worker routing rule in Cloudflare, and manage the inbox at useflap.online.",
    updated: UPDATED,
    steps: [
      "Add the domain in Flap and create your first address.",
      "In Namecheap → Domain List → Manage → Advanced DNS (nameservers must be Namecheap BasicDNS / PremiumDNS for these edits to matter).",
      "Add the three MX records Flap shows (priorities typically 13 / 27 / 40 → route*.mx.cloudflare.net).",
      "Add or update TXT SPF: include include:_spf.mx.cloudflare.net (merge carefully if you already have SPF).",
      "Add DKIM TXT from Cloudflare Email Routing settings.",
      "Finish the Cloudflare Email Routing Worker rule, then Check DNS in Flap.",
    ],
    mistakes: [
      "Leaving old MX records in place.",
      "Host field mistakes (@ vs blank vs domain.com).",
      "Editing Advanced DNS while nameservers point elsewhere.",
    ],
    records_note: "Use Host @ for apex MX/TXT unless Namecheap’s UI requires the bare domain. Copy exact values from Flap — do not invent priorities.",
    verification:
      "Wait for TTL, then Flap Check DNS or /tools/email-setup-checker. Namecheap TTL defaults can delay visible changes.",
    faqs: [
      {
        q: "Namecheap email forwarding still on?",
        a: "Disable or remove forwarding MX that conflicts. Only Cloudflare Email Routing MX should remain for Flap.",
      },
      {
        q: "Private email from Namecheap?",
        a: "You cannot run Namecheap Private Email MX and Flap MX on the same domain at once. Choose one inbound path.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      { href: "/guides/porkbun-custom-domain-email", label: "Porkbun guide" },
      ...SHARED_RELATED,
    ],
  },

  porkbun: {
    heading: "Porkbun DNS for Flap email",
    intro: "Add Flap’s Cloudflare Email Routing records in Porkbun DNS so your domain’s mail lands in Flap.",
    definition:
      "Porkbun + Flap means MX/TXT at Porkbun publish Cloudflare Email Routing values and Cloudflare routes matching addresses to the Flap Worker.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Porkbun → Domain → DNS.",
      "Create MX records exactly as Flap lists them (route1/2/3.mx.cloudflare.net with listed priorities).",
      "Add SPF TXT including _spf.mx.cloudflare.net (single SPF record).",
      "Add DKIM from Cloudflare Email Routing.",
      "Complete Worker routing in Cloudflare, then verify in Flap.",
    ],
    mistakes: [
      "TTL confusion — wait for propagation before assuming failure.",
      "Duplicate SPF records.",
      "Leaving Porkbun forwarding MX active.",
    ],
    records_note: "Porkbun usually uses blank host for apex. Paste values from Flap without adding trailing dots unless the UI requires them.",
    verification: "Use Flap Check DNS and /tools/spf-checker after TTL. Send an external test to hello@ once green.",
    faqs: [
      {
        q: "Can I keep the site on Porkbun URL forwarding?",
        a: "Website forwarding/DNS for web is separate from MX. Just avoid conflicting mail records.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      { href: "/guides/namecheap-custom-domain-email", label: "Namecheap guide" },
      ...SHARED_RELATED,
    ],
  },

  godaddy: {
    heading: "GoDaddy DNS for Flap email",
    intro: "Replace or add MX/TXT at GoDaddy so mail routes through Cloudflare Email Routing to Flap.",
    definition:
      "GoDaddy DNS for Flap means your GoDaddy-hosted DNS zone publishes Cloudflare Email Routing MX/SPF/DKIM and Cloudflare delivers to Flap.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "GoDaddy → DNS Management for the correct domain.",
      "Remove conflicting MX if present; add Flap’s three MX values.",
      "Update SPF TXT to include Cloudflare’s include:_spf.mx.cloudflare.net.",
      "Add DKIM TXT from Cloudflare Email Routing.",
      "Create the Worker rule in Cloudflare Email Routing → Check DNS in Flap.",
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
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      { href: "/guides/squarespace-custom-domain-email", label: "Squarespace guide" },
      ...SHARED_RELATED,
    ],
  },

  squarespace: {
    heading: "Squarespace Domains DNS for Flap",
    intro: "If DNS is on Squarespace Domains, add the Flap MX/SPF/DKIM values there, then finish Cloudflare Email Routing for Flap delivery.",
    definition:
      "Squarespace Domains + Flap means mail records in Squarespace DNS point at Cloudflare Email Routing while Flap hosts the inbox.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Squarespace Domains → DNS settings for the domain.",
      "Add MX records exactly as Flap lists.",
      "Add SPF and DKIM TXT records (merge SPF if one already exists).",
      "Configure Cloudflare Email Routing Worker rule → verify in Flap.",
    ],
    mistakes: [
      "Squarespace email forwarding still owning MX.",
      "Not waiting for DNS TTL.",
      "Editing the site builder DNS when nameservers are not on Squarespace.",
    ],
    records_note: "Follow Squarespace’s host field conventions for apex vs subdomain. Prefer values copied from Flap over screenshots from other providers.",
    verification: "After TTL, run Flap Check DNS and send a test from Gmail or another external provider.",
    faqs: [
      {
        q: "Can the website stay on Squarespace?",
        a: "Yes. Change only mail-related records; keep web records intact.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      { href: "/guides/godaddy-custom-domain-email", label: "GoDaddy guide" },
      ...SHARED_RELATED,
    ],
  },

  route53: {
    heading: "Route 53 DNS for Flap email",
    intro: "Create MX and TXT records in your Amazon Route 53 hosted zone for Cloudflare Email Routing so Flap can host your domain inbox.",
    definition:
      "Route 53 + Flap means the Route 53 hosted zone publishes Cloudflare Email Routing MX/SPF/DKIM; Cloudflare routes to the Flap Worker; you use the inbox at useflap.online.",
    updated: UPDATED,
    steps: [
      "Add domain + mailbox in Flap.",
      "Route 53 → Hosted zone for the domain → Create records.",
      "MX: three records with Flap priorities/values (route1/2/3.mx.cloudflare.net).",
      "TXT SPF including include:_spf.mx.cloudflare.net; separate TXT for DKIM selector.",
      "Optional DMARC TXT at _dmarc.example.com.",
      "Cloudflare Email Routing Worker rule → Check DNS in Flap.",
    ],
    mistakes: [
      "Wrong hosted zone (especially with multiple accounts).",
      "SPF character escaping / quoting quirks in the console.",
      "Leaving legacy SES or Google MX sets active.",
    ],
    records_note:
      "Record name is usually the apex (blank / zone name) for MX and SPF. DKIM uses the selector hostname Cloudflare shows (e.g. cf2024-1._domainkey).",
    verification:
      "dig MX / TXT from your laptop or use Flap’s checkers. Route 53 is authoritative quickly once records save — client caches may lag.",
    faqs: [
      {
        q: "Does Flap use SES?",
        a: "Inbound for Flap goes through Cloudflare Email Routing to a Worker. Do not point MX at SES unless you are running a different architecture.",
      },
      {
        q: "Subdomain mail only?",
        a: "You can publish MX on a subdomain if Flap shows subdomain setup — otherwise use apex records for the domain you added in Flap.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
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
