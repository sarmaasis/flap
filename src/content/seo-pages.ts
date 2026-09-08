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
  /** Direct answer near top - LLMs and featured snippets can cite this. */
  definition: string;
  lede: string;
  updated: string;
  sections: SeoSection[];
  table?: { caption: string; headers: string[]; rows: string[][] };
  faqs: Array<{ q: string; a: string }>;
  related: Array<{ href: string; label: string }>;
  comparison?: boolean;
  /** Distinct search intent - used to prevent cannibalization. */
  primaryIntent?: string;
};

const UPDATED = "2026-09-09";

export const SEO_PAGE_DEFS: Record<string, SeoPageDef> = {
  "/email-for-multiple-domains": {
    path: "/email-for-multiple-domains",
    primaryIntent: "Commercial: get professional email that covers many domains I already own",
    title: "Email for multiple domains — one inbox | Flap",
    description:
      "Run professional email across every domain you own from one Flap inbox. Receive centrally, reply from the correct address, skip a Workspace per project.",
    h1: "Email for multiple domains — without a suite per brand",
    definition:
      "Email for multiple domains means sending and receiving as addresses on several custom domains you own, ideally from one product. Flap (useflap.online) is built for that: connect domains to one inbox and reply as the brand that received the mail.",
    lede: "You already bought the domains. The hard part is not “does email exist?” — it is running hello@ and support@ across brands without another Google Workspace (or similar) setup each time. Flap is the commercial answer to that search.",
    updated: UPDATED,
    sections: [
      {
        heading: "What this search usually means",
        body: "People searching “email for multiple domains” are rarely hunting a generic productivity suite. They need branded addresses on domain A, B, and C — often as a solo founder, studio, or agency — and they want one operational home instead of N admin consoles.",
        bullets: [
          "Receive mail for every connected domain in one place",
          "Reply as the address (and domain) that received the thread",
          "Add the next launch without buying another suite seat stack",
        ],
      },
      {
        heading: "Why separate Workspace accounts break down",
        body: "Google Workspace is excellent when one company lives in Docs, Drive, and Meet. It is awkward when each side project is its own brand: you either pay for another environment, lean on domain aliases that do not match how you launch, or forward everything into personal Gmail and lose clean reply-from behavior.",
      },
      {
        heading: "How Flap maps to the job",
        body: `Add domains to one Flap account (Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Pro ${PLANS.pro.limits.domains} · Team ${PLANS.team.limits.domains}), publish MX/SPF/DKIM for Amazon SES, create addresses, and work from a single inbox. Outbound uses your authenticated domain identities — not a personal rewrite.`,
      },
      {
        heading: "Inbox vs forwarding vs “hosting”",
        body: "Forwarding (Cloudflare Email Routing, ImprovMX-style tools) is fine when you only need redirects. Multi-domain “hosting” answers “who accepts MX.” This page is about the buying intent: professional email across domains with a real place to read and reply. See also Flap’s hosting and one-inbox pages if those angles match better.",
      },
      {
        heading: "Honest fit check",
        body: "Choose Flap when multi-domain founder email is the job. Stay on Workspace/Microsoft 365 when collaboration apps matter more than domain count. Flap is not Docs, Drive, or Meet — and IMAP/SMTP client access is not available yet (use the web app and PWA).",
      },
    ],
    table: {
      caption: "Common approaches to multi-domain email",
      headers: ["Approach", "Works when", "Breaks when"],
      rows: [
        ["Workspace per brand", "One company, suite needed", "Many launches, seat × brand tax"],
        ["Forwarders only", "Low-stakes intake", "You must send as the brand"],
        ["Aliases in one org", "Single company, many names", "Separate products / clients"],
        ["Flap multi-domain inbox", "Many domains, one operator", "You need a full office suite"],
      ],
    },
    faqs: [
      {
        q: "How many domains can I put on Flap?",
        a: `Up to your plan limit (Free ${PLANS.free.limits.domains}, Solo ${PLANS.solo.limits.domains}, Pro ${PLANS.pro.limits.domains}, Team ${PLANS.team.limits.domains}), plus referral domain bonuses when earned.`,
      },
      {
        q: "Do replies keep the right From address?",
        a: "Flap is designed so you reply using the domain identity that received the message — the core multi-domain workflow, not an afterthought.",
      },
      {
        q: "Is this the same as email hosting for multiple domains?",
        a: "Related but different search intent. Hosting answers MX/provider choice; this page answers the commercial “email for multiple domains” problem. See /email-hosting-for-multiple-domains for the hosting angle.",
      },
      {
        q: "Where do I start?",
        a: "Sign up free, add a domain, publish the SES DNS Flap shows, create hello@, and send a test. Upgrade when domain count needs it.",
      },
    ],
    related: [
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/email-hosting-for-multiple-domains", label: "Email hosting for multiple domains" },
      { href: "/how-to-manage-email-for-multiple-domains", label: "How to manage email for multiple domains" },
      { href: "/how-to-send-email-from-multiple-domains", label: "How to send from multiple domains" },
      { href: "/email-for-multiple-saas-products", label: "Email for multiple SaaS products" },
      { href: "/email-for-founders", label: "Email for founders" },
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/pricing", label: "Pricing" },
    ],
  },

  "/google-workspace-alternative": {
    path: "/google-workspace-alternative",
    primaryIntent: "Find alternatives to the Workspace email model (not a full suite replacement)",
    title: "Google Workspace alternative for multi-domain founders | Flap",
    description:
      "Flap is a Google Workspace alternative for founders who need custom-domain email on many projects - one inbox, domain-first pricing, no suite per launch.",
    h1: "Google Workspace alternative for multi-domain founders",
    definition:
      "Flap (useflap.online) is a hosted custom-domain email product for indie hackers and serial founders: connect multiple project domains to one inbox instead of provisioning a separate Google Workspace (or similar) for each startup.",
    lede: "Looking for a Google Workspace alternative for email on many project domains? Flap replaces the mailbox-and-suite-per-launch pattern - not Docs, Drive, or Meet.",
    updated: UPDATED,
    sections: [
      {
        heading: "What “Workspace alternative” means here",
        body: "Google Workspace is a productivity suite (Gmail + Docs + Drive + Meet + Calendar). Flap is not that suite. Flap replaces the email-hosting part when your pain is “another domain needs hello@” - not when your team lives in Docs all day.",
        bullets: [
          "Replace: per-project mailbox / Workspace-for-email cost",
          "Do not replace: Docs, Drive, Meet, or org-wide Google admin",
        ],
      },
      {
        heading: "When Workspace is the wrong unit of cost",
        body: `Workspace shines for companies that need shared drives and calendars. It is a poor fit when you just need you@project.com on the fifth side project this year. Flap prices primarily by how many domains you connect (Solo ${PLANS.solo.limits.domains}, Pro ${PLANS.pro.limits.domains}, Team ${PLANS.team.limits.domains}), not by standing up a new suite environment per brand.`,
      },
      {
        heading: "What you get with Flap",
        body: `Connect domains, create addresses, send and receive from one inbox. Free plan: ${PLANS.free.limits.domains} domains, ${PLANS.free.limits.send_per_month} sends/month. Paid plans add catch-all, higher limits, and (on Team) team seats. Outbound uses your authenticated domain identities.`,
      },
      {
        heading: "Honest tradeoffs",
        body: "Choose Google Workspace when collaboration apps matter more than multi-domain mail. Choose Flap when the pain is another mailbox setup per launch. Flap receives mail via Amazon SES after you publish guided MX/SPF/DKIM at your DNS host - Cloudflare Email Routing is not required.",
      },
      {
        heading: "How founders switch",
        body: "Add the domain in Flap, paste MX/SPF/DKIM (Amazon SES) at your DNS provider, use Check setup until receiving is ready, then create hello@ and send a test. Use the free DNS checkers on Flap if you want a sanity check before cutover.",
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
        ["Docs / Meet / Drive", "Yes", "No - email only"],
        ["Best for", "Teams in Google apps", "Serial launchers"],
      ],
    },
    faqs: [
      {
        q: "Can Flap replace Google Workspace entirely?",
        a: "For email on multiple founder domains, often yes. For Docs, Drive, and Meet - no. Use the right tool for each job.",
      },
      {
        q: "How does Flap pricing compare to Workspace?",
        a: `Workspace list pricing scales by seats (illustrative ~$7/user/domain if you provision separately). Flap Solo is $${PLANS.solo.price_monthly}/mo for ${PLANS.solo.limits.domains} domains, Pro $${PLANS.pro.price_monthly} for ${PLANS.pro.limits.domains}, Team $${PLANS.team.price_monthly} for ${PLANS.team.limits.domains}. Use the cost calculator for your numbers.`,
      },
      {
        q: "Do I keep my Google account for personal mail?",
        a: "Yes. Flap is for project domains. Many founders keep personal Gmail and put only startup domains on Flap.",
      },
      {
        q: "Is migration automatic?",
        a: "Point DNS and create matching addresses in Flap. There is no automatic mailbox history importer - export older mail separately if you need it.",
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
    primaryIntent: "Find email hosting that supports many domains on one account",
    title: "Email hosting for multiple domains | Flap",
    description:
      "Host email for many domains in one inbox with Flap. Domain-first plans for indie hackers and studios juggling side projects.",
    h1: "Email hosting for multiple domains - one inbox",
    definition:
      "Multi-domain email hosting means one mail product accepts and sends mail for several custom domains. Flap (useflap.online) provides that as a single inbox with per-domain sender identities, aimed at founders who run many projects.",
    lede: "Need a host that accepts mail for many domains without a separate customer per brand? Flap is domain-first hosting: add domains to one account up to your plan limit.",
    updated: UPDATED,
    sections: [
      {
        heading: "Domain-first, not seat-first",
        body: "Plans are built around how many domains you connect. That matches how founders actually accumulate projects - domains grow faster than headcount.",
        bullets: [
          `Free: ${PLANS.free.limits.domains} domains`,
          `Solo: ${PLANS.solo.limits.domains} · Pro: ${PLANS.pro.limits.domains} · Team: ${PLANS.team.limits.domains}`,
          "Referral bonuses can add permanent domain slots",
        ],
      },
      {
        heading: "One inbox, many identities",
        body: "Mail for a.com and b.com lands in the same Flap inbox. You reply as the correct address without switching products or logging into forgotten forwards.",
      },
      {
        heading: "DNS you can finish",
        body: "Copy MX, SPF, and SES Easy DKIM CNAMEs from Flap Settings → Setup, then use Check setup or the free MX/SPF tools. Precise errors (“SPF missing include:amazonses.com”) beat a vague “verification failed.”",
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
        ["Receive on custom domains", "Via Amazon SES inbound → Flap ingest"],
        ["Send as domain identities", "Authenticated outbound from Flap"],
        ["Aliases / disposables", "Limits by plan; unlimited aliases on paid"],
        ["Catch-all", "Paid plans"],
        ["Team seats", "Studio up to 10"],
        ["Shared inboxes", "Team (e.g. support@, hello@)"],
      ],
    },
    faqs: [
      {
        q: "Do I need Cloudflare already?",
        a: "No. Flap receives mail via Amazon SES. Your DNS can live at Namecheap, Porkbun, Route 53, Cloudflare DNS, Vercel, etc. - publish the SES MX/SPF/DKIM values Flap shows. Cloudflare Email Routing is not required.",
      },
      {
        q: "Is this the same as email forwarding?",
        a: "No. Forwarding dumps brand mail into Gmail. Flap is a hosted inbox: receive, reply, schedule, and archive as your domain.",
      },
      {
        q: "How many domains can I host?",
        a: `Up to your plan limit (${PLANS.solo.limits.domains} / ${PLANS.pro.limits.domains} / ${PLANS.team.limits.domains} on Solo / Pro / Team), plus any referral domain bonuses.`,
      },
    ],
    related: [
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare setup guide" },
      { href: "/blog/catchall-aliases-indie-founders", label: "Blog: catch-all & aliases" },
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
    ],
  },

  "/custom-domain-email": {
    path: "/custom-domain-email",
    primaryIntent: "Learn how branded custom-domain email works and how to obtain an inbox",
    title: "Custom domain email without Workspace | Flap",
    description:
      "Get you@yourdomain.com with a real Flap inbox - aliases, send, and DNS guidance. Custom domain email without a Google Workspace per project.",
    h1: "Custom domain email that is actually an inbox",
    definition:
      "Custom domain email means sending and receiving mail as addresses on a domain you own (e.g. you@startup.com). Flap hosts that inbox for founders, with multi-domain support at useflap.online.",
    lede: "Custom domain email means you@yourdomain.com with a real mailbox. This guide explains inbox vs forwarding, DNS basics, and how Flap hosts branded addresses without Workspace.",
    updated: UPDATED,
    sections: [
      {
        heading: "Inbox vs forwarder",
        body: "A forwarder only redirects mail. Customers still see uneven reply-from behavior, and you lose a clean brand mailbox. Flap stores mail, lets you send as the domain, and keeps every project identity in one product.",
      },
      {
        heading: "Start free, then scale domains",
        body: `Prove MX on the Free plan (${PLANS.free.limits.domains} domains, ${PLANS.free.limits.send_per_month} sends/mo, ${PLANS.free.limits.mailboxes} mailboxes). Upgrade to Solo, Pro, or Team when projects multiply.`,
      },
      {
        heading: "Send as the brand",
        body: "Outbound uses your authenticated domain identities - not a personal Gmail rewrite. SPF/DKIM alignment follows the Amazon SES DNS you publish for Flap.",
      },
      {
        heading: "Setup path",
        body: "Add domain → paste MX/SPF/DKIM (Amazon SES) → Check setup → create hello@ → send a test. Provider-specific guides cover Cloudflare DNS, Namecheap, Porkbun, GoDaddy, Squarespace, Route 53, and Vercel DNS.",
      },
    ],
    faqs: [
      {
        q: "How long does setup take?",
        a: "Usually minutes once DNS propagates. Propagation itself can take longer depending on your DNS host and TTL.",
      },
      {
        q: "Can I use an existing domain?",
        a: "Yes. Keep the site where it is; only mail-related MX/TXT/CNAME records need to match Flap’s Amazon SES values (and remove conflicting MX).",
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
    primaryIntent: "Audience-specific use case for indie hackers who keep shipping",
    title: "Email for indie hackers | Flap",
    description:
      "Professional email for every side project domain. Flap gives indie hackers one inbox across launches - no per-project Workspace tax.",
    h1: "Email for indie hackers who keep shipping",
    definition:
      "Email for indie hackers is professional custom-domain mail sized for solo builders with many domains. Flap positions as “email infrastructure for people who keep launching things” - one inbox at useflap.online across project brands.",
    lede: "Built for indie hackers who ship often: professional email on every domain you own, without suite procurement theater.",
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
        body: "Invite a founder with your link - both accounts get +1 domain permanently after the referred user signs up, verifies email, and connects a domain.",
      },
      {
        heading: "What Flap is not",
        body: "Not enterprise procurement theater. Not a Docs suite. Not “cheap Gmail clones for generic business.” The wedge is multi-domain founder inbox.",
      },
    ],
    faqs: [
      {
        q: "Is Flap only for solo builders?",
        a: "Solo and Pro are solo-seat. Team adds up to 10 team seats and shared inboxes when you grow past one person.",
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
      { href: "/email-for-founders", label: "Email for founders" },
      { href: "/email-for-side-projects", label: "Email for side projects" },
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/blog/self-host-vs-hosted-email-startups", label: "Blog: self-host vs hosted" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
    ],
  },

  "/email-for-founders": {
    path: "/email-for-founders",
    primaryIntent: "Audience: serial / portfolio founders (broader than indie-hacker framing)",
    title: "Email for founders with multiple products | Flap",
    description:
      "Founder email across every product domain — one Flap inbox, correct reply-from identity, no Workspace account per launch.",
    h1: "Email for founders who run more than one product",
    definition:
      "Email for founders in this context means professional custom-domain mail sized for people who operate several products or brands. Flap gives serial founders one inbox across domains so each project keeps its identity without a separate suite per launch.",
    lede: "Indie hackers ship alone; many founders also run studios, client brands, or a small portfolio of SaaS experiments. Flap is the founder-shaped inbox for that portfolio — not a generic “business email” page.",
    updated: UPDATED,
    sections: [
      {
        heading: "The portfolio problem",
        body: "Founders accumulate domains faster than headcount: a main company, a spin-out, a client brand, a dead experiment still getting press mail. Thread context scatters when each brand has its own mailbox product.",
      },
      {
        heading: "What Flap optimizes",
        body: "One login. Domains added to the same account. Mail lands together. Replies use the receiving address’s domain. Plans scale primarily with how many domains and mailboxes you need — not with how many Google customers you open.",
      },
      {
        heading: "Founders vs indie hackers vs agencies",
        body: "Use /email-for-indie-hackers if you identify with solo shipping culture. Use /for/agencies when the job is holding many client domains with Team seats. This page is the middle: operators who own the brands and need founder-grade email without agency jargon.",
      },
      {
        heading: "What we do not claim",
        body: "Flap is not a full Google Workspace replacement (no Docs/Drive/Meet). It is not an ESP for cold outreach. IMAP/SMTP is not available yet — use the web app and PWA.",
      },
    ],
    faqs: [
      {
        q: "Can my cofounder join?",
        a: "Solo and Pro are single-seat. Team adds seats and shared inboxes (support@, hello@) when you grow past one operator.",
      },
      {
        q: "Do I move personal Gmail?",
        a: "No. Keep personal mail where it is. Put product and brand domains on Flap.",
      },
      {
        q: "How is this different from “email for multiple domains”?",
        a: "That pillar page answers the commercial multi-domain problem. This page answers the founder audience intent with portfolio language and ICP fit.",
      },
    ],
    related: [
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/email-for-indie-hackers", label: "Email for indie hackers" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/for/startups", label: "Flap for startups" },
      { href: "/#pricing", label: "Pricing" },
    ],
  },

  "/email-for-side-projects": {
    path: "/email-for-side-projects",
    primaryIntent: "Avoid full-suite cost for experimental / low-commitment projects",
    title: "Email for side projects | Flap",
    description:
      "Launch another domain without another email subscription. Flap is one inbox for all your side projects’ custom-domain email.",
    h1: "Email for every side project - without another subscription",
    definition:
      "Side-project email means a professional address on each experiment domain without paying for a full workspace per idea. Flap hosts those domains in one inbox so subscriptions do not multiply with launches.",
    lede: "Side projects should not inherit enterprise seat math. Use Flap when the experiment needs a professional address without a Workspace trial per idea.",
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
        a: `Free includes ${PLANS.free.limits.domains} domains. Add Solo or Pro when you need more domains on the same inbox.`,
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
    primaryIntent: "Head-to-head Flap vs Google Workspace tradeoffs for multi-project founders",
    title: "Flap vs Google Workspace for multi-project founders",
    description:
      "Compare Flap and Google Workspace for founders with several small products: cost scaling, unified inbox, setup, and best use case. Honest tradeoffs.",
    h1: "Flap vs Google Workspace",
    definition:
      "Flap vs Google Workspace is a use-case comparison: for a founder managing several small project domains, Flap may be simpler because one inbox covers many domains, while Workspace is stronger when you need Google’s full productivity suite and org tools.",
    lede: "This page compares two named products side by side. Use it when you already know both names and need tradeoffs - not a generic “alternatives” list.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Multiple domains / projects",
        body: `Workspace: typically separate customers or complex multi-domain admin when each brand is its own environment. Flap: add domains to one account up to your plan limit (Solo ${PLANS.solo.limits.domains}, Pro ${PLANS.pro.limits.domains}, Team ${PLANS.team.limits.domains}).`,
      },
      {
        heading: "Number of separate accounts / admin setups",
        body: "Each Workspace environment has its own admin surface. Flap keeps DNS guidance and mailboxes under one founder account so the Nth domain is “add domain,” not “new suite.”",
      },
      {
        heading: "Cost scaling",
        body: "Workspace cost rises with seats × how many environments you stand up. Flap Solo/Pro/Team rise mainly with domain count. Illustrative Workspace Business Starter list price used in Flap’s calculator: $7/user/month per domain you provision separately.",
      },
      {
        heading: "Unified inbox & identities",
        body: "Flap is designed as one inbox for many identities. Workspace inboxes are usually per user inside one organization - cross-brand unification is not the default path for indie multi-product setups.",
      },
      {
        heading: "Setup complexity",
        body: "Both need DNS. Flap’s path is MX/SPF/DKIM for Amazon SES inbound, with provider guides and DNS checkers. Workspace has mature admin UX and a broader suite to configure.",
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
        ["Setup", "Suite + DNS", "DNS → Amazon SES → Flap"],
        ["Best use case", "Teams in Google apps", "Serial / multi-domain founders"],
      ],
    },
    faqs: [
      {
        q: "Is Flap “better” than Google Workspace?",
        a: "Not universally. It is a better fit for multi-project email without suite overhead - not a claim of general superiority.",
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
      "Flap vs Zoho Mail compares two hosted email options. Zoho Mail is a capable full mail product; Flap focuses on a simpler multi-project workflow - one inbox, many domain identities, domain-first plans at useflap.online.",
    lede: "Zoho Mail is a capable hosted mail product. For founders juggling many small domains, Flap focuses on workflow simplicity: one inbox, many identities, domain-first plans - without pretending Zoho is “too expensive.”",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Workflow simplicity for many projects",
        body: "If your pain is “another domain, another mail setup,” Flap optimizes that loop. Zoho may be preferable if you already live in Zoho’s wider suite (CRM, books, office apps) and want mail inside that ecosystem.",
      },
      {
        heading: "Cost framing",
        body: "We do not claim Zoho is expensive. The comparison is about setup overhead and unified multi-domain management for serial launchers - not a price war.",
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
      caption: "Flap vs Zoho Mail - founder lens",
      headers: ["Dimension", "Zoho Mail", "Flap"],
      rows: [
        ["Product focus", "Hosted mail (+ Zoho suite)", "Multi-domain founder inbox"],
        ["Multi-project workflow", "Capable; org-oriented", "Optimized for serial launches"],
        ["Pricing narrative", "Varies by Zoho plan", "Domain-first Solo/Pro/Team"],
        ["Suite ecosystem", "Strong Zoho stack", "Email-only; no CRM suite"],
        ["Best for", "Zoho-centric teams", "Indie / studio multi-domain mail"],
      ],
    },
    faqs: [
      {
        q: "Does Flap migrate from Zoho?",
        a: "You can point DNS and create matching addresses. There is no automatic mailbox importer yet - export/import is manual.",
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
    primaryIntent: "Solve unified-inbox workflow across brand identities",
    title: "Multiple domains, one inbox | Flap",
    description:
      "Connect every startup domain to a single Flap inbox. Send and receive as each brand identity - one inbox for every startup you build.",
    h1: "Multiple domains. One inbox.",
    definition:
      "“Multiple domains, one inbox” means several custom domains deliver into a single mail product where you can send as each brand. Flap implements that for founders at useflap.online under the positioning “One inbox for every product you build.”",
    lede: "The problem is workflow: threads scatter across forwards and forgotten trials. Flap’s job here is one inbox, many sender identities - not “which host supports N domains.”",
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
        body: "Connect domains → publish MX/SPF/DKIM for Amazon SES → Flap ingest receives mail → create addresses → send and receive. Upgrade when domain count exceeds your plan.",
      },
      {
        heading: "Plan limits (domains)",
        body: `Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Pro ${PLANS.pro.limits.domains} · Team ${PLANS.team.limits.domains} (plus referral bonuses when earned).`,
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
        a: `Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Pro ${PLANS.pro.limits.domains} · Team ${PLANS.team.limits.domains} domains (plus referral bonuses).`,
      },
      {
        q: "Do all domains share storage and send quotas?",
        a: "Yes - quotas are per Flap account/plan (storage and monthly sends), not per domain silo.",
      },
      {
        q: "Can a studio share the inbox?",
        a: "Team includes team seats and shared inboxes (e.g. support@, hello@). Solo and Pro are single-seat.",
      },
    ],
    related: [
      { href: "/#pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/email-hosting-for-multiple-domains", label: "Email hosting for multiple domains" },
      { href: "/how-to-manage-email-for-multiple-domains", label: "How to manage multi-domain email" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "Blog: MX/SPF/DMARC checklist" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
    ],
  },

  "/how-to-manage-email-for-multiple-domains": {
    path: "/how-to-manage-email-for-multiple-domains",
    primaryIntent: "Education: practical steps to operate email across many domains",
    title: "How to manage email for multiple domains | Flap",
    description:
      "A practical playbook for managing email across many domains: inventory, DNS, one inbox vs many suites, reply identity, and when to use Flap.",
    h1: "How to manage email for multiple domains",
    definition:
      "Managing email for multiple domains means keeping branded send/receive working across several domains without losing threads or mixing From identities. Flap is one hosted approach: one inbox, many domain identities, guided Amazon SES DNS.",
    lede: "This is the how-to companion to Flap’s commercial multi-domain pages — a checklist you can follow whether you stay on Workspace, use forwarders, or move portfolio mail to Flap.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Inventory domains and addresses",
        body: "List every live domain and the addresses that must work (hello@, support@, founder@). Mark which are customer-facing vs experiments. Kill or park domains that no longer need MX before you pay for another mailbox.",
      },
      {
        heading: "2. Choose an operating model",
        body: "Three common models: (A) suite per brand, (B) forward everything to personal Gmail, (C) one multi-domain inbox. A fits companies living in Docs/Meet. B is fine for low-stakes intake. C fits founders who need to send as each brand from one place.",
        bullets: [
          "Suite-per-brand: highest admin and seat cost as N grows",
          "Forwarders: cheap intake, weak reply-from and history",
          "Multi-domain inbox (Flap): one operator surface across brands",
        ],
      },
      {
        heading: "3. Fix DNS once per domain",
        body: "For each domain you keep, publish a single clear inbound MX target, SPF that authorizes your sender, and DKIM for that provider. Conflicting MX (e.g. Email Routing plus SES) causes intermittent delivery. Use Flap’s free MX/SPF checkers if you want a second opinion.",
      },
      {
        heading: "4. Protect reply identity",
        body: "Decide how replies pick From. The failure mode is answering support@brand-a.com from personal Gmail or from brand-b.com. Flap’s workflow is: receive on a domain identity → reply as that identity.",
      },
      {
        heading: "5. Cut over without heroics",
        body: "Lower TTL the day before. Add the domain in Flap, publish SES MX/SPF/DKIM, Check setup, create matching addresses, send a test, then remove the old MX. Export older mail separately if you need history — Flap does not auto-import yet.",
      },
      {
        heading: "When Flap is the right tool",
        body: `Choose Flap when the job is portfolio email without suite overhead. Free covers ${PLANS.free.limits.domains} domains to prove the path; paid plans raise domain and mailbox limits. Stay on Workspace when collaboration apps are the product.`,
      },
    ],
    table: {
      caption: "Cutover checklist",
      headers: ["Step", "Done when"],
      rows: [
        ["Inventory", "Every live domain has an owner and address list"],
        ["Model chosen", "Suite / forward / multi-domain inbox decided"],
        ["DNS published", "MX/SPF/DKIM match one inbound provider"],
        ["Addresses created", "hello@ / support@ exist in the new system"],
        ["Test pass", "Send + receive + reply-from verified"],
        ["Old MX removed", "No conflicting inbound targets"],
      ],
    },
    faqs: [
      {
        q: "Can I keep some domains on Workspace?",
        a: "Yes. Many founders keep the main company on Workspace and put experimental or client domains on Flap. Each domain should have one inbound MX story.",
      },
      {
        q: "Do I need Cloudflare Email Routing?",
        a: "No for Flap’s current path. Publish Amazon SES records Flap shows. DNS can live at any registrar.",
      },
      {
        q: "Where is the product page for this problem?",
        a: "Start at /email-for-multiple-domains for commercial intent, or /multiple-domains-one-inbox for the unified-inbox workflow.",
      },
    ],
    related: [
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/how-to-send-email-from-multiple-domains", label: "How to send from multiple domains" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/guides", label: "DNS setup guides" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "MX/SPF/DMARC checklist" },
      { href: "/tools/email-setup-checker", label: "Email setup checker" },
      { href: "/signup", label: "Start free" },
    ],
  },

  "/email-for-multiple-saas-products": {
    path: "/email-for-multiple-saas-products",
    primaryIntent: "Commercial: email for operators running several SaaS products / brands",
    title: "Email for multiple SaaS products — one inbox | Flap",
    description:
      "Run hello@ and support@ across every SaaS product domain from one Flap inbox. Correct reply-from identity without a Workspace per launch.",
    h1: "Email for multiple SaaS products",
    definition:
      "Email for multiple SaaS products means branded send and receive on several product domains — often one founder or small team — without standing up a separate Google Workspace (or similar) per product. Flap (useflap.online) connects those domains to one inbox and replies as the product that received the mail.",
    lede: "You ship product-one.com, then product-two.dev, then an experiment.app. Each needs a real mailbox. Flap is built for that portfolio — not for replacing Docs/Drive across a large company.",
    updated: UPDATED,
    sections: [
      {
        heading: "The SaaS portfolio email problem",
        body: "Serial product builders accumulate domains faster than admin patience. Suite-per-product works once; by the third launch you are juggling seats, MX, and “which Gmail has that support thread?”",
        bullets: [
          "Customer mail must land on each product’s domain",
          "Replies must keep that product’s From identity",
          "Next launch should be “add domain,” not “new suite”",
        ],
      },
      {
        heading: "What Flap does for multi-product operators",
        body: `Connect each product domain to one Flap account (plan limits: Free ${PLANS.free.limits.domains} · Solo ${PLANS.solo.limits.domains} · Pro ${PLANS.pro.limits.domains} · Team ${PLANS.team.limits.domains}), publish Amazon SES MX/SPF/DKIM, create hello@ / support@, and work from a single inbox. Outbound uses authenticated domain identities.`,
      },
      {
        heading: "SaaS products vs agencies vs side projects",
        body: "Use this page when you own the products. Use /for/agencies (alias /email-for-agencies) when domains belong to clients. Use /email-for-side-projects when launches are experiments more than live SaaS brands. Use /email-for-venture-studios when a studio operates many portfolio companies under one operator surface.",
      },
      {
        heading: "Honest fit check",
        body: "Stay on Workspace or Microsoft 365 when collaboration apps are the daily product. Choose Flap when the job is multi-product mail without suite overhead. Flap is not a cold-outbound ESP; send caps protect reputation.",
      },
    ],
    table: {
      caption: "Where multi-SaaS email usually breaks",
      headers: ["Approach", "Works when", "Breaks when"],
      rows: [
        ["Workspace per product", "One company, suite needed", "Many launches, seat × brand tax"],
        ["Forwarders to personal mail", "Early intake only", "You must send as the product"],
        ["Aliases in one org", "Single company, many names", "Separate products / brands"],
        ["Flap multi-domain inbox", "Many product domains, one operator", "You need a full office suite"],
      ],
    },
    faqs: [
      {
        q: "Can each SaaS keep its own support@?",
        a: "Yes. Create addresses per domain. Replies are designed to use the identity that received the thread.",
      },
      {
        q: "Does Flap replace my product’s transactional ESP?",
        a: "Flap is mailbox + multi-domain inbox first. Paid plans include an API send path with plan caps — not a bulk marketing ESP replacement.",
      },
      {
        q: "Where do I start?",
        a: "Sign up free, add a product domain, publish the SES DNS Flap shows, create hello@, and send a test. See /migrate for cutover notes.",
      },
    ],
    related: [
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/email-for-founders", label: "Email for founders" },
      { href: "/email-for-venture-studios", label: "Email for venture studios" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
    ],
  },

  "/email-for-venture-studios": {
    path: "/email-for-venture-studios",
    primaryIntent: "Commercial: email for venture studios / portfolio company domains",
    title: "Email for venture studios — portfolio domains, one inbox | Flap",
    description:
      "Operate email across venture studio and portfolio company domains from one Flap inbox. Correct sender identity without a suite per company.",
    h1: "Email for venture studios",
    definition:
      "Email for venture studios means operating branded mail across a studio domain and multiple portfolio company domains from one operational home. Flap (useflap.online) is built for multi-domain inboxes with reply-from identity preserved per brand.",
    lede: "Studios spin up companies faster than traditional IT tickets. Flap keeps studio@ and each portfolio hello@ in one place — without claiming full agency client-portal software (that is a later roadmap).",
    updated: UPDATED,
    sections: [
      {
        heading: "Studio email is a portfolio problem",
        body: "A venture studio typically holds a studio brand plus N company domains. Operators need shared visibility, correct From on reply, and a path to add the next company without another Workspace environment.",
      },
      {
        heading: "How Flap maps to studio ops",
        body: `Add studio and company domains to one account up to your plan limit. Team plan adds seats and shared inboxes when partners need access. DNS stays at your registrar; Flap guides Amazon SES MX/SPF/DKIM.`,
      },
      {
        heading: "Studios vs agencies vs founders",
        body: "Founders own personal product stacks (/email-for-founders). Agencies hold client brands (/for/agencies). Studios sit between: portfolio companies the studio helps build, often with shared operators. Domain transfer to a spun-out company is a future capability — not marketed as shipped today.",
      },
      {
        heading: "What we do not overclaim",
        body: "No white-label client portals, no automatic company handoff UI yet, and no fabricated delivery SLAs. Export (.mbox / JSON) is available when a company leaves the studio stack.",
      },
    ],
    table: {
      caption: "Studio mail operating models",
      headers: ["Model", "Pros", "Cons"],
      rows: [
        ["Suite per company", "Familiar admin", "Slow + expensive as N grows"],
        ["Forward-only intake", "Cheap", "Weak reply-from and history"],
        ["Flap multi-domain inbox", "One operator surface", "Not a full office suite"],
      ],
    },
    faqs: [
      {
        q: "Can partners share an inbox?",
        a: "Team plan unlocks seats and shared inboxes. Grant access intentionally — do not assume every member sees every mailbox.",
      },
      {
        q: "Can we hand a domain to a spun-out company?",
        a: "Not as a one-click product feature today. Export mail and re-point DNS; a formal transfer workflow is planned only after real demand.",
      },
      {
        q: "Is this the same as email for agencies?",
        a: "Related. Agencies optimize for client domains; studios optimize for portfolio companies they help build. Both use multi-domain inbox mechanics.",
      },
    ],
    related: [
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/email-for-multiple-saas-products", label: "Email for multiple SaaS products" },
      { href: "/for/agencies", label: "Flap for agencies" },
      { href: "/email-for-founders", label: "Email for founders" },
      { href: "/pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
    ],
  },

  "/how-to-send-email-from-multiple-domains": {
    path: "/how-to-send-email-from-multiple-domains",
    primaryIntent: "Education: send as the correct domain across many brands",
    title: "How to send email from multiple domains | Flap",
    description:
      "Practical guide to sending as addresses on many domains: SPF/DKIM per domain, reply-from identity, and when a multi-domain inbox beats aliases or forwards.",
    h1: "How to send email from multiple domains",
    definition:
      "Sending email from multiple domains means authenticating outbound mail (SPF/DKIM) for each domain and choosing the correct From identity per thread. Flap does this inside one inbox so replies stay on the domain that received the message.",
    lede: "Receiving is half the job. The failure mode that hurts brand trust is answering support@brand-a.com from personal Gmail or from brand-b.com. This page is the send-side companion to managing multi-domain email.",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Authenticate each sending domain",
        body: "Every domain you send as needs SPF that authorizes your provider and DKIM for that provider. On Flap, publish the Amazon SES records shown in Settings. Conflicting SPF includes or leftover forwarder rules cause intermittent failures.",
      },
      {
        heading: "2. Decide how From is chosen",
        body: "Options: (A) manually pick From every time, (B) aliases inside one org that is not really multi-brand, (C) an inbox that defaults From to the receiving address. Flap optimizes for (C) — reply as the identity that received the thread.",
        bullets: [
          "Manual pick: error-prone under volume",
          "Single-org aliases: fine for one company, many names",
          "Receive → reply-from lock: best for multi-brand portfolios",
        ],
      },
      {
        heading: "3. Separate transactional pipes carefully",
        body: "Product transactional mail (receipts, password resets) may stay on a dedicated ESP. Founder and support mail can live on Flap. Do not mix cold outbound into the same domain reputation pool as customer support.",
      },
      {
        heading: "4. Test before you cut MX",
        body: "Create the address in Flap, send a test to an external account, confirm DKIM passes, then reply to an inbound test and verify From. Use /migrate for the full cutover narrative.",
      },
      {
        heading: "When Flap is the right tool",
        body: "Choose Flap when the job is multi-domain send/receive without suite overhead. See /how-to-manage-email-for-multiple-domains for the broader operating playbook and /email-for-multiple-domains for the commercial landing.",
      },
    ],
    table: {
      caption: "Send identity checklist",
      headers: ["Check", "Pass when"],
      rows: [
        ["SPF", "Includes your outbound provider for that domain"],
        ["DKIM", "Selector validates for the From domain"],
        ["From on reply", "Matches the address that received the thread"],
        ["No conflict", "One clear outbound story per domain"],
      ],
    },
    faqs: [
      {
        q: "Can I send as any address on a domain?",
        a: "You send as mailboxes (and aliases) you create in Flap for domains you control — not arbitrary spoofing of domains you do not own.",
      },
      {
        q: "Do I need a different ESP per domain?",
        a: "Not for Flap mailbox send. Each connected domain is authenticated via SES. Heavy product transactional volume may still use a separate ESP by design.",
      },
      {
        q: "Where is the product page?",
        a: "Start at /email-for-multiple-domains or /multiple-domains-one-inbox.",
      },
    ],
    related: [
      { href: "/how-to-manage-email-for-multiple-domains", label: "How to manage multi-domain email" },
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/blog/mx-spf-dmarc-setup-checklist", label: "MX/SPF/DMARC checklist" },
      { href: "/tools/spf-checker", label: "SPF checker" },
      { href: "/migrate", label: "Migrate to Flap" },
      { href: "/signup", label: "Start free" },
    ],
  },

  "/google-workspace-multiple-domains": {
    path: "/google-workspace-multiple-domains",
    primaryIntent: "Education: how Google Workspace handles multiple domains vs Flap’s model",
    title: "Google Workspace multiple domains — when Flap fits better | Flap",
    description:
      "Understand Google Workspace multi-domain and alias options vs Flap’s one-inbox model for founders running separate product brands.",
    h1: "Google Workspace and multiple domains",
    definition:
      "Google Workspace can attach secondary domains and aliases inside an organization. That works well for one company with many names. Flap targets a different job: many product brands in one inbox without a suite environment per launch.",
    lede: "Searching “Google Workspace multiple domains” usually means either (1) how to add domains inside Workspace, or (2) whether Workspace is the right unit of cost for a portfolio of startups. This page answers both honestly — without inventing Workspace pricing you should re-verify at publish time.",
    updated: UPDATED,
    sections: [
      {
        heading: "What Workspace multi-domain is good at",
        body: "Inside one organization, Workspace secondary domains and aliases let people@company.com and people@brand.com share an admin surface. That is excellent when brands are facets of one company that also needs Docs, Drive, and Meet.",
      },
      {
        heading: "Where the model stretches for serial founders",
        body: "When each launch is a separate brand (or a separate Workspace customer), cost and admin scale with environments × seats. Domain aliases inside one org do not match how many indie founders actually launch — separate products, separate legal entities, shared human operator.",
      },
      {
        heading: "Flap’s alternative framing",
        body: "Flap is not a Workspace clone. It is multi-domain email infrastructure and inbox: connect domains, receive centrally, reply as the receiving identity. Use /flap-vs-google-workspace for a head-to-head and /tools/google-workspace-cost-calculator for illustrative savings math.",
      },
      {
        heading: "Hybrid is allowed",
        body: "Keep the main company on Workspace. Put experimental or secondary product domains on Flap. Each domain should have one clear inbound MX story — do not stack conflicting providers.",
      },
    ],
    table: {
      caption: "Multi-domain job → better default",
      headers: ["Job", "Often better with"],
      rows: [
        ["One company, many domain names, need Docs/Meet", "Google Workspace"],
        ["Many product brands, one operator, email-first", "Flap"],
        ["Low-stakes forwards only", "Forwarding tools"],
        ["Full Microsoft stack", "Microsoft 365"],
      ],
    },
    faqs: [
      {
        q: "Is Flap cheaper than Workspace?",
        a: "It depends on seats, how many environments you stand up, region, and taxes. Flap’s wedge is multi-domain simplicity — use the cost calculator for illustrations, not guarantees.",
      },
      {
        q: "Can I migrate from Workspace?",
        a: "Point DNS after verifying in Flap; export history separately. See /migrate — no automatic Gmail/IMAP importer is claimed today.",
      },
      {
        q: "Where is the comparison page?",
        a: "/flap-vs-google-workspace and /google-workspace-alternative.",
      },
    ],
    related: [
      { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
      { href: "/google-workspace-alternative", label: "Workspace alternative" },
      { href: "/blog/cost-of-google-workspace-multiple-domains", label: "Blog: Workspace cost across domains" },
      { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
      { href: "/email-for-multiple-domains", label: "Email for multiple domains" },
      { href: "/signup", label: "Start free" },
    ],
  },

  "/cloudflare-email-routing-alternative": {
    path: "/cloudflare-email-routing-alternative",
    title: "Cloudflare Email Routing alternative with a real reply inbox | Flap",
    description:
      "Outgrown Cloudflare Email Routing forwards? Flap is the upgrade path when you need a real custom-domain inbox to reply from - Amazon SES mail, app on Cloudflare, DNS at any registrar.",
    h1: "Cloudflare Email Routing alternative when you need a real inbox",
    definition:
      "Cloudflare Email Routing is excellent for forwarding and Worker hooks. Flap is a hosted custom-domain mailbox (send + receive) for founders who need to reply as hello@theirbrand.com from one inbox across many domains.",
    lede: "Keep Cloudflare for DNS or the website if you want. When forwards are no longer enough - you need threads, send-as identities, and a product inbox - Flap is the upgrade path without inventing a ship date for IMAP or claiming Cloudflare is “bad.”",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "What Email Routing is great at",
        body: "Forwarding to Gmail, simple address rules, and Worker-based ingest. Many founders start there for a single project. It is not trying to be a full multi-domain founder mailbox with compose, filters, and plan-based quotas.",
        bullets: [
          "Stay on Email Routing if forwarding-only is enough",
          "Move on when you need to reply from the custom domain in a dedicated inbox",
        ],
      },
      {
        heading: "What Flap adds",
        body: "Flap stores mail in your account, lets you compose as project identities, and prices primarily by domain count. Customer mail runs on Amazon SES; the Flap app runs on Cloudflare Workers. Your DNS can stay at Cloudflare, Namecheap, Porkbun, GoDaddy, or anywhere else.",
      },
      {
        heading: "Honest tradeoffs",
        body: "Email Routing is free for many forwarding use cases and deeply integrated with Cloudflare zones. Flap is a paid product (with a free trial tier) focused on multi-domain inboxes - not a Cloudflare dashboard replacement, not Docs/Drive, and IMAP/SMTP client access is not available yet (use the web app and PWA).",
      },
      {
        heading: "How the switch looks",
        body: "Add the domain in Flap, publish the MX/SPF/DKIM records Flap shows (SES inbound), create mailboxes, then Check setup. If you previously pointed MX at route*.mx.cloudflare.net for Email Routing, replace those with Flap’s SES MX values - pick one inbound provider per domain.",
      },
    ],
    table: {
      caption: "Email Routing vs Flap",
      headers: ["Dimension", "Cloudflare Email Routing", "Flap"],
      rows: [
        ["Primary job", "Forward / Worker ingest", "Multi-domain founder inbox"],
        ["Reply from custom domain", "Usually via Gmail/other", "In-product compose"],
        ["Many project domains", "Per-zone rules", "One account, domain-first plans"],
        ["Where DNS lives", "Often Cloudflare", "Any registrar"],
        ["Mail transport", "Cloudflare routing", "Amazon SES + Flap app"],
      ],
    },
    faqs: [
      {
        q: "Do I need to leave Cloudflare DNS?",
        a: "No. Publish Flap’s SES MX/SPF/DKIM at Cloudflare DNS (DNS-only for mail records). You do not need Email Routing Worker rules for the current Flap path.",
      },
      {
        q: "Can I keep some domains on Email Routing?",
        a: "Yes. Move only the domains that need a real reply inbox. Each domain should have one clear inbound MX target.",
      },
      {
        q: "Is Flap “better” than Email Routing?",
        a: "Different jobs. Routing wins for free forwards. Flap wins when you need a product inbox across startups.",
      },
    ],
    related: [
      { href: "/guides/cloudflare-custom-domain-email", label: "Cloudflare DNS guide for Flap" },
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/signup", label: "Start free" },
      { href: "/hydra-alternative", label: "Hydra alternative" },
    ],
  },
  "/hydra-alternative": {
    path: "/hydra-alternative",
    title: "Hydra alternative for multi-domain founder email | Flap",
    description:
      "Looking beyond Hydra for custom-domain email across side projects? Flap offers one inbox, domain-first plans, SES mail, and Cloudflare app hosting - honest comparison without slam copy.",
    h1: "Hydra alternative for multi-domain founders",
    definition:
      "Hydra is another custom-domain email option some founders consider. Flap (useflap.online) is built specifically for serial launchers who want one inbox across many project domains with transparent domain-first pricing.",
    lede: "We respect that different mail products fit different workflows. If you evaluated Hydra and want a founder-focused inbox with clear limits, export, and SES-backed delivery, here is how Flap compares without trash-talk.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Where Flap focuses",
        body: "Multi-domain setup guided by MX/SPF/DKIM checks, compose as each brand, filters/aliases, JSON and .mbox export, API keys and inbound webhooks on paid plans, Team seats when a teammate joins.",
      },
      {
        heading: "Architecture (no marketing fog)",
        body: MARKETING.architecture_line + " You keep registrar control; Flap does not require moving nameservers to Cloudflare.",
      },
      {
        heading: "Honest tradeoffs",
        body: "Hydra may fit better if you already prefer its UX, pricing, or client story. Flap does not claim IMAP/SMTP today - use the web app and PWA until client access ships. Flap is not a full Google Workspace suite replacement.",
      },
      {
        heading: "Try before you cut over",
        body: `Start on Free with up to ${PLANS.free.limits.domains} domains, prove receiving, export anytime. Cancel keeps access through the paid period - download your mailbox before it ends.`,
      },
    ],
    table: {
      caption: "Choosing a founder mail host",
      headers: ["Ask", "Why it matters"],
      rows: [
        ["Domain-first pricing?", "Serial launchers hate seat×brand math"],
        ["Export available?", "Trust requires exit"],
        ["Real send + receive?", "Forwards-only is a different product"],
        ["DNS stays put?", "Avoid forced registrar moves"],
      ],
    },
    faqs: [
      {
        q: "Is Flap a Hydra clone?",
        a: "No. Flap is its own product aimed at multi-domain founders. Compare features and limits for your workflow instead of brand loyalty.",
      },
      {
        q: "Can I migrate mail history automatically?",
        a: "Not yet. Point DNS, create matching addresses, and import older mail manually if needed. Export from Flap as JSON or .mbox anytime.",
      },
      {
        q: "Where does Flap run mail?",
        a: "Customer domains use Amazon SES for send/receive. The app and storage control plane run on Cloudflare. System mail for useflap.online uses Cloudflare SEB.",
      },
    ],
    related: [
      { href: "/folio-alternative", label: "Folio alternative" },
      { href: "/google-workspace-alternative", label: "Google Workspace alternative" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
    ],
  },
  "/folio-alternative": {
    path: "/folio-alternative",
    title: "Folio alternative for project-domain email | Flap",
    description:
      "Considering Folio for founder email? Flap is a multi-domain inbox alternative with SES mail, Cloudflare app hosting, filters, webhooks, and export - compared honestly.",
    h1: "Folio alternative for multi-project email",
    definition:
      "Folio is another hosted email option founders may evaluate. Flap focuses on one inbox across many startup domains, domain-first plans, and an explicit SES + Cloudflare architecture.",
    lede: "Product taste differs. If Folio’s model does not match how you launch brands, Flap is built for the narrower job: professional addresses on every domain you own, without a Workspace per project.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Flap’s bet",
        body: "Mailbox count is the main scaling axis (Solo 3, Pro 6, Team 12; up to 50 domains on every paid plan). Features like catch-all, filters, API keys, inbound webhooks, and Team seats show up where plans unlock them - not as vague “priority support” badges.",
      },
      {
        heading: "Trust and exit",
        body: "Export JSON backups and .mbox downloads from Settings. After cancel, keep access through the paid period; download your mailbox before it ends.",
      },
      {
        heading: "Honest tradeoffs",
        body: "Choose Folio (or another host) if its clients, UI, or pricing fit you better. Flap does not offer IMAP/SMTP yet and is not a collaboration suite. Prefer Flap when multi-domain founder inbox + transparent architecture matter most.",
      },
    ],
    table: {
      caption: "Fit checklist",
      headers: ["Need", "Flap"],
      rows: [
        ["Many domains, one login", "Yes - core design"],
        ["Send as brand identities", "Yes"],
        ["Desktop IMAP today", "Not yet - web/PWA"],
        ["Export mailbox", "JSON + .mbox"],
        ["Team seats", "Studio"],
      ],
    },
    faqs: [
      {
        q: "Will Flap slam Folio?",
        a: "No. These pages explain Flap’s fit. Pick the product that matches your constraints.",
      },
      {
        q: "Does Flap require Cloudflare Email Routing?",
        a: "No for the current path. Publish SES MX/SPF/DKIM Flap shows; the app still runs on Cloudflare.",
      },
      {
        q: "How do I try Flap?",
        a: `Sign up free, add a domain (Free covers up to ${PLANS.free.limits.domains}), Check setup, create hello@, send a test. Upgrade only when domain count needs it.`,
      },
    ],
    related: [
      { href: "/hydra-alternative", label: "Hydra alternative" },
      { href: "/cloudflare-email-routing-alternative", label: "Cloudflare Email Routing alternative" },
      { href: "/multiple-domains-one-inbox", label: "Multiple domains, one inbox" },
      { href: "/signup", label: "Start free" },
    ],
  },
  "/justemails-alternative": {
    path: "/justemails-alternative",
    title: "JustEmails alternative for multi-domain founders | Flap",
    description:
      "Comparing JustEmails to Flap? Flap is a domain-first multi-domain inbox on Amazon SES with filters, webhooks, export, and transparent limits - not a flat yearly black box.",
    h1: "JustEmails alternative for serial launchers",
    definition:
      "JustEmails is a simple hosted email option some founders consider for a flat yearly fee. Flap (useflap.online) is built for people who keep launching domains and want one inbox, clear plan limits, and SES-backed send/receive.",
    lede: "If JustEmails’ flat-year model fits a single quiet brand, keep it. If you outgrow one mailbox story and need domain-first pricing plus developer hooks, Flap is the honest comparison.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Where Flap differs",
        body: `Domain-first plans (Free ${PLANS.free.limits.domains} domains, Solo ${PLANS.solo.limits.domains} at $${PLANS.solo.price_monthly}/mo, Pro ${PLANS.pro.limits.domains} at $${PLANS.pro.price_monthly}/mo). Filters, aliases, JSON/.mbox export, API keys and inbound webhooks on Solo+, Team seats for small teams.`,
      },
      {
        heading: "Architecture",
        body: MARKETING.architecture_line + " You stay at your registrar; Flap does not force Cloudflare Email Routing.",
      },
      {
        heading: "Honest tradeoffs",
        body: "JustEmails may win on ultra-simple yearly sticker for a minimal mailbox. Flap does not claim IMAP/SMTP yet and is not a productivity suite. Prefer Flap when multi-domain inbox + transparent quotas matter.",
      },
    ],
    table: {
      caption: "Fit checklist",
      headers: ["Need", "Flap angle"],
      rows: [
        ["Many project domains", "Core pricing axis"],
        ["Real send + receive", "SES-backed inbox"],
        ["Export / exit", "JSON + .mbox"],
        ["API / webhooks", "Solo+"],
        ["Desktop IMAP today", "Not yet - web/PWA"],
      ],
    },
    faqs: [
      {
        q: "Is Flap cheaper than JustEmails?",
        a: "Depends on domain count and whether you need send quotas, filters, and team seats. Compare live pricing at /pricing rather than a single yearly headline.",
      },
      {
        q: "Can I migrate automatically?",
        a: "Not yet. Point DNS, recreate addresses, and import older mail manually if needed. Export from Flap anytime.",
      },
    ],
    related: [
      { href: "/migadu-alternative", label: "Migadu alternative" },
      { href: "/improvmx-alternative", label: "ImprovMX alternative" },
      { href: "/pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
    ],
  },
  "/migadu-alternative": {
    path: "/migadu-alternative",
    title: "Migadu alternative for multi-domain email | Flap",
    description:
      "Looking at Migadu for custom domains? Flap focuses on one inbox across many startup domains with SES delivery, guided DNS, and domain-first plans for indie founders.",
    h1: "Migadu alternative for multi-domain founders",
    definition:
      "Migadu is a respected independent email host. Flap is a narrower product: multi-domain founder inboxes on Amazon SES with Cloudflare app hosting and domain-first pricing.",
    lede: "Choose Migadu if you want their mailbox model and admin UX. Choose Flap if your job is launching many brands into one inbox without a Workspace per project.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Flap’s focus",
        body: "Guided MX/SPF/DKIM, compose as each brand, catch-all/aliases on paid plans, filters, export, and developer webhooks - optimized for serial launchers.",
      },
      {
        heading: "Honest tradeoffs",
        body: "Migadu may fit better for traditional mailbox hosting preferences. Flap does not offer IMAP/SMTP today and does not replace full collaboration suites.",
      },
    ],
    table: {
      caption: "Questions to ask",
      headers: ["Ask", "Why"],
      rows: [
        ["How many domains will I add this year?", "Domain-first vs seat-first math"],
        ["Do I need IMAP now?", "Flap is web/PWA today"],
        ["Do I need API send + inbound hooks?", "Flap Solo+"],
      ],
    },
    faqs: [
      {
        q: "Is Flap a Migadu clone?",
        a: "No. Flap is aimed at multi-domain founders with SES-backed mail and transparent plan limits.",
      },
      {
        q: "Where does mail run?",
        a: "Customer domains use Amazon SES. The Flap app runs on Cloudflare. System mail for useflap.online uses Cloudflare SEB.",
      },
    ],
    related: [
      { href: "/justemails-alternative", label: "JustEmails alternative" },
      { href: "/flap-vs-google-workspace", label: "vs Google Workspace" },
      { href: "/guides", label: "DNS guides" },
      { href: "/signup", label: "Start free" },
    ],
  },
  "/improvmx-alternative": {
    path: "/improvmx-alternative",
    title: "ImprovMX alternative with a real inbox | Flap",
    description:
      "ImprovMX is great for forwarding. Flap is for founders who need a real reply inbox across many domains - SES send/receive, not forwards-only.",
    h1: "ImprovMX alternative when you need a real inbox",
    definition:
      "ImprovMX focuses on email forwarding and aliases. Flap (useflap.online) hosts a real multi-domain inbox so you can send and receive as you@yourstartup.com without a Workspace per launch.",
    lede: "Keep ImprovMX if forwarding to Gmail is enough. Switch intent to Flap when you need stored mail, compose-as-brand, filters, and outbound from your domains.",
    updated: UPDATED,
    comparison: true,
    sections: [
      {
        heading: "Forwarding vs inbox",
        body: "Forwards-only products solve aliasing. Flap stores mail, supports compose identities, aliases/catch-all (plan allowing), and export - a different job than redirecting to another mailbox.",
      },
      {
        heading: "Architecture",
        body: MARKETING.architecture_line,
      },
      {
        heading: "Honest tradeoffs",
        body: "ImprovMX can be simpler and cheaper when you only need redirects. Flap costs more as you scale domains because you get a hosted inbox, not a forward.",
      },
    ],
    table: {
      caption: "Product job",
      headers: ["Job", "Better fit"],
      rows: [
        ["Forward to Gmail/Outlook", "ImprovMX / similar"],
        ["One inbox across startups", "Flap"],
        ["Send as brand identities", "Flap"],
        ["API send + inbound webhooks", "Flap Solo+"],
      ],
    },
    faqs: [
      {
        q: "Is Flap email forwarding?",
        a: "No. Flap is a hosted inbox. Optional forwarding rules exist inside the product, but the core is stored mail on SES.",
      },
      {
        q: "Can I keep Gmail and add Flap?",
        a: "Yes for a transition. Long-term, founders usually cut over MX fully so brand mail is not split across providers.",
      },
    ],
    related: [
      { href: "/cloudflare-email-routing-alternative", label: "Cloudflare Email Routing alternative" },
      { href: "/custom-domain-email", label: "Custom domain email" },
      { href: "/pricing", label: "Pricing" },
      { href: "/signup", label: "Start free" },
    ],
  },
};

export function getSeoPage(path: string): SeoPageDef | null {
  return SEO_PAGE_DEFS[path] ?? null;
}

/** @deprecated Prefer path-only import from `./seo-paths` in App to keep bodies out of the main chunk. */
export const SEO_PATHS = Object.keys(SEO_PAGE_DEFS);
