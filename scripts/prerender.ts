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
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANS, PLAN_ORDER } from "../shared/plans.ts";
import { BLOG_POSTS } from "../src/content/blog.ts";
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
import {
  LEGAL_PAGES,
  buildSitemapEntries,
  renderSitemapXml,
} from "../src/content/sitemap.ts";

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
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function softwareLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: MARKETING.product_name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: MARKETING.short_description,
    offers: PLAN_ORDER.filter((id) => id !== "free").map((id) => ({
      "@type": "Offer",
      name: PLANS[id].name,
      price: String(PLANS[id].price_monthly),
      priceCurrency: "USD",
    })),
    publisher: {
      "@type": "Organization",
      name: "Flap",
      url: SITE_URL,
      email: SUPPORT_EMAIL,
    },
  };
}

function howToLd(name: string, description: string, steps: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
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
  parts.push(`<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#1c6e5c">${esc(opts.eyebrow || "Flap · useflap.online")}</p>`);
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
    q: "Who is Flap for?",
    a: "Indie hackers, serial founders, and small studios who own multiple domains and do not want a separate Workspace for every project.",
  },
  {
    q: "How many domains can I connect?",
    a: `Free includes ${PLANS.free.limits.domains}, Solo ${PLANS.solo.limits.domains}, Builder ${PLANS.builder.limits.domains}, Studio ${PLANS.studio.limits.domains}.`,
  },
  {
    q: "How does DNS / delivery work?",
    a: "Flap uses Cloudflare Email Routing. You add MX/SPF at your DNS host, then a Worker routing rule for each mailbox.",
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
          body: `Domain-first plans at ${SITE_URL}/#pricing: Free $${PLANS.free.price_monthly}, Solo $${PLANS.solo.price_monthly}/mo (${PLANS.solo.limits.domains} domains), Builder $${PLANS.builder.price_monthly}/mo (${PLANS.builder.limits.domains} domains), Studio $${PLANS.studio.price_monthly}/mo (${PLANS.studio.limits.domains} domains, team seats).`,
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
    pages.push({
      path: tool.path,
      title: tool.title,
      description: tool.description,
      bodyHtml: articleShell({
        h1: tool.title.replace(" | Flap", ""),
        lede: tool.description,
        definition: `${tool.description} Free DNS / cost tools from Flap (useflap.online).`,
      }),
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: tool.title.replace(" | Flap", ""),
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Web",
          url: `${SITE_URL}${tool.path}`,
          description: tool.description,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          provider: { "@type": "Organization", name: "Flap", url: SITE_URL },
        },
        softwareLd(),
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
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: post.h1,
        description: post.description,
        url: `${SITE_URL}${post.path}`,
        datePublished: post.published,
        dateModified: post.updated,
        author: { "@type": "Organization", name: "Flap", url: SITE_URL },
        publisher: { "@type": "Organization", name: "Flap", url: SITE_URL },
      },
      softwareLd(),
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

  return pages;
}

function injectPage(template: string, page: Page): string {
  let html = template;
  const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;

  // Idempotent: strip prior prerender JSON-LD when re-running against dist/client.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, "");

  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(page.title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${esc(page.description)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${esc(page.title)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${esc(page.description)}" />`,
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${esc(url)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
  );
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
  const pages = buildPages();
  for (const page of pages) {
    const html = injectPage(template, page);
    const out = writePage(page, html);
    console.log(`prerender ${page.path} → ${out.replace(root + "/", "")}`);
  }
  const sitemapCount = writeSitemap();
  console.log(`Prerendered ${pages.length} marketing/SEO HTML shells.`);
  console.log(`Wrote sitemap.xml with ${sitemapCount} URLs (public/ + dist/client/).`);
}

main();
