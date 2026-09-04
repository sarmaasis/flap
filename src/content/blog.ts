export type BlogSection = {
  heading: string;
  body: string;
  bullets?: string[];
  subheads?: Array<{ h3: string; body: string }>;
};

export type BlogPost = {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  definition: string;
  lede: string;
  published: string;
  updated: string;
  tags: string[];
  sections: BlogSection[];
  table?: { caption: string; headers: string[]; rows: string[][] };
  faqs: Array<{ q: string; a: string }>;
  related: Array<{ href: string; label: string }>;
};

const UPDATED = "2026-09-04";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "custom-domain-email-without-google-workspace",
    path: "/blog/custom-domain-email-without-google-workspace",
    title: "Custom domain email without Google Workspace | Flap Blog",
    description:
      "How founders get you@yourdomain.com without a Google Workspace subscription per project — inbox vs forwarding, DNS, and when Flap fits.",
    h1: "Custom domain email without Google Workspace",
    definition:
      "You can run custom domain email without Google Workspace by using a hosted mailbox product (such as Flap) or a forwarder. Flap hosts a real inbox for multiple project domains at useflap.online; Workspace remains the better choice when you need Google’s full productivity suite.",
    lede: "Buying the domain is easy. Standing up Workspace for every side project is not. Here is a practical path to professional addresses without a suite per launch.",
    published: UPDATED,
    updated: UPDATED,
    tags: ["custom domain email", "Google Workspace alternative", "founders"],
    sections: [
      {
        heading: "What you actually need",
        body: "Most indie launches need: receive mail at hello@domain, reply as that address, keep threads searchable, and avoid personal Gmail looking unprofessional. They often do not need Docs, Drive, and Meet on that domain.",
        bullets: [
          "Inbox (store + reply) vs forwarder (redirect only)",
          "DNS: MX + SPF (+ DKIM, ideally DMARC)",
          "One product that can hold many domains if you launch often",
        ],
      },
      {
        heading: "Forwarding is not the same as hosting",
        body: "Forwarding to Gmail is fine for low-stakes aliases. It gets messy when customers expect a brand reply, when threads scatter, or when “send as” breaks. A hosted inbox keeps the domain as the mailbox of record.",
      },
      {
        heading: "Where Flap fits",
        body: "Flap is custom-domain email for people who keep launching things: connect domains, one inbox, send as each identity. It is not a Workspace clone. Use Workspace when the suite is the product; use Flap when the job is multi-domain mail.",
      },
      {
        heading: "Setup outline",
        body: "Add the domain in Flap, publish Cloudflare Email Routing MX/SPF/DKIM at your DNS host, finish the Worker routing rule, create addresses, verify with Check DNS, send a test. Provider guides cover Cloudflare, Namecheap, Porkbun, GoDaddy, Squarespace, Route 53, and Vercel.",
      },
    ],
    faqs: [
      {
        q: "Is Flap free?",
        a: "Yes — a Free plan exists to prove MX on one domain with limited sends. Paid Solo/Builder/Studio add domains and limits.",
      },
      {
        q: "Do I delete my Google account?",
        a: "No. Keep personal Gmail. Put project domains on Flap (or another host) as needed.",
      },
    ],
    related: [
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
    ],
  },
  {
    slug: "cost-of-google-workspace-multiple-domains",
    path: "/blog/cost-of-google-workspace-multiple-domains",
    title: "Cost of Google Workspace across multiple domains | Flap Blog",
    description:
      "How Google Workspace cost scales when each project gets its own setup — and how Flap’s domain-first plans compare. Includes calculator link.",
    h1: "The cost of Google Workspace across multiple domains",
    definition:
      "Google Workspace cost across multiple domains scales primarily with seats and how many separate environments you provision. Founders who buy Workspace per side project pay roughly seats × domains × list price; Flap prices mainly by domain count on one account.",
    lede: "Serial founders often underestimate the “one Workspace per idea” tax. Here is a clear cost model and a calculator — with honest caveats.",
    published: UPDATED,
    updated: UPDATED,
    tags: ["pricing", "Google Workspace", "multi-domain"],
    sections: [
      {
        heading: "A simple model",
        body: "Illustrative list price used in Flap’s calculator: Google Workspace Business Starter at $7 per user per month. If you provision one user on each of N project domains as separate setups, monthly cost ≈ N × users × $7.",
        subheads: [
          {
            h3: "Example",
            body: "8 projects × 1 user → about $56/month on that model. Flap Builder is $19/month for up to 10 domains — savings depend on your real provisioning habits.",
          },
        ],
      },
      {
        heading: "What the model misses",
        body: "Regions, taxes, annual discounts, nonprofit pricing, and multi-domain inside a single Workspace customer can change math. Treat calculator output as illustrative, not an invoice.",
      },
      {
        heading: "Flap’s domain-first pricing",
        body: "Solo $9 (3 domains), Builder $19 (10), Studio $39 (40), plus a Free trial tier. Team seats appear on Studio. The product wedge is multi-domain inbox — not undercutting every Workspace SKU.",
      },
      {
        heading: "When paying for Workspace is still right",
        body: "If each “domain” is actually a company that needs Drive, Meet, and Google admin, Workspace can be the correct spend. Flap is for the launch loop where email is the requirement.",
      },
    ],
    table: {
      caption: "Illustrative monthly cost (1 user per domain, $7 Workspace list)",
      headers: ["Domains", "Workspace (illus.)", "Flap plan (typical)"],
      rows: [
        ["1", "$7", "Free or Solo"],
        ["3", "$21", "Solo $9"],
        ["5", "$35", "Builder $19"],
        ["8", "$56", "Builder $19"],
        ["10", "$70", "Builder $19"],
        ["20", "$140", "Studio $39"],
      ],
    },
    faqs: [
      {
        q: "Where is the interactive calculator?",
        a: "https://useflap.online/tools/google-workspace-cost-calculator — adjust domains and users per domain.",
      },
      {
        q: "Are these official Google prices?",
        a: "No — Flap uses a published illustrative list figure for education. Confirm current Google pricing for your region.",
      },
    ],
    related: [
      { href: "/tools/google-workspace-cost-calculator", label: "Open cost calculator" },
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/#pricing", label: "Flap pricing" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
    ],
  },
  {
    slug: "mx-spf-dmarc-setup-checklist",
    path: "/blog/mx-spf-dmarc-setup-checklist",
    title: "MX, SPF, and DMARC setup checklist | Flap Blog",
    description:
      "A founder-friendly checklist for MX, SPF, DKIM, and DMARC when setting up custom-domain email — including Flap via Cloudflare Email Routing.",
    h1: "MX / SPF / DMARC setup checklist for custom-domain email",
    definition:
      "MX routes inbound mail; SPF lists allowed senders; DKIM signs messages; DMARC tells receivers how to handle failures. Flap’s inbound path uses Cloudflare Email Routing MX/SPF/DKIM values plus a Worker rule into your Flap inbox.",
    lede: "DNS mistakes cause most “email doesn’t work” tickets. Use this checklist before you blame the mail product.",
    published: UPDATED,
    updated: UPDATED,
    tags: ["DNS", "MX", "SPF", "DMARC", "deliverability"],
    sections: [
      {
        heading: "Before you edit DNS",
        body: "Know which host is authoritative (nameservers). Editing the registrar while NS point at Cloudflare/Vercel/Route 53 does nothing useful.",
        bullets: [
          "Confirm nameservers",
          "Remove conflicting MX from old hosts",
          "Plan one SPF TXT (merge includes — do not create two SPF records)",
        ],
      },
      {
        heading: "MX checklist",
        body: "Publish exactly the MX hosts and priorities your mail product shows. For Flap, that is Cloudflare Email Routing (route1/2/3.mx.cloudflare.net). Never proxy MX on Cloudflare (grey cloud only).",
      },
      {
        heading: "SPF checklist",
        body: "One TXT starting with v=spf1. Include every sender you use. For Flap inbound via Cloudflare Routing, include include:_spf.mx.cloudflare.net. End with ~all or -all once you know the set is complete.",
      },
      {
        heading: "DKIM checklist",
        body: "Publish the selector TXT your provider gives you. For Flap’s Cloudflare path, copy DKIM from Cloudflare Email Routing settings — Flap does not invent those keys.",
      },
      {
        heading: "DMARC checklist",
        body: "Start with _dmarc TXT: v=DMARC1; p=none; rua=mailto:you@yourdomain.com to monitor. Move to quarantine/reject only after reports look clean.",
      },
      {
        heading: "Flap-specific finish line",
        body: "MX + SPF alone are not enough: create the Cloudflare Email Routing rule that sends to the Flap Worker, create the mailbox in Flap, then Check DNS and send an external test.",
      },
    ],
    faqs: [
      {
        q: "Which free tools help?",
        a: "Flap provides /tools/mx-checker, /tools/spf-checker, /tools/dmarc-checker, /tools/dkim-checker, and /tools/email-setup-checker.",
      },
      {
        q: "How long does DNS take?",
        a: "Seconds to 48 hours depending on TTL and caches. Re-check rather than thrashing records every minute.",
      },
    ],
    related: [
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/blog/catchall-aliases-indie-founders", label: "Catch-all & aliases" },
    ],
  },
  {
    slug: "self-host-vs-hosted-email-startups",
    path: "/blog/self-host-vs-hosted-email-startups",
    title: "Self-host vs hosted email for startups | Flap Blog",
    description:
      "Self-hosted mail vs hosted inbox for early startups and indie hackers — deliverability, ops cost, and when Flap’s hosted multi-domain inbox fits.",
    h1: "Self-host vs hosted email for startups",
    definition:
      "Self-hosted email means you run MTA/IMAP yourself; hosted email means a vendor operates the mailbox. Most early startups choose hosted for deliverability and ops. Flap is hosted custom-domain email aimed at multi-domain founders.",
    lede: "Running your own mail server feels empowering until the first deliverability weekend. Here is a sober comparison for people who should be building product instead.",
    published: UPDATED,
    updated: UPDATED,
    tags: ["self-host", "hosted email", "startups"],
    sections: [
      {
        heading: "What self-hosting really costs",
        body: "VPS fees are cheap. Reputation, PTR records, blocklists, spam filtering, storage backups, and “why is Gmail rejecting us” support are not. Self-host if email ops is a core skill you want.",
      },
      {
        heading: "What hosted buys you",
        body: "Someone else runs the pipeline. You still own DNS and brand addresses. Time goes to customers, not Postfix configs.",
      },
      {
        heading: "Where Flap sits",
        body: "Flap is hosted inbox for founders with many domains — not a self-host control panel, not a full Google suite. Inbound uses Cloudflare Email Routing; you manage domains and identities in one product.",
      },
      {
        heading: "Decision rule",
        body: "Choose self-host for learning or extreme control requirements. Choose Workspace/Zoho-class suites for org collaboration. Choose Flap when the pain is multi-domain founder mail without suite or server ops.",
      },
    ],
    table: {
      caption: "Quick comparison",
      headers: ["", "Self-host", "Suite (e.g. Workspace)", "Flap"],
      rows: [
        ["Ops burden", "High", "Low", "Low"],
        ["Multi-domain indie fit", "DIY", "Heavy per brand", "Core wedge"],
        ["Collaboration apps", "DIY", "Strong", "None"],
        ["Best for", "Experts / tinkerers", "Teams in suite", "Serial launchers"],
      ],
    },
    faqs: [
      {
        q: "Can I migrate from self-host to Flap?",
        a: "Point MX to Cloudflare Email Routing as Flap documents, create addresses, and import old mail manually if needed (no automatic importer yet).",
      },
    ],
    related: [
      { href: "/email-for-indie-hackers", label: "Email for indie hackers" },
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/flap-vs-zoho", label: "Flap vs Zoho" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
  {
    slug: "catchall-aliases-indie-founders",
    path: "/blog/catchall-aliases-indie-founders",
    title: "Catch-all and aliases for indie founders | Flap Blog",
    description:
      "How catch-all and aliases help indie founders run many project domains — without mailbox sprawl. What Flap supports on Free vs paid plans.",
    h1: "Catch-all and aliases for indie founders",
    definition:
      "An alias is an extra address that delivers to a mailbox you already have. Catch-all accepts any local-part on a domain. Flap supports aliases on all plans (with Free limits) and catch-all on paid plans, which helps founders absorb launch@ and typo traffic without endless mailbox creation.",
    lede: "You do not need a new mailbox for every campaign string. Aliases and catch-all keep the inbox tidy while domains multiply.",
    published: UPDATED,
    updated: UPDATED,
    tags: ["aliases", "catch-all", "indie hackers"],
    sections: [
      {
        heading: "Aliases: intentional extra doors",
        body: "Create press@, billing@, or noreply-style addresses that land in the same mailbox. Useful when you want a clear From/To story without another account.",
      },
      {
        heading: "Catch-all: accept the unexpected",
        body: "Catch-all delivers anything@yourdomain to a mailbox. Great for mistyped addresses and improvised launch strings. Pair with filters so noise does not bury real customers. On Flap, catch-all is a paid-plan feature.",
      },
      {
        heading: "DNS and routing still matter",
        body: "Catch-all in the product only works if Cloudflare Email Routing (for Flap) also has a matching catch-all or wildcard rule sending to the Flap Worker. Product toggle ≠ DNS magic.",
      },
      {
        heading: "Hygiene tips",
        body: "Prefer explicit aliases for long-lived roles. Use catch-all during launches. Disable catch-all if spam volume spikes. Rotate disposable aliases when an address leaks onto lists.",
      },
    ],
    faqs: [
      {
        q: "Does Free include catch-all?",
        a: "No — catch-all is on paid Flap plans. Free still includes a limited number of aliases.",
      },
      {
        q: "Is catch-all bad for deliverability?",
        a: "Catch-all affects inbound acceptance, not your outbound reputation directly. High inbound spam is an ops nuisance; use filters and disable if needed.",
      },
    ],
    related: [
      { href: "/email-for-side-projects", label: "Email for side projects" },
      { href: "/email-hosting-for-multiple-domains", label: "Multi-domain hosting" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

export function getBlogPostByPath(path: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.path === path) ?? null;
}
