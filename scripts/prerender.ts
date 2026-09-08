/**
 * Build-time prerender for marketing / SEO routes.
 *
 * Flap is a Vite SPA on Cloudflare Workers Assets (not full React SSR).
 * This script copies the built SPA shell and injects route-specific
 * <title>, meta, canonical, JSON-LD, and crawlable article HTML into
 * dist/client/<path>/index.html so Assets serves real HTML for those URLs
 * (before React mounts and replaces #root).
 *
 * Also regenerates public/sitemap.xml + dist/client/sitemap.xml from
 * src/content/sitemap.ts so the URL list stays aligned with App routes.
 *
 * Limits vs full SSR: no per-request React render, no auth-aware HTML,
 * and bots that execute JS still see the SPA. Humans get the same JS app.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANS, PLAN_ORDER } from "../shared/plans.ts";
import { BLOG_POSTS } from "../src/content/blog.ts";
import { API_DOCS, API_SEND, WEBHOOK_DOCS } from "../src/content/api-docs.ts";
import { GUIDE_CONTENT } from "../src/content/guides.ts";
import {
  BLOG_INDEX,
  GUIDE_PAGES,
  MARKETING,
  SITE_URL,
  SUPPORT_EMAIL,
  TOOL_PAGES,
} from "../src/content/marketing.ts";
import { SEO_PAGE_DEFS } from "../src/content/seo-pages.ts";
import { FOR_PAGES, VS_PAGES } from "../src/content/hubs.ts";
import {
  LEGAL_PAGES,
  buildSitemapEntries,
  renderSitemapXml,
} from "../src/content/sitemap.ts";
import { TOOL_EXPLAINERS } from "../src/content/tool-explainers.ts";
import { getRegistryEntry } from "../src/content/seo-registry.ts";
import {
  FOUNDER,
  MAIL_ARCHITECTURE,
  PRODUCT_ONE_PARAGRAPH,
  TARGET_CUSTOMER,
} from "../shared/product-facts.ts";
import {
  articleLd,
  breadcrumbLd,
  entityGraphLd,
  faqPageLd as faqLdShared,
  howToLd as howToLdShared,
  softwareApplicationLd as softwareLdShared,
  webApplicationToolLd,
  webPageLd,
} from "../src/lib/jsonld.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const clientDir = join(root, "dist", "client");
const publicDir = join(root, "public");
const templatePath = join(clientDir, "index.html");

type Page = {
  path: string;
  title: string;
  description: string;
  bodyHtml: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function faqLd(faqs: Array<{ q: string; a: string }>) {
  return faqLdShared(faqs);
}


function softwareLd() {
  return softwareLdShared();
}


function howToLd(name: string, description: string, steps: string[]) {
  return howToLdShared({ name, description, steps });
}


function articleShell(opts: {
  eyebrow?: string;
  h1: string;
  lede: string;
  definition?: string;
  sections?: Array<{ heading: string; body: string; bullets?: string[] }>;
  faqs?: Array<{ q: string; a: string }>;
  ctaHref?: string;
}): string {
  const parts: string[] = [];
  parts.push(`<article style="max-width:42rem;margin:0 auto;padding:2rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.55;color:#141413">`);
  parts.push(`<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#F26522">${esc(opts.eyebrow || "Flap · useflap.online")}</p>`);
  parts.push(`<h1 style="font-size:1.85rem;line-height:1.2;margin:0.75rem 0 1rem">${esc(opts.h1)}</h1>`);
  if (opts.definition) {
    parts.push(`<p style="padding:0.85rem 1rem;background:#f0efeb;border-radius:8px"><strong>In short:</strong> ${esc(opts.definition)}</p>`);
  }
  parts.push(`<p>${esc(opts.lede)}</p>`);
  for (const section of opts.sections || []) {
    parts.push(`<h2 style="font-size:1.15rem;margin:1.75rem 0 0.5rem">${esc(section.heading)}</h2>`);
    parts.push(`<p>${esc(section.body)}</p>`);
    if (section.bullets?.length) {
      parts.push("<ul>");
      for (const b of section.bullets) parts.push(`<li>${esc(b)}</li>`);
      parts.push("</ul>");
    }
  }
  if (opts.faqs?.length) {
    parts.push(`<h2 style="font-size:1.15rem;margin:1.75rem 0 0.5rem">FAQ</h2>`);
    for (const f of opts.faqs) {
      parts.push(`<h3 style="font-size:1rem;margin:1rem 0 0.35rem">${esc(f.q)}</h3>`);
      parts.push(`<p>${esc(f.a)}</p>`);
    }
  }
  parts.push(`<p style="margin-top:2rem"><a href="${esc(opts.ctaHref || "/signup")}">Start free with Flap</a> · <a href="/">Home</a> · <a href="/#pricing">Pricing</a></p>`);
  parts.push("</article>");
  return parts.join("\n");
}

const HOME_FAQS = [
  {
    q: "Can I use multiple domains in one inbox?",
    a: `Yes. Free includes ${PLANS.free.limits.domains} domains. Solo, Pro, Team, and Scale each include up to ${PLANS.solo.limits.domains} custom domains in one Flap inbox.`,
  },
  {
    q: "When I reply, which email address does Flap send from?",
    a: "Reply uses the mailbox that received the message. Compose shows that From address before you send; you can change it for that reply.",
  },
  {
    q: "Does Flap use Amazon SES?",
    a: "Yes. Customer mail runs on Amazon SES. The Flap app runs on Cloudflare. See /why-not-amazon-ses for build-vs-buy.",
  },
  {
    q: "Can I export if I leave?",
    a: "Yes. JSON workspace backup and per-mailbox .mbox from Settings. See /migrate for cutover narrative.",
  },
];

function buildPages(): Page[] {
  const pages: Page[] = [];

  pages.push({
    path: "/",
    title: MARKETING.seo_title,
    description: MARKETING.seo_description,
    bodyHtml: articleShell({
      h1: MARKETING.primary_tagline,
      lede: MARKETING.hero_subheadline,
      definition: MARKETING.short_description,
      sections: [
        {
          heading: "Built for multi-domain founders",
          body: MARKETING.long_description,
          bullets: [...MARKETING.key_features],
        },
        {
          heading: "Pricing",
          body: `Capacity-based plans at ${SITE_URL}/pricing: Free $${PLANS.free.price_monthly}, Solo $${PLANS.solo.price_monthly}/mo (${PLANS.solo.limits.domains} domains), Pro $${PLANS.pro.price_monthly}/mo, Team $${PLANS.team.price_monthly}/mo. Upgrade for mailboxes and seats — not a different product.`,
        },
        {
          heading: "Trust",
          body: `Architecture, export, and policies: ${SITE_URL}/security, ${SITE_URL}/status, ${SITE_URL}/migrate, ${SITE_URL}/about.`,
        },
      ],
      faqs: HOME_FAQS,
    }),
    jsonLd: [softwareLd(), faqLd(HOME_FAQS)],
  });

  for (const page of Object.values(SEO_PAGE_DEFS)) {
    const schemas: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: page.title,
        description: page.description,
        url: `${SITE_URL}${page.path}`,
        dateModified: page.updated,
        isPartOf: { "@type": "WebSite", name: "Flap", url: SITE_URL },
        about: { "@type": "SoftwareApplication", name: "Flap", url: SITE_URL },
      },
      softwareLd(),
    ];
    if (page.faqs.length) schemas.push(faqLd(page.faqs));
    pages.push({
      path: page.path,
      title: page.title,
      description: page.description,
      bodyHtml: articleShell({
        h1: page.h1,
        lede: page.lede,
        definition: page.definition,
        sections: page.sections,
        faqs: page.faqs,
      }),
      jsonLd: schemas,
    });
  }

  for (const guide of GUIDE_PAGES) {
    const body = GUIDE_CONTENT[guide.provider];
    if (!body) continue;
    const schemas: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: guide.title,
        description: guide.description,
        url: `${SITE_URL}${guide.path}`,
        dateModified: body.updated,
      },
      howToLd(body.heading, body.definition, body.steps),
      softwareLd(),
    ];
    if (body.faqs.length) schemas.push(faqLd(body.faqs));
    pages.push({
      path: guide.path,
      title: guide.title,
      description: guide.description,
      bodyHtml: articleShell({
        h1: body.heading,
        lede: body.intro,
        definition: body.definition,
        sections: [
          { heading: "Steps", body: body.records_note, bullets: body.steps },
          { heading: "Common mistakes", body: body.verification, bullets: body.mistakes },
        ],
        faqs: body.faqs,
      }),
      jsonLd: schemas,
    });
  }

  for (const tool of TOOL_PAGES) {
    const explainer = TOOL_EXPLAINERS[tool.path];
    const sections = explainer
      ? [
          { heading: "What this tool checks", body: explainer.whatItChecks },
          {
            heading: "How to interpret results",
            body: "Use these states as guidance only — DNS checks do not guarantee inbox placement.",
            bullets: explainer.interpret.map((r) => `${r.state}: ${r.meaning}`),
          },
          {
            heading: "Examples",
            body: "Correct and incorrect patterns:",
            bullets: explainer.examples.map((e) => `${e.label}: ${e.body}`),
          },
          {
            heading: "Common errors",
            body: "Safe remedies:",
            bullets: explainer.commonErrors.map((e) => `${e.error} — ${e.fix}`),
          },
        ]
      : undefined;
    pages.push({
      path: tool.path,
      title: tool.title,
      description: tool.description,
      bodyHtml: articleShell({
        h1: tool.title.replace(" | Flap", ""),
        lede: explainer?.answerFirst || tool.description,
        definition:
          explainer?.answerFirst ||
          `${tool.description} Free DNS / cost tools from Flap (useflap.online). Passing checks does not guarantee delivery.`,
        sections,
        faqs: explainer?.faqs,
      }),
      jsonLd: [
        webApplicationToolLd({
          name: tool.title.replace(" | Flap", ""),
          path: tool.path,
          description: tool.description,
        }),
        softwareLd(),
        ...(explainer?.faqs?.length ? [faqLd(explainer.faqs)] : []),
      ],
    });
  }

  pages.push({
    path: BLOG_INDEX.path,
    title: BLOG_INDEX.title,
    description: BLOG_INDEX.description,
    bodyHtml: articleShell({
      h1: "Flap blog",
      lede: BLOG_INDEX.description,
      sections: [
        {
          heading: "Posts",
          body: "Practical writing on multi-domain email, Workspace cost, and DNS.",
          bullets: BLOG_POSTS.map((p) => `${p.h1} (${p.path})`),
        },
      ],
    }),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: BLOG_INDEX.title,
        description: BLOG_INDEX.description,
        url: `${SITE_URL}${BLOG_INDEX.path}`,
        publisher: { "@type": "Organization", name: "Flap", url: SITE_URL },
      },
      softwareLd(),
    ],
  });

  for (const post of BLOG_POSTS) {
    const schemas: Record<string, unknown>[] = [
      entityGraphLd([
        articleLd({
          path: post.path,
          title: post.h1,
          description: post.description,
          datePublished: post.published,
          dateModified: post.updated,
        }),
        softwareLd(),
      ]),
    ];
    if (post.faqs.length) schemas.push(faqLd(post.faqs));
    pages.push({
      path: post.path,
      title: post.title,
      description: post.description,
      bodyHtml: articleShell({
        h1: post.h1,
        lede: post.lede,
        definition: post.definition,
        sections: post.sections,
        faqs: post.faqs,
      }),
      jsonLd: schemas,
    });
  }

  for (const legal of LEGAL_PAGES) {
    pages.push({
      path: legal.path,
      title: legal.title,
      description: legal.description,
      bodyHtml: articleShell({
        eyebrow: "Legal · Flap",
        h1: legal.title.replace(" | Flap", ""),
        lede: legal.description,
        definition: `Official ${legal.title.replace(" | Flap", "")} for Flap at useflap.online. Last updated ${legal.lastmod}. Contact ${SUPPORT_EMAIL}.`,
        ctaHref: "/",
      }),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: legal.title,
        description: legal.description,
        url: `${SITE_URL}${legal.path}`,
        dateModified: legal.lastmod,
        isPartOf: { "@type": "WebSite", name: "Flap", url: SITE_URL },
      },
    });
  }

  pages.push({
    path: API_DOCS.path,
    title: API_DOCS.title,
    description: API_DOCS.description,
    bodyHtml: articleShell({
      eyebrow: "Docs · Developers",
      h1: API_DOCS.h1,
      lede: API_DOCS.lede,
      definition:
        "Flap send API and inbound webhooks for Solo and above. Create keys in Settings → Developers.",
      sections: [
        {
          heading: "POST /api/v1/send",
          body: `Authorize with Authorization: Bearer flap_…. Body fields: ${Object.keys(API_SEND.body).join(", ")}. Success: ${API_SEND.success}`,
          bullets: API_SEND.notes,
        },
        {
          heading: "Webhooks",
          body: "Inbound event delivery is documented at /docs/webhooks.",
          bullets: [
            ...WEBHOOK_DOCS.events.map((e) => `${e.name}: ${e.description}`),
            `Plan limits — Solo ${PLANS.solo.limits.api_keys} keys / ${PLANS.solo.limits.webhooks} webhooks; Pro ${PLANS.pro.limits.api_keys}/${PLANS.pro.limits.webhooks}; Team ${PLANS.team.limits.api_keys}/${PLANS.team.limits.webhooks}.`,
          ],
        },
      ],
    }),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: API_DOCS.h1,
      description: API_DOCS.description,
      url: `${SITE_URL}${API_DOCS.path}`,
      dateModified: API_DOCS.updated,
      author: { "@type": "Organization", name: "Flap", url: SITE_URL },
      publisher: { "@type": "Organization", name: "Flap", url: SITE_URL },
    },
  });

  pages.push({
    path: "/tools",
    title: "Free email DNS & deliverability tools | Flap",
    description: "MX, SPF, DMARC, DKIM, headers, scorecards, and more — free tools for custom-domain email.",
    bodyHtml: articleShell({
      eyebrow: "Tools",
      h1: "Free email DNS & deliverability tools",
      lede: "Check MX, SPF, DMARC, and more before you cut over — or while debugging deliverability.",
      definition: "Free public DNS and deliverability tools from Flap (useflap.online).",
      sections: [
        {
          heading: "Tool index",
          body: "Open any checker below, then finish setup in Flap when you want a real inbox.",
          bullets: TOOL_PAGES.map((t) => `${t.title.replace(" | Flap", "")} (${t.path})`),
        },
      ],
      ctaHref: "/signup",
    }),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Flap tools",
        description: "Free DNS and deliverability tools for custom-domain email.",
        url: `${SITE_URL}/tools`,
      },
      softwareLd(),
    ],
  });

  pages.push({
    path: "/pricing",
    title: "Pricing | Flap — custom-domain email",
    description: `Free $${PLANS.free.price_monthly}, Solo $${PLANS.solo.price_monthly}/mo (${PLANS.solo.limits.domains} domains), Pro $${PLANS.pro.price_monthly}/mo, Team $${PLANS.team.price_monthly}/mo. Annual = 10× monthly (2 months free).`,
    bodyHtml: articleShell({
      eyebrow: "Pricing",
      h1: "Transparent email hosting pricing",
      lede: "Up to 50 domains on every paid plan. Upgrade for mailboxes, seats, and send capacity — not a different product.",
      definition: MARKETING.short_description,
      sections: PLAN_ORDER.map((id) => ({
        heading: `${PLANS[id].name} — $${PLANS[id].price_monthly}${PLANS[id].price_monthly ? "/mo" : ""}`,
        body: PLANS[id].blurb,
        bullets: PLANS[id].features,
      })),
      faqs: [
        {
          q: "Why upgrade if every paid plan has 50 domains?",
          a: "You upgrade for mailboxes, team seats, storage, and monthly send caps — capacity for the same product surface.",
        },
        {
          q: "Can I cancel anytime?",
          a: "Yes. You keep access through the paid period. Export JSON or .mbox from Settings before it ends.",
        },
        {
          q: "Do you offer IMAP/SMTP today?",
          a: "Not yet. Use the web app and PWA.",
        },
      ],
      ctaHref: "/signup",
    }),
    jsonLd: [softwareLd(), faqLd([
      {
        q: "Why upgrade if every paid plan has 50 domains?",
        a: "You upgrade for mailboxes, team seats, storage, and monthly send caps.",
      },
    ])],
  });

  pages.push({
    path: "/docs",
    title: "Docs | Flap",
    description: "Developer documentation for Flap domains, send API, and inbound webhooks.",
    bodyHtml: articleShell({
      eyebrow: "Docs",
      h1: "Flap docs",
      lede: "Custom-domain email for founders. Public guides for setup, API send, and webhooks.",
      sections: [
        {
          heading: "Start here",
          body: "Pick a path based on what you need next.",
          bullets: [
            "Getting started: /docs/getting-started",
            "Core concepts: /docs/concepts",
            "Webhooks: /docs/webhooks",
            "API overview: /docs/api",
          ],
        },
      ],
      ctaHref: "/docs/getting-started",
    }),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Flap docs",
      url: `${SITE_URL}/docs`,
    },
  });

  pages.push({
    path: "/docs/getting-started",
    title: "Getting started | Flap Docs",
    description: "Add a domain, publish SES DNS, create a mailbox, and send your first Flap email.",
    bodyHtml: articleShell({
      eyebrow: "Docs",
      h1: "Getting started",
      lede: "From zero to a working @yourdomain.com address.",
      sections: [
        {
          heading: "Checklist",
          body: "Add domain → publish DNS → wait for verification → create mailbox → send and receive a test.",
          bullets: ["DNS guides: /guides", "In-app checklist: /app/get-started"],
        },
      ],
      ctaHref: "/signup",
    }),
  });

  pages.push({
    path: "/docs/concepts",
    title: "Core concepts | Flap Docs",
    description: "Domains, mailboxes, live vs test API keys, and plan limits on Flap.",
    bodyHtml: articleShell({
      eyebrow: "Docs",
      h1: "Core concepts",
      lede: "The smallest vocabulary you need before calling the API or wiring webhooks.",
      sections: [
        {
          heading: "Building blocks",
          body: "Domain authenticates SES. Mailbox is a local-part. API keys are live or test.",
        },
      ],
    }),
  });

  pages.push({
    path: "/docs/webhooks",
    title: "Webhooks | Flap Docs",
    description: "Receive mail.received webhooks from Flap with SHA-256 signature verification.",
    bodyHtml: articleShell({
      eyebrow: "Docs",
      h1: "Webhooks",
      lede: WEBHOOK_DOCS.verifyNote,
      sections: [
        {
          heading: "Events and headers",
          body: "HTTPS POST with x-flap-event and x-flap-signature.",
          bullets: [
            ...WEBHOOK_DOCS.events.map((e) => `${e.name}: ${e.description}`),
            ...WEBHOOK_DOCS.headers.map((h) => `${h.name}: ${h.value}`),
            ...WEBHOOK_DOCS.notes,
          ],
        },
      ],
    }),
  });

  pages.push({
    path: "/guides",
    title: "DNS setup guides | Flap",
    description: "Publish Amazon SES MX/SPF/DKIM for Flap at common DNS hosts.",
    bodyHtml: articleShell({
      eyebrow: "Guides",
      h1: "DNS setup guides",
      lede: "Point registrar DNS at Amazon SES with the records Flap shows in Settings → Setup.",
      sections: [
        {
          heading: "Providers",
          body: "Cloudflare Email Routing is not required for the current SES path.",
          bullets: GUIDE_PAGES.map((g) => `${g.title.replace(" | Flap", "")} (${g.path})`),
        },
      ],
    }),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Flap DNS guides",
      url: `${SITE_URL}/guides`,
    },
  });

  pages.push({
    path: "/support",
    title: "Support | Flap",
    description: `Contact Flap support at ${SUPPORT_EMAIL}.`,
    bodyHtml: articleShell({
      eyebrow: "Support",
      h1: "Get help",
      lede: `Email ${SUPPORT_EMAIL} for billing, DNS cutover, or account issues.`,
      ctaHref: `mailto:${SUPPORT_EMAIL}`,
    }),
  });

  pages.push({
    path: "/status",
    title: "Status | Flap",
    description: "Live health check for Flap (useflap.online).",
    bodyHtml: articleShell({
      eyebrow: "Status",
      h1: "Flap status",
      lede: "Public probe against /api/health. Not a full incident timeline.",
      definition: "Check https://useflap.online/api/health for JSON ok status.",
    }),
  });



  // Shipmail-inspired marketing hubs (/security, /for, /vs, /research + children)
  pages.push({
    path: "/security",
    title: "Security | Flap",
    description:
      "How Flap handles privacy, export, TLS, and mail infrastructure. Amazon SES for your domains. Cloudflare for the app.",
    bodyHtml: articleShell({
      eyebrow: "Security",
      h1: "Privacy and security",
      lede: "Precise statements we can keep. No bank-grade vagueness. Amazon SES for your domains. Cloudflare for the app.",
      definition:
        "Flap does not scan mail for ads. Customer mail runs on Amazon SES; the app on Cloudflare. No invented certifications.",
      sections: [
        {
          heading: "Architecture",
          body: `${MAIL_ARCHITECTURE.inbound_flow}. ${MAIL_ARCHITECTURE.outbound_flow}. ${MAIL_ARCHITECTURE.app_host}.`,
        },
        {
          heading: "Encryption",
          body: "TLS in transit. Encryption at rest via Cloudflare D1/R2 and SES storage. Not end-to-end encrypted mailboxes.",
        },
        {
          heading: "Auth and access",
          body: "Clerk authentication. Workspace-scoped mailboxes. HMAC-signed webhooks. API keys shown once.",
        },
        {
          heading: "AI behavior",
          body: "Opt-in where offered. Confirm before send — never silent delivery.",
        },
        {
          heading: "Export and leave",
          body: "JSON and .mbox from Settings. Paid accounts keep an export window after cancel.",
        },
        {
          heading: "Abuse and incidents",
          body: `Report to ${SUPPORT_EMAIL}. We do not claim SOC 2 or ISO 27001.`,
        },
      ],
    }),
    jsonLd: webPageLd({
      path: "/security",
      title: "Security | Flap",
      description: "Honest security and privacy commitments for Flap custom-domain email.",
      dateModified: "2026-09-08",
    }),
  });

  pages.push({
    path: "/migrate",
    title: "Migrate to Flap | Custom-domain email cutover",
    description:
      "Verify DNS first, test send, switch MX, rollback, and export. Honest migration narrative for custom-domain email.",
    bodyHtml: articleShell({
      eyebrow: "Migration",
      h1: "Migrate to Flap without guessing the MX cutover",
      lede: "Verify the domain in Flap and test send/receive before you change MX.",
      definition:
        "Flap exports .mbox and JSON; it does not silently IMAP-import your old provider today.",
      sections: [
        {
          heading: "Cutover steps",
          body: "Add and verify domain → create addresses and test outbound → optional archive export from old provider → switch MX → rollback by restoring old MX if needed → export anytime from Flap.",
          bullets: [
            "MX only moves email; website DNS is separate",
            "Cloudflare Email Routing domains can migrate to the SES path from Settings",
            "See /guides for registrar-specific DNS",
          ],
        },
      ],
      ctaHref: "/signup",
    }),
    jsonLd: webPageLd({
      path: "/migrate",
      title: "Migrate to Flap",
      description: "Domain-first migration narrative for custom-domain email cutover.",
      dateModified: "2026-09-08",
    }),
  });

  pages.push({
    path: "/why-not-amazon-ses",
    title: "Why not Amazon SES alone? | Flap",
    description:
      "Flap uses Amazon SES for customer mail. The product layer adds inbox, identities, reply-from, and onboarding.",
    bodyHtml: articleShell({
      eyebrow: "Build vs buy",
      h1: "Why not use Amazon SES directly?",
      lede: "SES is the mail pipe. Flap is the multi-domain inbox product on top.",
      definition:
        "We use SES on purpose — this is build-vs-buy, not an attack on AWS.",
      sections: [
        {
          heading: "What Flap adds",
          body: "Guided DNS, mailboxes, inbox UI, reply-from identity, aliases, team workflows, API, and export.",
        },
        {
          heading: "When to use SES alone",
          body: "When you are building your own mail product or already have inbox and identity infrastructure.",
        },
      ],
    }),
    jsonLd: webPageLd({
      path: "/why-not-amazon-ses",
      title: "Why not Amazon SES alone?",
      description: "Build-vs-buy: SES as the pipe, Flap as multi-domain inbox product.",
      dateModified: "2026-09-08",
    }),
  });

  pages.push({
    path: "/demo",
    title: "Interactive demo | Flap",
    description:
      "Try Flap’s multi-domain inbox without signing up: open a message and see reply From lock to the receiving domain.",
    bodyHtml: articleShell({
      eyebrow: "Demo",
      h1: "One inbox. Correct From on reply.",
      lede: "Fake domains and messages only — nothing is sent. Open the live demo in the app to try reply-from locking.",
      definition: "Front-end-only walkthrough of multi-domain receive → reply with locked From.",
      sections: [
        {
          heading: "What you will see",
          body: "Three fake product domains in one inbox. Reply locks Sending as to the address that received the mail.",
        },
      ],
      ctaHref: "/demo",
    }),
    jsonLd: webPageLd({
      path: "/demo",
      title: "Interactive demo | Flap",
      description: "No-signup demo of Flap reply-from identity.",
      dateModified: "2026-09-09",
    }),
  });

  pages.push({
    path: "/changelog",
    title: "Changelog | Flap",
    description: "Product updates for Flap — multi-domain custom email inbox.",
    bodyHtml: articleShell({
      eyebrow: "Changelog",
      h1: "What shipped",
      lede: "Concise product notes with real dates. For live health, see /status.",
      sections: [
        {
          heading: "2026-09-09 — Security & multi-domain hardening",
          body: "Workspace-scoped suppressions, inbound failure breadcrumbs, HTML email sanitization, deliverability event visibility.",
        },
        {
          heading: "2026-09-08 — Positioning",
          body: "Homepage centered on multi-domain → one inbox → correct reply-from. Public /migrate and /why-not-amazon-ses.",
        },
      ],
      ctaHref: "/signup",
    }),
    jsonLd: webPageLd({
      path: "/changelog",
      title: "Changelog | Flap",
      description: "Flap product changelog.",
      dateModified: "2026-09-09",
    }),
  });

  pages.push({
    path: "/for",
    title: "Flap for your role | Flap",
    description:
      "ICP pages for indie hackers, startups, freelancers, developers, agencies, ecommerce, and creators.",
    bodyHtml: articleShell({
      eyebrow: "For",
      h1: "Flap for your role",
      lede: "Pick the page that matches how you work.",
      sections: [
        {
          heading: "Roles",
          body: "Dedicated landing pages for each ICP.",
          bullets: FOR_PAGES.map((p) => `${p.h1} (${p.path})`),
        },
      ],
    }),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Flap for your role",
      url: `${SITE_URL}/for`,
    },
  });

  pages.push({
    path: "/vs",
    title: "Compare Flap | Flap",
    description:
      "Compare Flap with Google Workspace, Shipmail, Hydra, Folio, Zoho, and more.",
    bodyHtml: articleShell({
      eyebrow: "Compare",
      h1: "Compare Flap",
      lede: "Honest comparisons for multi-domain founders.",
      sections: [
        {
          heading: "Comparisons",
          body: "Side-by-side pages vs common alternatives.",
          bullets: VS_PAGES.map((p) => `${p.h1} (${p.path})`),
        },
      ],
    }),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Compare Flap",
      url: `${SITE_URL}/vs`,
    },
  });

  pages.push({
    path: "/research",
    title: "Business email cost research | Flap",
    description:
      "Methodology and 2026 cost table for Workspace, Shipmail sticker prices, and Flap plans.",
    bodyHtml: articleShell({
      eyebrow: "Research",
      h1: "Business email cost, 2026",
      lede:
        "Illustrative USD list prices for founders comparing suites vs email-only hosts. Shipmail figures cited from shipmail.to/pricing (verified 2026-09-07). Flap figures from shared/plans.ts.",
      sections: [
        {
          heading: "Entry paid sticker prices",
          body: "Compare sticker prices only. Deliverability, protocol support, and suite apps change total cost of ownership.",
          bullets: [
            "Google Workspace — ~$7/user/mo (scales by seats × environments)",
            "Shipmail Solo — $4/mo (2 mailboxes; up to 50 domains)",
            `Flap Solo — $${PLANS.solo.price_monthly}/mo (${PLANS.solo.limits.domains} domains, ${PLANS.solo.limits.mailboxes} mailboxes)`,
            `Flap Pro — $${PLANS.pro.price_monthly}/mo (highlighted; ${PLANS.pro.limits.team_seats} seats)`,
            `Flap Team — $${PLANS.team.price_monthly}/mo (${PLANS.team.limits.domains} domains, shared inboxes)`,
          ],
        },
        {
          heading: "Methodology",
          body: "Compare sticker prices only. Flap does not claim Shipmail's IMAP/newsletter surface until those flags flip. Use /tools/google-workspace-cost-calculator for interactive math.",
        },
      ],
    }),
    jsonLd: webPageLd({
      path: "/research",
      title: "Business email cost research | Flap",
      description: "2026 cost table comparing Workspace, Shipmail sticker prices, and Flap plans.",
      dateModified: "2026-09-07",
    }),
  });

  for (const hub of [...FOR_PAGES, ...VS_PAGES]) {
    pages.push({
      path: hub.path,
      title: hub.title,
      description: hub.description,
      bodyHtml: articleShell({
        eyebrow: hub.path.startsWith("/for") ? "For" : "Compare",
        h1: hub.h1,
        lede: hub.description,
        definition: hub.body[0],
        sections: [
          {
            heading: "Why Flap",
            body: hub.body.slice(1).join(" ") || hub.body[0],
            bullets: hub.body,
          },
        ],
      }),
      jsonLd: webPageLd({
        path: hub.path,
        title: hub.title,
        description: hub.description,
        dateModified: "2026-09-07",
      }),
    });
  }

  pages.push({
    path: "/about",
    title: "About Flap — custom-domain email for founders",
    description:
      "What Flap is, who builds it, how mail runs on Amazon SES, and how to contact support@useflap.online.",
    bodyHtml: articleShell({
      eyebrow: "About",
      h1: "About Flap",
      lede: PRODUCT_ONE_PARAGRAPH,
      definition: PRODUCT_ONE_PARAGRAPH,
      sections: [
        {
          heading: "Who it is for",
          body: TARGET_CUSTOMER,
        },
        {
          heading: "Who operates Flap",
          body: `Flap is founded and operated by ${FOUNDER.name}. On X: @${FOUNDER.xHandle} (${FOUNDER.xUrl}).`,
        },
        {
          heading: "Infrastructure",
          body: MAIL_ARCHITECTURE.dns_note,
          bullets: [
            `Inbound: ${MAIL_ARCHITECTURE.inbound_flow}`,
            `Outbound: ${MAIL_ARCHITECTURE.outbound_flow}`,
            `App: ${MAIL_ARCHITECTURE.app_host}`,
            MAIL_ARCHITECTURE.system_mail_note,
          ],
        },
        {
          heading: "Contact",
          body: `Email ${SUPPORT_EMAIL}. Policies: /privacy, /terms, /billing-terms. Docs: /docs. Status: /status.`,
        },
      ],
    }),
    jsonLd: entityGraphLd([
      webPageLd({
        path: "/about",
        title: "About Flap",
        description: PRODUCT_ONE_PARAGRAPH,
        dateModified: "2026-09-07",
      }),
      softwareLd(),
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]),
    ]),
  });

  return pages;
}

function upsertMeta(
  html: string,
  attr: "name" | "property",
  key: string,
  content: string,
): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, "i");
  const tag = `<meta ${attr}="${key}" content="${esc(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `    ${tag}\n  </head>`);
}

function injectPage(template: string, page: Page): string {
  let html = template;
  const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
  const reg = getRegistryEntry(page.path);
  const ogImagePath = reg?.ogImagePath || "/og.png";
  const ogImage = `${SITE_URL}${ogImagePath}`;
  const ogType = ogImagePath.endsWith(".svg") ? "image/svg+xml" : "image/png";

  // Idempotent: strip prior prerender JSON-LD when re-running against dist/client.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");

  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(page.title)}</title>`);
  html = upsertMeta(html, "name", "description", page.description);
  html = upsertMeta(html, "property", "og:type", "website");
  html = upsertMeta(html, "property", "og:site_name", "Flap Email");
  html = upsertMeta(html, "property", "og:title", page.title);
  html = upsertMeta(html, "property", "og:description", page.description);
  html = upsertMeta(html, "property", "og:url", url);
  html = upsertMeta(html, "property", "og:image", ogImage);
  html = upsertMeta(html, "property", "og:image:width", "1200");
  html = upsertMeta(html, "property", "og:image:height", "630");
  html = upsertMeta(html, "property", "og:image:type", ogType);
  html = upsertMeta(html, "name", "twitter:card", "summary_large_image");
  html = upsertMeta(html, "name", "twitter:title", page.title);
  html = upsertMeta(html, "name", "twitter:description", page.description);
  html = upsertMeta(html, "name", "twitter:image", ogImage);

  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${esc(url)}" />`,
  );

  const ld = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>\n`
    : "";
  html = html.replace("</head>", `${ld}</head>`);

  const rootInner = `${page.bodyHtml}\n<!-- prerender shell — React replaces #root on mount -->`;
  if (!/<div id="root">/i.test(html)) {
    throw new Error(`No #root in SPA shell for ${page.path}`);
  }
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">\n${rootInner}\n    </div>`);

  return html;
}

function writePage(page: Page, html: string) {
  const outPath =
    page.path === "/"
      ? join(clientDir, "index.html")
      : join(clientDir, page.path.replace(/^\//, ""), "index.html");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  return outPath;
}

function writeSitemap() {
  const entries = buildSitemapEntries();
  const xml = renderSitemapXml(entries);
  writeFileSync(join(publicDir, "sitemap.xml"), xml);
  writeFileSync(join(clientDir, "sitemap.xml"), xml);
  return entries.length;
}

function main() {
  if (!existsSync(templatePath)) {
    console.error(`Missing ${templatePath}. Run vite build first.`);
    process.exit(1);
  }
  const template = readFileSync(templatePath, "utf8");
  // Preserve a blank SPA shell for Worker serveSpaShell (/app, /login, …).
  // Prerender overwrites index.html with Landing HTML; Assets also 307s
  // /index.html → /, so the Worker must not fetch /index.html for SPA routes.
  writeFileSync(join(clientDir, "spa-shell.html"), template);
  console.log("Wrote dist/client/spa-shell.html (SPA shell for /app)");

  const pages = buildPages();
  for (const page of pages) {
    const html = injectPage(template, page);
    const out = writePage(page, html);
    console.log(`prerender ${page.path} → ${out.replace(root + "/", "")}`);
  }
  const sitemapCount = writeSitemap();
  for (const name of ["robots.txt", "llms.txt", "llms-full.txt", "og.png", "og.svg"]) {
    const src = join(publicDir, name);
    if (existsSync(src)) writeFileSync(join(clientDir, name), readFileSync(src));
  }
  if (existsSync(join(publicDir, "og"))) {
    cpSync(join(publicDir, "og"), join(clientDir, "og"), { recursive: true });
  }
  console.log(`Prerendered ${pages.length} marketing/SEO HTML shells.`);
  console.log(`Wrote sitemap.xml with ${sitemapCount} URLs (public/ + dist/client/).`);
}

main();
