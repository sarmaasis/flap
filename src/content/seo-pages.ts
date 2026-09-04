import { PLANS } from "../../shared/plans";
import { MARKETING } from "./marketing";

export type SeoSection = {
  heading: string;
  body: string;
  /** Optional H3 bullets under the section */
  bullets?: string[];
};

export type SeoPageDef = {
  path: string;
  title: string;
  description: string;
  h1: string;
  /** Direct answer near top — LLMs and featured snippets can cite this. */
  definition: string;
  lede: string;
  updated: string;
  sections: SeoSection[];
  table?: { caption: string; headers: string[]; rows: string[][] };
  faqs: Array<{ q: string; a: string }>;
  related: Array<{ href: string; label: string }>;
  comparison?: boolean;
};

const UPDATED = "2026-09-04";

export const SEO_PAGE_DEFS: Record<string, SeoPageDef> = {
  "/google-workspace-alternative": {
    path: "/google-workspace-alternative",
    title: "Google Workspace alternative for multi-domain founders | Flap",
    description:
      "Flap is a Google Workspace alternative for founders who need custom-domain email on many projects — one inbox, domain-first pricing, no suite per launch.",
    h1: "Google Workspace alternative for multi-domain founders",
    definition:
      "Flap (useflap.online) is a hosted custom-domain email product for indie hackers and serial founders: connect multiple project domains to one inbox instead of provisioning a separate Google Workspace (or similar) for each startup.",
    lede: "If you keep launching products, a full Workspace account per domain is expensive and heavy. Flap is built for the narrower job: professional email on every domain you own, from one place.",
    updated: UPDATED,
    sections: [
      {
        heading: "What “Workspace alternative” means here",
        body: "Google Workspace is a productivity suite (Gmail + Docs + Drive + Meet + Calendar). Flap is not that suite. Flap replaces the email-hosting part when your pain is “another domain needs hello@” — not when your team lives in Docs all day.",
        bullets: [
          "Replace: per-project mailbox / Workspace-for-email cost",
          "Do not replace: Docs, Drive, Meet, or org-wide Google admin",
        ],
      },
      {
        heading: "When Workspace is the wrong unit of cost",
        body: "Workspace shines for companies that need shared drives and calendars. It is a poor fit when you just need you@project.com on the fifth side project this year. Flap prices primarily by how many domains you connect (Solo 3, Builder 10, Studio 40), not by standing up a new suite environment per brand.",
      },
      {
        heading: "What you get with Flap",
        body: `Connect domains, create addresses, send and receive from one inbox. Free trial: ${PLANS.free.limits.domains} domain, ${PLANS.free.limits.send_per_month} sends/month. Paid plans add catch-all, higher limits, and (on Studio) team seats. Outbound uses your authenticated domain identities.`,
      },
      {
        heading: "Honest tradeoffs",
        body: "Choose Google Workspace when collaboration apps matter more than multi-domain mail. Choose Flap when the pain is another mailbox setup per launch. Flap receives mail via Cloudflare Email Routing and guided DNS — you still manage records at your DNS host.",
      },
      {
        heading: "How founders switch",
        body: "Add the domain in Flap, paste MX/SPF (and DKIM) at your DNS provider, finish the Cloudflare Email Routing Worker rule, then create hello@ and send a test. Use the free DNS checkers on Flap if you want a sanity check before cutover.",
      },
    ],
    table: {
      caption: "Flap vs Google Workspace for multi-project email",
      headers: ["Dimension", "Google Workspace", "Flap"],
      rows: [
        ["Primary job", "Suite + org email", "Multi-domain founder inbox"],
        ["Cost driver", "Seats × environments", "Domain count on plan"],
        ["Many side projects", "Heavy per brand", "Add domain to same account"],
        ["Unified inbox across brands", "Usually separate orgs", "Designed for one inbox"],
        ["Docs / Meet / Drive", "Yes", "No — email only"],
        ["Best for", "Teams in Google apps", "Serial launchers"],
      ],
    },
    faqs: [
      {
        q: "Can Flap replace Google Workspace entirely?",
        a: "For email on multiple founder domains, often yes. For Docs, Drive, and Meet — no. Use the right tool for each job.",
      },
      {
        q: "How does Flap pricing compare to Workspace?",
        a: `Workspace list pricing scales by seats (illustrative ~$7/user/domain if you provision separately). Flap Solo is $${PLANS.solo.price_monthly}/mo for ${PLANS.solo.limits.domains} domains, Builder $${PLANS.builder.price_monthly} for ${PLANS.builder.limits.domains}, Studio $${PLANS.studio.price_monthly} for ${PLANS.studio.limits.domains}. Use the cost calculator for your numbers.`,
      },
      {
        q: "Do I keep my Google account for personal mail?",
        a: "Yes. Flap is for project domains. Many founders keep personal Gmail and put only startup domains on Flap.",
      },
      {
        q: "Is migration automatic?",
        a: "Point DNS and create matching addresses in Flap. There is no automatic mailbox history importer — export older mail separately if you need it.",
      },
    ],
    related: [
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace (full comparison)" },
      { href: "/tools/google-workspace-cost-calculator", label: "Google Workspace cost calculator" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/blog/cost-of-google-workspace-multiple-domains", label: "Blog: Workspace cost across domains" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },

  "/email-hosting-for-multiple-domains": {
    path: "/email-hosting-for-multiple-domains",
    title: "Email hosting for multiple domains | Flap",
    description:
      "Host email for many domains in one inbox with Flap. Domain-first plans for indie hackers and studios juggling side projects.",
    h1: "Email hosting for multiple domains — one inbox",
    definition:
      "Multi-domain email hosting means one mail product accepts and sends mail for several custom domains. Flap (useflap.online) provides that as a single inbox with per-domain sender identities, aimed at founders who run many projects.",
    lede: "Add every project domain to Flap. Read and reply as each brand without separate hosting accounts or a Workspace per launch.",
    updated: UPDATED,
    sections: [
      {
        heading: "Domain-first, not seat-first",
        body: "Plans are built around how many domains you connect. That matches how founders actually accumulate projects — domains grow faster than headcount.",
        bullets: [
          `Free: ${PLANS.free.limits.domains} domain`,
          `Solo: ${PLANS.solo.limits.domains} · Builder: ${PLANS.builder.limits.domains} · Studio: ${PLANS.studio.limits.domains}`,
          "Referral bonuses can add permanent domain slots",
        ],
      },
      {
        heading: "One inbox, many identities",
        body: "Mail for a.com and b.com lands in the same Flap inbox. You reply as the correct address without switching products or logging into forgotten forwards.",
      },
      {
        heading: "DNS you can finish",
        body: "Copy MX and SPF from Flap, add DKIM from Cloudflare Email Routing, then use Check DNS or the free MX/SPF tools. Precise errors (“SPF missing Cloudflare include”) beat a vague “verification failed.”",
      },
      {
        heading: "Catch-all when you need it",
        body: "On paid plans, accept mail to any local-part on a domain, then quiet noise with filters. Useful for launch@, press@, and typo traffic without creating every mailbox first.",
      },
    ],
    table: {
      caption: "What multi-domain hosting on Flap includes",
      headers: ["Capability", "Notes"],
      rows: [
        ["Receive on custom domains", "Via Cloudflare Email Routing → Flap Worker"],
        ["Send as domain identities", "Authenticated outbound from Flap"],
        ["Aliases / disposables", "Limits by plan; unlimited aliases on paid"],
        ["Catch-all", "Paid plans"],
        ["Team seats", "Studio up to 10"],
        ["Shared inboxes", "Studio (e.g. support@, hello@)"],
      ],
    },
    faqs: [
      {
        q: "Do I need Cloudflare already?",
        a: "Flap receives mail via Cloudflare Email Routing. Your DNS can live at Namecheap, Porkbun, Route 53, Vercel, etc. — you still add the Cloudflare MX/SPF values Flap shows and finish the Worker routing rule.",
      },
      {
        q: "Is this the same as email forwarding?",
        a: "No. Forwarding dumps brand mail into Gmail. Flap is a hosted inbox: receive, reply, schedule, and archive as your domain.",
      },
      {
        q: "How many domains can I host?",
        a: `Up to your plan limit (${PLANS.solo.limits.domains} / ${PLANS.builder.limits.domains} / ${PLANS.studio.limits.domains} on Solo / Builder / Studio), plus any referral domain bonuses.`,
      },
    ],
    related: [
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare setup guide" },
      { href: "/blog/catchall-aliases-indie-founders", label: "Blog: catch-all & aliases" },
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
    ],
  },

  "/custom-domain-email": {
    path: "/custom-domain-email",
    title: "Custom domain email without Workspace | Flap",
    description:
      "Get you@yourdomain.com with a real Flap inbox — aliases, send, and DNS guidance. Custom domain email without a Google Workspace per project.",
    h1: "Custom domain email that is actually an inbox",
    definition:
      "Custom domain email means sending and receiving mail as addresses on a domain you own (e.g. you@startup.com). Flap hosts that inbox for founders, with multi-domain support at useflap.online.",
    lede: "Forwarding dumps brand mail into Gmail. Flap is the mailbox: receive, reply, schedule, and archive as your domain — without standing up Workspace for every launch.",
    updated: UPDATED,
    sections: [
      {
        heading: "Inbox vs forwarder",
        body: "A forwarder only redirects mail. Customers still see uneven reply-from behavior, and you lose a clean brand mailbox. Flap stores mail, lets you send as the domain, and keeps every project identity in one product.",
      },
      {
        heading: "Start free, then scale domains",
        body: `Prove MX on one domain (${PLANS.free.limits.domains} domain, ${PLANS.free.limits.send_per_month} sends/mo, ${PLANS.free.limits.mailboxes} mailboxes). Upgrade to Solo, Builder, or Studio when projects multiply.`,
      },
      {
        heading: "Send as the brand",
        body: "Outbound uses your authenticated domain identities — not a personal Gmail rewrite. SPF/DKIM alignment follows the DNS you configure for Cloudflare Email Routing and Flap.",
      },
      {
        heading: "Setup path",
        body: "Add domain → create hello@ → paste MX/SPF/DKIM → Cloudflare Worker routing rule → Check DNS → send a test. Provider-specific guides cover Cloudflare, Namecheap, Porkbun, GoDaddy, Squarespace, Route 53, and Vercel DNS.",
      },
    ],
    faqs: [
      {
        q: "How long does setup take?",
        a: "Usually minutes once DNS propagates. Propagation itself can take longer depending on your DNS host and TTL.",
      },
      {
        q: "Can I use an existing domain?",
        a: "Yes. Keep the site where it is; only mail-related MX/TXT records need to match Flap’s Cloudflare Email Routing values (and remove conflicting MX).",
      },
      {
        q: "Does Flap support aliases?",
        a: `Yes. Free includes ${PLANS.free.limits.aliases} aliases; paid plans offer unlimited aliases within product limits. Catch-all is on paid plans.`,
      },
    ],
    related: [
      { href: "/email-for-indie-hackers", label: "Email for indie hackers" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
      { href: "/blog/custom-domain-email-without-google-workspace", label: "Blog: without Google Workspace" },
      { href: "/tools/email-setup-checker", label: "Setup checker" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare guide" },
    ],
  },

  "/email-for-indie-hackers": {
    path: "/email-for-indie-hackers",
    title: "Email for indie hackers | Flap",
    description:
      "Professional email for every side project domain. Flap gives indie hackers one inbox across launches — no per-project Workspace tax.",
    h1: "Email for indie hackers who keep shipping",
    definition:
      "Email for indie hackers is professional custom-domain mail sized for solo builders with many domains. Flap positions as “email infrastructure for people who keep launching things” — one inbox at useflap.online across project brands.",
    lede: MARKETING.founder_tagline,
    updated: UPDATED,
    sections: [
      {
        heading: "Ship the domain, not the admin work",
        body: "You already bought the domain. Flap is the shortest path to hello@ without a productivity-suite trial, seat procurement, or a forgotten forward into personal Gmail.",
      },
      {
        heading: "Built for people who keep launching things",
        body: "Stop creating a new mailbox setup for every side project. Use professional email on every domain you own. Manage startup identities from one place. Launch a new domain without adding another email subscription.",
      },
      {
        heading: "Referral bonus",
        body: "Invite a founder with your link — both accounts get +1 domain permanently after the referred user signs up, verifies email, and connects a domain.",
      },
      {
        heading: "What Flap is not",
        body: "Not enterprise procurement theater. Not a Docs suite. Not “cheap Gmail clones for generic business.” The wedge is multi-domain founder inbox.",
      },
    ],
    faqs: [
      {
        q: "Is Flap only for solo builders?",
        a: "Solo and Builder are solo-seat. Studio adds up to 10 team seats and shared inboxes when you grow past one person.",
      },
      {
        q: "Can I keep personal Gmail?",
        a: "Yes. Put project domains on Flap; keep personal mail wherever you already live.",
      },
      {
        q: "What DNS hosts are documented?",
        a: "Guides for Cloudflare, Namecheap, Porkbun, GoDaddy, Squarespace Domains, Amazon Route 53, and Vercel DNS.",
      },
    ],
    related: [
      { href: "/email-for-side-projects", label: "Email for side projects" },
      { href: "/blog/self-host-vs-hosted-email-startups", label: "Blog: self-host vs hosted" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
    ],
  },

  "/email-for-side-projects": {
    path: "/email-for-side-projects",
    title: "Email for side projects | Flap",
    description:
      "Launch another domain without another email subscription. Flap is one inbox for all your side projects’ custom-domain email.",
    h1: "Email for every side project — without another subscription",
    definition:
      "Side-project email means a professional address on each experiment domain without paying for a full workspace per idea. Flap hosts those domains in one inbox so subscriptions do not multiply with launches.",
    lede: "Side projects multiply. Email subscriptions should not.",
    updated: UPDATED,
    sections: [
      {
        heading: "One place to reply",
        body: "All project identities land in Flap so you do not miss a customer because mail is stuck in a forgotten forward or a dormant Workspace trial.",
      },
      {
        heading: "Disposable aliases",
        body: "Spin up launch@, press@, or beta@ without new accounts. Catch-all on paid plans catches the rest.",
      },
      {
        heading: "Park or kill a project cleanly",
        body: "Remove the domain when you are done. You are not stuck paying a suite seat for a parked idea.",
      },
      {
        heading: "Estimate the Workspace tax",
        body: "If you would otherwise buy Workspace per domain, use Flap’s Google Workspace cost calculator to see monthly and annual savings for your project count.",
      },
    ],
    faqs: [
      {
        q: "What if a project dies?",
        a: "Remove the domain from Flap when you are done. Paid plans are domain-count based, so fewer live projects can mean a smaller plan.",
      },
      {
        q: "Can multiple side projects share one free plan?",
        a: `Free includes ${PLANS.free.limits.domains} domain. Add Solo or Builder when you need more domains on the same inbox.`,
      },
      {
        q: "Is forwarding enough for side projects?",
        a: "Forwarding is fine for low-stakes mail. When you need to send as the brand, keep threads, and avoid reply-from chaos, a real inbox (Flap) fits better.",
      },
    ],
    related: [
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
      { href: "/blog/catchall-aliases-indie-founders", label: "Blog: catch-all & aliases" },
      { href: "/email-for-indie-hackers", label: "Email for indie hackers" },
    ],
  },

  "/flap-vs-google-workspace": {
    path: "/flap-vs-google-workspace",
    title: "Flap vs Google Workspace for multi-project founders",
    description:
      "Compare Flap and Google Workspace for founders with several small products: cost scaling, unified inbox, setup, and best use case. Honest tradeoffs.",
    h1: "Flap vs Google Workspace",
    definition:
      "Flap vs Google Workspace is a use-case comparison: for a founder managing several small project domains, Flap may be simpler because one inbox covers many domains, while Workspace is stronger when you need Google’s full productivity suite and org tools.",
    lede: "For a founder managing several small projects, Flap may be simpler because you keep one inbox across domains instead of provisioning a Workspace (or seat) per brand. That is not a claim of universal superiority.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Multiple domains / projects",
        body: "Workspace: typically separate customers or complex multi-domain admin when each brand is its own environment. Flap: add domains to one account up to your plan limit (Solo 3, Builder 10, Studio 40).",
      },
      {
        heading: "Number of separate accounts / admin setups",
        body: "Each Workspace environment has its own admin surface. Flap keeps DNS guidance and mailboxes under one founder account so the Nth domain is “add domain,” not “new suite.”",
      },
      {
        heading: "Cost scaling",
        body: "Workspace cost rises with seats × how many environments you stand up. Flap Solo/Builder/Studio rise mainly with domain count. Illustrative Workspace Business Starter list price used in Flap’s calculator: $7/user/month per domain you provision separately.",
      },
      {
        heading: "Unified inbox & identities",
        body: "Flap is designed as one inbox for many identities. Workspace inboxes are usually per user inside one organization — cross-brand unification is not the default path for indie multi-product setups.",
      },
      {
        heading: "Setup complexity",
        body: "Both need DNS. Flap’s path is MX/SPF/DKIM plus Cloudflare Email Routing Worker delivery, with provider guides and DNS checkers. Workspace has mature admin UX and a broader suite to configure.",
      },
      {
        heading: "Best use case",
        body: "Pick Workspace when you need Docs, Drive, Meet, and Google admin. Pick Flap when the job is multi-domain founder email without suite overhead.",
      },
    ],
    table: {
      caption: "Side-by-side for multi-project founders",
      headers: ["Dimension", "Google Workspace", "Flap"],
      rows: [
        ["Multiple domains/projects", "Often separate setups", "One account, many domains"],
        ["Admin setups", "Per environment", "Single founder account"],
        ["Cost scaling", "Seats × environments", "Primarily domain tiers"],
        ["Unified inbox", "Per-org users", "One inbox, many identities"],
        ["Multiple identities", "Aliases in an org", "Addresses across domains"],
        ["Setup", "Suite + DNS", "DNS + Cloudflare routing"],
        ["Best use case", "Teams in Google apps", "Serial / multi-domain founders"],
      ],
    },
    faqs: [
      {
        q: "Is Flap “better” than Google Workspace?",
        a: "Not universally. It is a better fit for multi-project email without suite overhead — not a claim of general superiority.",
      },
      {
        q: "Can I use both?",
        a: "Yes. Some founders keep company Workspace for the main company and put experimental domains on Flap.",
      },
      {
        q: "Where can I estimate savings?",
        a: "Use /tools/google-workspace-cost-calculator. Estimates are illustrative and may vary by region, taxes, and plan.",
      },
    ],
    related: [
      { href: "/flap-vs-zoho", label: "Flap vs Zoho Mail" },
      { href: "/google-workspace-alternative", label: "Workspace alternative landing" },
      { href: "/tools/google-workspace-cost-calculator", label: "Savings calculator" },
      { href: "/blog/cost-of-google-workspace-multiple-domains", label: "Blog: multi-domain Workspace cost" },
    ],
  },

  "/flap-vs-zoho": {
    path: "/flap-vs-zoho",
    title: "Flap vs Zoho Mail for multi-domain founders",
    description:
      "Compare Flap and Zoho Mail for founders juggling many domains: workflow simplicity, unified inbox, and honest best-use-case guidance.",
    h1: "Flap vs Zoho Mail",
    definition:
      "Flap vs Zoho Mail compares two hosted email options. Zoho Mail is a capable full mail product; Flap focuses on a simpler multi-project workflow — one inbox, many domain identities, domain-first plans at useflap.online.",
    lede: "Zoho Mail is a capable hosted mail product. For founders juggling many small domains, Flap focuses on workflow simplicity: one inbox, many identities, domain-first plans — without pretending Zoho is “too expensive.”",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Workflow simplicity for many projects",
        body: "If your pain is “another domain, another mail setup,” Flap optimizes that loop. Zoho may be preferable if you already live in Zoho’s wider suite (CRM, books, office apps) and want mail inside that ecosystem.",
      },
      {
        heading: "Cost framing",
        body: "We do not claim Zoho is expensive. The comparison is about setup overhead and unified multi-domain management for serial launchers — not a price war.",
      },
      {
        heading: "Unified management",
        body: "Flap keeps every startup domain under one founder-oriented inbox. Zoho’s multi-domain capabilities exist; evaluate whether its admin model matches how you launch small brands.",
      },
      {
        heading: "Best use case",
        body: "Choose Flap for indie multi-domain inboxes without suite lock-in. Choose Zoho when you want Zoho’s ecosystem and organization features.",
      },
    ],
    table: {
      caption: "Flap vs Zoho Mail — founder lens",
      headers: ["Dimension", "Zoho Mail", "Flap"],
      rows: [
        ["Product focus", "Hosted mail (+ Zoho suite)", "Multi-domain founder inbox"],
        ["Multi-project workflow", "Capable; org-oriented", "Optimized for serial launches"],
        ["Pricing narrative", "Varies by Zoho plan", "Domain-first Solo/Builder/Studio"],
        ["Suite ecosystem", "Strong Zoho stack", "Email-only; no CRM suite"],
        ["Best for", "Zoho-centric teams", "Indie / studio multi-domain mail"],
      ],
    },
    faqs: [
      {
        q: "Does Flap migrate from Zoho?",
        a: "You can point DNS and create matching addresses. There is no automatic mailbox importer yet — export/import is manual.",
      },
      {
        q: "Is Flap cheaper than Zoho?",
        a: "It depends on seats, domains, and which Zoho plan you compare. Flap’s wedge is multi-domain simplicity, not a blanket “cheaper than Zoho” claim.",
      },
      {
        q: "Who should stay on Zoho?",
        a: "Teams that rely on Zoho CRM, Books, or Workplace and want mail tightly integrated there.",
      },
    ],
    related: [
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/email-hosting-for-multiple-domains", label: "Multi-domain hosting" },
      { href: "/#pricing", label: "Flap pricing" },
      { href: "/blog/custom-domain-email-without-google-workspace", label: "Blog: custom domain without Workspace" },
    ],
  },

  "/multiple-domains-one-inbox": {
    path: "/multiple-domains-one-inbox",
    title: "Multiple domains, one inbox | Flap",
    description:
      "Connect every startup domain to a single Flap inbox. Send and receive as each brand identity — one inbox for every startup you build.",
    h1: "Multiple domains. One inbox.",
    definition:
      "“Multiple domains, one inbox” means several custom domains deliver into a single mail product where you can send as each brand. Flap implements that for founders at useflap.online under the tagline “One inbox for every startup you build.”",
    lede: MARKETING.primary_tagline,
    updated: UPDATED,
    sections: [
      {
        heading: "Why this matters",
        body: "Serial founders lose context when each project has a different mailbox. Flap keeps every brand thread in one place so support and sales replies do not scatter across forwards and forgotten trials.",
      },
      {
        heading: "Sender identities",
        body: "Reply as hello@a.com or founders@b.com without switching products. Addresses and aliases stay attached to the domains you connected.",
      },
      {
        heading: "How it works (short)",
        body: "Connect domains → point MX/SPF/DKIM → Cloudflare Email Routing delivers to Flap → create addresses → send and receive. Upgrade when domain count exceeds your plan.",
      },
      {
        heading: "Plan limits (domains)",
        body: `Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Builder ${PLANS.builder.limits.domains} · Studio ${PLANS.studio.limits.domains} (plus referral bonuses when earned).`,
      },
    ],
    table: {
      caption: "From scattered setups to one inbox",
      headers: ["Before", "With Flap"],
      rows: [
        ["project1.com → Workspace", "project1.com → Flap"],
        ["project2.com → Workspace", "project2.com → Flap"],
        ["project3.com → Zoho / forward", "project3.com → Flap"],
        ["Many logins", "One inbox"],
      ],
    },
    faqs: [
      {
        q: "What are the domain limits?",
        a: `Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Builder ${PLANS.builder.limits.domains} · Studio ${PLANS.studio.limits.domains} domains (plus referral bonuses).`,
      },
      {
        q: "Do all domains share storage and send quotas?",
        a: "Yes — quotas are per Flap account/plan (storage and monthly sends), not per domain silo.",
      },
      {
        q: "Can a studio share the inbox?",
        a: "Studio includes team seats and shared inboxes (e.g. support@, hello@). Solo and Builder are single-seat.",
      },
    ],
    related: [
      { href: "/#pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
      { href: "/email-hosting-for-multiple-domains", label: "Email hosting for multiple domains" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "Blog: MX/SPF/DMARC checklist" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
    ],
  },
};

export function getSeoPage(path: string): SeoPageDef | null {
  return SEO_PAGE_DEFS[path] ?? null;
}

export const SEO_PATHS = Object.keys(SEO_PAGE_DEFS);
