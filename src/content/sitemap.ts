/**
 * Canonical list of public, indexable URLs for sitemap.xml.
 * Keep in sync with App routes + prerender (scripts/prerender.ts).
 * Do not include auth, app, or API paths.
 */
import { BLOG_POSTS } from "./blog";
import { GUIDE_CONTENT } from "./guides";
import {
  BLOG_INDEX,
  GUIDE_PAGES,
  SITE_URL,
  TOOL_PAGES,
} from "./marketing";
import { SEO_PAGE_DEFS } from "./seo-pages";

export type SitemapEntry = {
  path: string;
  lastmod: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

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

/** Site-wide content freshness for pages without their own updated field. */
const SITE_UPDATED = "2026-09-06";

export function buildSitemapEntries(): SitemapEntry[] {
  const entries: SitemapEntry[] = [];

  entries.push({
    path: "/",
    lastmod: SITE_UPDATED,
    changefreq: "weekly",
    priority: "1.0",
  });

  entries.push({
    path: "/tools",
    lastmod: SITE_UPDATED,
    changefreq: "weekly",
    priority: "0.8",
  });

  for (const page of Object.values(SEO_PAGE_DEFS)) {
    entries.push({
      path: page.path,
      lastmod: page.updated,
      changefreq: "monthly",
      priority: page.comparison ? "0.85" : "0.8",
    });
  }

  for (const guide of GUIDE_PAGES) {
    const body = GUIDE_CONTENT[guide.provider];
    entries.push({
      path: guide.path,
      lastmod: body?.updated || SITE_UPDATED,
      changefreq: "monthly",
      priority: "0.75",
    });
  }

  for (const tool of TOOL_PAGES) {
    entries.push({
      path: tool.path,
      lastmod: SITE_UPDATED,
      changefreq: "monthly",
      priority: "0.7",
    });
  }

  const blogLast =
    BLOG_POSTS.reduce((max, p) => (p.updated > max ? p.updated : max), SITE_UPDATED);
  entries.push({
    path: BLOG_INDEX.path,
    lastmod: blogLast,
    changefreq: "weekly",
    priority: "0.75",
  });

  for (const post of BLOG_POSTS) {
    entries.push({
      path: post.path,
      lastmod: post.updated,
      changefreq: "monthly",
      priority: "0.7",
    });
  }

  for (const legal of LEGAL_PAGES) {
    entries.push({
      path: legal.path,
      lastmod: legal.lastmod,
      changefreq: "yearly",
      priority: "0.3",
    });
  }

  return entries;
}

export function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path}`;
}

export function renderSitemapXml(entries: SitemapEntry[] = buildSitemapEntries()): string {
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
  ];
  for (const e of entries) {
    lines.push("  <url>");
    lines.push(`    <loc>${absoluteUrl(e.path)}</loc>`);
    lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
    if (e.changefreq) lines.push(`    <changefreq>${e.changefreq}</changefreq>`);
    if (e.priority) lines.push(`    <priority>${e.priority}</priority>`);
    lines.push("  </url>");
  }
  lines.push(`</urlset>`);
  lines.push("");
  return lines.join("\n");
}
