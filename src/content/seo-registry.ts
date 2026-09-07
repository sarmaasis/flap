/**
 * Central SEO registry for every indexable public route.
 * Sitemap and build-time validation consume this — do not maintain a parallel URL list.
 */
import { PLANS, PLAN_ORDER } from "../../shared/plans";
import { pricingOneLiner, SITE_URL } from "../../shared/product-facts";
import { BLOG_POSTS } from "./blog";
import { GUIDE_CONTENT } from "./guides";
import {
  BLOG_INDEX,
  GUIDE_PAGES,
  MARKETING,
  TOOL_PAGES,
} from "./marketing";
import { SEO_PAGE_DEFS } from "./seo-pages";
import { TOOL_EXPLAINERS } from "./tool-explainers";

export const LEGAL_PAGES = [
  {
    path: "/terms",
    title: "Terms of Service | Flap",
    description: "Terms of Service for Flap custom-domain email at useflap.online.",
    lastmod: "2026-09-04",
  },
  {
    path: "/privacy",
    title: "Privacy Policy | Flap",
    description: "Privacy Policy for Flap — how we handle account and mailbox data.",
    lastmod: "2026-09-04",
  },
  {
    path: "/billing-terms",
    title: "Billing Terms | Flap",
    description: "Billing Terms for Flap paid plans and renewals.",
    lastmod: "2026-09-04",
  },
] as const;

export type SeoPageType =
  | "home"
  | "pricing"
  | "product"
  | "comparison"
  | "guide"
  | "tool"
  | "blog"
  | "blog_index"
  | "docs"
  | "legal"
  | "support"
  | "status"
  | "about"
  | "collection";

export type SeoRegistryEntry = {
  path: string;
  title: string;
  description: string;
  canonicalPath: string;
  h1: string;
  pageType: SeoPageType;
  indexable: boolean;
  sitemap: boolean;
  ogType: string;
  ogImagePath: string;
  twitterCard: "summary_large_image";
  published?: string;
  modified: string;
  answerFirst?: string;
  /** Primary search intent (for cannibalization audits). */
  primaryIntent?: string;
};

export const PRIVATE_PATH_PREFIXES = [
  "/app",
  "/api",
  "/login",
  "/signup",
  "/setup",
  "/invite",
  "/settings",
  "/verify-email",
  "/sso-callback",
  "/auth/verify",
  "/forgot-password",
  "/reset-password",
] as const;

const SITE_MODIFIED = "2026-09-07";

function ogSlug(path: string): string {
  if (path === "/") return "home";
  return path.replace(/^\//, "").replace(/\//g, "--");
}

function ogPathFor(path: string): string {
  // PNG is required for major social crawlers (SVG OG images are widely unsupported).
  return `/og/${ogSlug(path)}.png`;
}

function entry(partial: Omit<SeoRegistryEntry, "canonicalPath" | "ogType" | "twitterCard" | "ogImagePath"> & {
  ogType?: string;
  ogImagePath?: string;
}): SeoRegistryEntry {
  return {
    canonicalPath: partial.path,
    ogType: partial.ogType || "website",
    twitterCard: "summary_large_image",
    ogImagePath: partial.ogImagePath || ogPathFor(partial.path),
    ...partial,
  };
}

export function buildSeoRegistry(): SeoRegistryEntry[] {
  const out: SeoRegistryEntry[] = [];

  out.push(
    entry({
      path: "/",
      title: MARKETING.seo_title,
      description: MARKETING.seo_description,
      h1: MARKETING.primary_tagline,
      pageType: "home",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
      answerFirst: MARKETING.short_description,
      primaryIntent: "product home / multi-domain email",
    }),
  );

  out.push(
    entry({
      path: "/pricing",
      title: "Pricing | Flap — domain-first custom-domain email",
      description: `Domain-first plans: ${pricingOneLiner()}. Annual −20%.`,
      h1: "Domain-first plans",
      pageType: "pricing",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
      answerFirst: `Flap pricing is domain-first: ${pricingOneLiner()}.`,
      primaryIntent: "pricing",
    }),
  );

  out.push(
    entry({
      path: "/about",
      title: "About Flap — custom-domain email for founders",
      description:
        "What Flap is, who builds it, how mail runs on Amazon SES, and how to contact support@useflap.online.",
      h1: "About Flap",
      pageType: "about",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
      answerFirst:
        "Flap is hosted custom-domain email for indie hackers and serial founders. Customer mail runs on Amazon SES; the app runs on Cloudflare.",
      primaryIntent: "company / trust entity",
    }),
  );

  out.push(
    entry({
      path: "/tools",
      title: "Free email DNS & deliverability tools | Flap",
      description: "MX, SPF, DMARC, DKIM, headers, scorecards, and more — free tools for custom-domain email.",
      h1: "Free email DNS & deliverability tools",
      pageType: "collection",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
      answerFirst: "Free public DNS and deliverability tools from Flap.",
    }),
  );

  out.push(
    entry({
      path: "/docs",
      title: "Docs | Flap",
      description: "Developer documentation for Flap API keys, send API, and inbound webhooks.",
      h1: "Flap documentation",
      pageType: "docs",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
    }),
  );

  out.push(
    entry({
      path: "/docs/api",
      title: "API & webhooks | Flap",
      description:
        "Send transactional email with Flap API keys (POST /api/v1/send) and receive mail.received webhooks with signature verification.",
      h1: "API & webhooks",
      pageType: "docs",
      indexable: true,
      sitemap: true,
      modified: "2026-09-06",
    }),
  );

  out.push(
    entry({
      path: "/guides",
      title: "DNS setup guides | Flap",
      description: "Publish Amazon SES MX/SPF/DKIM for Flap at common DNS hosts.",
      h1: "DNS setup guides",
      pageType: "collection",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
      answerFirst: "Point registrar DNS at Amazon SES with the records Flap shows in Settings → Setup.",
    }),
  );

  out.push(
    entry({
      path: "/support",
      title: "Support | Flap",
      description: "Contact Flap support at support@useflap.online.",
      h1: "Get help",
      pageType: "support",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
    }),
  );

  out.push(
    entry({
      path: "/status",
      title: "Status | Flap",
      description: "Live health check for Flap (useflap.online).",
      h1: "Flap status",
      pageType: "status",
      indexable: true,
      sitemap: true,
      modified: SITE_MODIFIED,
    }),
  );

  for (const page of Object.values(SEO_PAGE_DEFS)) {
    out.push(
      entry({
        path: page.path,
        title: page.title,
        description: page.description,
        h1: page.h1,
        pageType: page.comparison ? "comparison" : "product",
        indexable: true,
        sitemap: true,
        modified: page.updated,
        answerFirst: page.definition,
        primaryIntent: page.path,
      }),
    );
  }

  for (const guide of GUIDE_PAGES) {
    const body = GUIDE_CONTENT[guide.provider];
    out.push(
      entry({
        path: guide.path,
        title: guide.title,
        description: guide.description,
        h1: body?.heading || guide.title,
        pageType: "guide",
        indexable: true,
        sitemap: true,
        modified: body?.updated || SITE_MODIFIED,
        answerFirst: body?.definition,
        primaryIntent: `DNS setup ${guide.provider}`,
      }),
    );
  }

  for (const tool of TOOL_PAGES) {
    const explainer = TOOL_EXPLAINERS[tool.path];
    out.push(
      entry({
        path: tool.path,
        title: tool.title,
        description: tool.description,
        h1: tool.title.replace(" | Flap", ""),
        pageType: "tool",
        indexable: true,
        sitemap: true,
        modified: explainer?.updated || SITE_MODIFIED,
        answerFirst: explainer?.answerFirst || tool.description,
        primaryIntent: `tool ${tool.path}`,
      }),
    );
  }

  out.push(
    entry({
      path: BLOG_INDEX.path,
      title: BLOG_INDEX.title,
      description: BLOG_INDEX.description,
      h1: "Flap blog",
      pageType: "blog_index",
      indexable: true,
      sitemap: true,
      modified: BLOG_POSTS.reduce((max, p) => (p.updated > max ? p.updated : max), SITE_MODIFIED),
    }),
  );

  for (const post of BLOG_POSTS) {
    out.push(
      entry({
        path: post.path,
        title: post.title,
        description: post.description,
        h1: post.h1,
        pageType: "blog",
        indexable: true,
        sitemap: true,
        published: post.published,
        modified: post.updated,
        answerFirst: post.definition,
        ogType: "article",
      }),
    );
  }

  for (const legal of LEGAL_PAGES) {
    out.push(
      entry({
        path: legal.path,
        title: legal.title,
        description: legal.description,
        h1: legal.title.replace(" | Flap", ""),
        pageType: "legal",
        indexable: true,
        sitemap: true,
        modified: legal.lastmod,
      }),
    );
  }

  return out;
}

let _cache: SeoRegistryEntry[] | null = null;

export function getSeoRegistry(): SeoRegistryEntry[] {
  if (!_cache) _cache = buildSeoRegistry();
  return _cache;
}

export function getRegistryEntry(path: string): SeoRegistryEntry | undefined {
  return getSeoRegistry().find((e) => e.path === path);
}

export function indexableRegistryEntries(): SeoRegistryEntry[] {
  return getSeoRegistry().filter((e) => e.indexable && e.sitemap);
}

export function absoluteCanonical(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path}`;
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Visible pricing snippets that must match PLANS — used by validation. */
export function expectedPricingSnippets(): string[] {
  return PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return p.price_monthly === 0
      ? `${p.name}`
      : `$${p.price_monthly}`;
  });
}
