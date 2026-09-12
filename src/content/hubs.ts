/** Role and comparison hubs written around Flap's own multi-domain workflow. */

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
      "Solo starts at $6/mo for three mailboxes and generous domain capacity.",
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
    description: "REST API, webhooks, confirm-first drafts, thin SDKs and CLI.",
    h1: "Email for developers",
    body: [
      "Send and receive via API on paid plans.",
      "Developer tools list domains and draft with confirm - never silent send.",
      "TypeScript and Python SDKs plus a thin CLI live under /sdks.",
    ],
  },
  {
    path: "/for/agencies",
    title: "For agencies | Flap",
    description:
      "Client domains in one Flap org: Team seats, shared inboxes, and correct reply-from — without a Workspace per client.",
    h1: "Email for agencies",
    body: [
      "Hold many client brands in one workspace (up to your plan domain limit) instead of a suite environment per client.",
      "Team plan unlocks unlimited seats and shared inboxes so operators can triage client mail together.",
      "Reply as the client domain that received the thread — the core multi-domain workflow, not an afterthought.",
      "Honest deliverability dashboards per domain on Amazon SES. Client portals and one-click domain transfer are not marketed as shipped today.",
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
    path: "/vs/hydra",
    title: "Flap vs Hydra | Flap",
    description: "Portfolio email comparison with Hydra.",
    h1: "Flap vs Hydra",
    body: [
      "Both target multi-domain founders.",
      "Flap differentiates on SES honesty, Team seats, API/webhooks, and a focused multi-domain workflow.",
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
