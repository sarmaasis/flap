/**
 * Canonical list of public, indexable URLs for sitemap.xml.
 * Generated from the SEO registry (src/content/seo-registry.ts).
 */
import {
  absoluteCanonical,
  indexableRegistryEntries,
  LEGAL_PAGES,
  type SeoRegistryEntry,
} from "./seo-registry";

export type SitemapEntry = {
  path: string;
  lastmod: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

export { LEGAL_PAGES };

function priorityFor(e: SeoRegistryEntry): string {
  if (e.path === "/") return "1.0";
  if (e.pageType === "pricing") return "0.9";
  if (e.pageType === "comparison") return "0.85";
  if (e.pageType === "product" || e.pageType === "about") return "0.8";
  if (e.pageType === "guide" || e.pageType === "blog_index" || e.pageType === "docs") return "0.75";
  if (e.pageType === "tool" || e.pageType === "blog") return "0.7";
  if (e.pageType === "legal" || e.pageType === "status") return "0.3";
  return "0.5";
}

function changefreqFor(e: SeoRegistryEntry): SitemapEntry["changefreq"] {
  if (e.path === "/" || e.pageType === "pricing" || e.pageType === "blog_index") return "weekly";
  if (e.pageType === "status") return "daily";
  if (e.pageType === "legal" || e.pageType === "support") return "yearly";
  return "monthly";
}

export function buildSitemapEntries(): SitemapEntry[] {
  return indexableRegistryEntries().map((e) => ({
    path: e.path,
    lastmod: e.modified,
    changefreq: changefreqFor(e),
    priority: priorityFor(e),
  }));
}

export function absoluteUrl(path: string): string {
  return absoluteCanonical(path);
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
