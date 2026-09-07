/** Shipmail-shaped /for and /vs hubs (Flap-angled). */

export type HubPage = {
  path: string;
  title: string;
  description: string;
  h1: string;
  body: string[];
  cta?: string;
};

export const FOR_PAGES: HubPage[] = [
  {
    path: "/for/indie-hackers",
    title: "For indie hackers | Flap",
    description: "Multi-domain portfolio email without a Workspace seat per launch.",
    h1: "Email for indie hackers",
    body: [
      "You keep launching domains. Flap keeps one inbox across them.",
      "Free includes real mailboxes so you can prove MX before you pay.",
      "Solo starts at $6/mo for three mailboxes — up to 50 domains on every paid plan.",
    ],
  },
  {
    path: "/for/startups",
    title: "For startups | Flap",
    description: "Shared support@ and founder@ across brands without Google Workspace seats.",
    h1: "Email for startups",
    body: [
      "Shared inboxes and seats on Pro and Team.",
      "API keys and webhooks for product mail.",
      "Amazon SES for your domains. Cloudflare for the app.",
    ],
  },
  {
    path: "/for/freelancers",
    title: "For freelancers | Flap",
    description: "Client domains and a professional hello@ without expensive suites.",
    h1: "Email for freelancers",
    body: [
      "Add client or personal brand domains to one Flap account.",
      "Catch-all and aliases keep intake tidy.",
      "Export anytime. Leave with your data.",
    ],
  },
  {
    path: "/for/developers",
    title: "For developers | Flap",
    description: "REST API, webhooks, MCP drafts with confirm, thin SDKs and CLI.",
    h1: "Email for developers",
    body: [
      "Send and receive via API on paid plans.",
      "MCP tools list domains and draft with confirm - never silent send.",
      "TypeScript and Python SDKs plus a thin CLI live under /sdks.",
    ],
  },
  {
    path: "/for/agencies",
    title: "For agencies | Flap",
    description: "Client domains, Team seats, and shared inboxes for small agencies.",
    h1: "Email for agencies",
    body: [
      "Hold many client brands in one org (up to your plan domain limit).",
      "Team plan unlocks unlimited seats and shared inboxes.",
      "Honest deliverability dashboards per domain on SES.",
    ],
  },
  {
    path: "/for/ecommerce",
    title: "For ecommerce | Flap",
    description: "orders@ and transactional sends with honest caps on Amazon SES.",
    h1: "Email for ecommerce",
    body: [
      "Route orders@ and support@ into shared inboxes.",
      "Transactional API sends count toward plan send caps.",
      "Not a cold-outbound ESP - hard caps protect reputation.",
    ],
  },
  {
    path: "/for/creators",
    title: "For creators | Flap",
    description: "Creator domains plus a capped newsletter path when you need a launch blast.",
    h1: "Email for creators",
    body: [
      "Professional mail on your domain first.",
      "Newsletter tools are capped and double opt-in - not Mailchimp.",
      "AI can draft. You always confirm before send.",
    ],
  },
];

export const VS_PAGES: HubPage[] = [
  {
    path: "/vs/google-workspace",
    title: "Flap vs Google Workspace | Flap",
    description: "Compare Flap and Google Workspace for multi-domain founders.",
    h1: "Flap vs Google Workspace",
    body: [
      "Workspace wins when you need Docs, Drive, and Meet.",
      "Flap wins when you need you@project.com on many domains without a seat tax each time.",
      "See also /flap-vs-google-workspace and the cost calculator.",
    ],
  },
  {
    path: "/vs/microsoft-365",
    title: "Flap vs Microsoft 365 | Flap",
    description: "Email-only Flap vs full Microsoft 365 suites for small teams.",
    h1: "Flap vs Microsoft 365",
    body: [
      "M365 is a productivity suite. Flap is custom-domain email infrastructure.",
      "If you only need mailboxes across brands, Flap is the lighter path.",
    ],
  },
  {
    path: "/vs/zoho-mail",
    title: "Flap vs Zoho Mail | Flap",
    description: "Multi-domain inbox vs managing separate Zoho setups.",
    h1: "Flap vs Zoho Mail",
    body: [
      "Zoho is a broad suite. Flap focuses on portfolio domains in one inbox.",
      "Existing deep dive: /flap-vs-zoho.",
    ],
  },
  {
    path: "/vs/shipmail",
    title: "Flap vs Shipmail | Flap",
    description: "Honest comparison: Shipmail mailbox-flat plans vs Flap multi-domain SES hosting.",
    h1: "Flap vs Shipmail",
    body: [
      "Shipmail Solo is $4/mo; Flap Solo is $6/mo (Free forever wedge + SES margin). Pro $12 / Team $29. Same paid stack (webmail first; IMAP later).",
      "Shipmail markets IMAP/JMAP/CalDAV and newsletters as included. Flap ships webmail + SES first; IMAP credentials target 2026-10-15.",
      "Flap Free includes real mailboxes. Shipmail Free is dashboard-only (0 mailboxes).",
      "Architecture: Flap = Amazon SES + Cloudflare Workers. Shipmail markets its own EU-hosted mail engine.",
    ],
  },
  {
    path: "/vs/hydra",
    title: "Flap vs Hydra | Flap",
    description: "Portfolio email comparison with Hydra.",
    h1: "Flap vs Hydra",
    body: [
      "Both target multi-domain founders.",
      "Flap differentiates on SES honesty, Team seats, API/webhooks, and paper/orange product chrome.",
      "See /hydra-alternative.",
    ],
  },
  {
    path: "/vs/folio",
    title: "Flap vs Folio | Flap",
    description: "Flap team/shared inbox path vs Folio solo portfolio mail.",
    h1: "Flap vs Folio",
    body: ["Flap adds Pro/Team seats and shared inboxes.", "See /folio-alternative."],
  },
  {
    path: "/vs/cloudflare-email-routing",
    title: "Flap vs Cloudflare Email Routing | Flap",
    description: "When you outgrow forwarding and need a real multi-domain inbox.",
    h1: "Flap vs Cloudflare Email Routing",
    body: [
      "Cloudflare Email Routing is excellent forwarding. Flap is hosted mailboxes on Amazon SES.",
      "Your DNS can stay anywhere. The Flap app runs on Cloudflare; customer mail does not require Email Routing.",
      "See /cloudflare-email-routing-alternative.",
    ],
  },
  {
    path: "/vs/migadu",
    title: "Flap vs Migadu | Flap",
    description: "Protocol-first Migadu vs Flap webmail-first SES hosting.",
    h1: "Flap vs Migadu",
    body: [
      "Migadu wins on mature IMAP today.",
      "Flap wins on founder UX, multi-domain onboarding, and API surface while IMAP is dated.",
    ],
  },
  {
    path: "/vs/fastmail",
    title: "Flap vs Fastmail | Flap",
    description: "Personal/pro Fastmail vs multi-domain Flap for builders.",
    h1: "Flap vs Fastmail",
    body: [
      "Fastmail is excellent personal and small-business mail.",
      "Flap is aimed at people who keep adding project domains.",
    ],
  },
  {
    path: "/vs/improvmx",
    title: "Flap vs ImprovMX | Flap",
    description: "Forwarding vs real Flap mailboxes.",
    h1: "Flap vs ImprovMX",
    body: [
      "ImprovMX shines at forwarding aliases.",
      "Flap stores mail, supports shared inboxes, and sends via SES from your domain.",
    ],
  },
];

export const FOR_PATHS = FOR_PAGES.map((p) => p.path);
export const VS_PATHS = VS_PAGES.map((p) => p.path);

export function hubByPath(path: string): HubPage | undefined {
  return [...FOR_PAGES, ...VS_PAGES].find((p) => p.path === path);
}
