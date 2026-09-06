/**
 * Build-time SEO validation — fails on duplicates, missing fields, private sitemap URLs, stale phrases.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANS } from "../shared/plans.ts";
import { OBSOLETE_PLAN_PHRASES, OBSOLETE_SETUP_PHRASES } from "../shared/obsolete-seo-phrases.ts";
import { getSeoRegistry, isPrivatePath, absoluteCanonical } from "../src/content/seo-registry.ts";
import { buildSitemapEntries } from "../src/content/sitemap.ts";
import { SEO_PAGE_DEFS } from "../src/content/seo-pages.ts";
import { BLOG_POSTS } from "../src/content/blog.ts";
import { TOOL_EXPLAINERS } from "../src/content/tool-explainers.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const clientDir = join(root, "dist", "client");

const errors: string[] = [];

function fail(msg: string) {
  errors.push(msg);
}

function collectContentCorpus(): string {
  const parts: string[] = [];
  for (const page of Object.values(SEO_PAGE_DEFS)) {
    parts.push(page.title, page.description, page.h1, page.definition, page.lede);
    for (const s of page.sections) parts.push(s.heading, s.body, ...(s.bullets || []));
    for (const f of page.faqs) parts.push(f.q, f.a);
    if (page.table) {
      for (const row of page.table.rows) parts.push(...row);
    }
  }
  for (const post of BLOG_POSTS) {
    parts.push(post.title, post.description, post.h1, post.definition, post.lede);
    for (const s of post.sections) {
      parts.push(s.heading, s.body, ...(s.bullets || []));
      for (const sub of s.subheads || []) parts.push(sub.h3, sub.body);
    }
    for (const f of post.faqs) parts.push(f.q, f.a);
  }
  for (const t of Object.values(TOOL_EXPLAINERS)) {
    parts.push(t.answerFirst, t.whatItChecks);
    for (const f of t.faqs) parts.push(f.q, f.a);
  }
  return parts.join("\n");
}

function validateRegistry() {
  const reg = getSeoRegistry();
  const titles = new Map<string, string>();
  const descs = new Map<string, string>();
  const paths = new Set<string>();

  for (const e of reg) {
    if (!e.indexable) continue;
    if (paths.has(e.path)) fail(`Duplicate registry path: ${e.path}`);
    paths.add(e.path);

    if (!e.title?.trim()) fail(`Missing title: ${e.path}`);
    if (!e.description?.trim()) fail(`Missing description: ${e.path}`);
    if (!e.h1?.trim()) fail(`Missing H1: ${e.path}`);
    if (!e.canonicalPath) fail(`Missing canonical: ${e.path}`);
    if (e.canonicalPath !== e.path) fail(`Canonical path mismatch: ${e.path}`);
    if (!e.ogImagePath) fail(`Missing OG image path: ${e.path}`);
    if (e.ogImagePath.endsWith(".svg")) {
      fail(`OG image must be PNG/JPEG for social crawlers: ${e.path} → ${e.ogImagePath}`);
    }
    const ogFile = join(root, "public", e.ogImagePath.replace(/^\//, ""));
    if (!existsSync(ogFile) && existsSync(join(root, "public", "og"))) {
      // Allow missing until generate:og runs; warn when public/og exists but file does not
      fail(`Missing OG image file: ${e.ogImagePath}`);
    }

    const abs = absoluteCanonical(e.path);
    if (!abs.startsWith("https://useflap.online")) fail(`Bad canonical origin: ${abs}`);

    if (titles.has(e.title)) fail(`Duplicate title "${e.title}" (${titles.get(e.title)} vs ${e.path})`);
    else titles.set(e.title, e.path);

    if (descs.has(e.description)) fail(`Duplicate description on ${descs.get(e.description)} vs ${e.path}`);
    else descs.set(e.description, e.path);

    if (isPrivatePath(e.path) && e.sitemap) fail(`Private path in registry sitemap: ${e.path}`);
  }
}

function validateSitemap() {
  const entries = buildSitemapEntries();
  const regPaths = new Set(getSeoRegistry().filter((e) => e.indexable && e.sitemap).map((e) => e.path));
  const sitePaths = new Set(entries.map((e) => e.path));

  for (const p of sitePaths) {
    if (isPrivatePath(p)) fail(`Private path in sitemap: ${p}`);
    if (!regPaths.has(p)) fail(`Sitemap path not in registry: ${p}`);
  }
  for (const p of regPaths) {
    if (!sitePaths.has(p)) fail(`Registry indexable path missing from sitemap: ${p}`);
  }
}

function validateStalePhrases() {
  const corpus = collectContentCorpus();
  for (const phrase of [...OBSOLETE_SETUP_PHRASES, ...OBSOLETE_PLAN_PHRASES]) {
    if (corpus.includes(phrase)) fail(`Obsolete phrase in SEO content: "${phrase}"`);
  }
  // Hard stale plan numbers that must not appear as Solo/Builder domain claims
  if (/Solo 3\b/.test(corpus) && /Builder 10\b/.test(corpus)) {
    fail("Stale Solo 3 / Builder 10 domain claims present");
  }
}

function validatePricingConsistency() {
  const corpus = collectContentCorpus();
  // Visible hard-coded wrong Solo price
  if (corpus.includes("Solo $9") || corpus.includes("Solo $9/mo")) {
    fail("Stale Solo $9 pricing in content");
  }
  if (!String(PLANS.solo.price_monthly)) fail("PLANS.solo missing");
}

function validatePrerender() {
  if (!existsSync(clientDir)) {
    console.warn("skip prerender HTML checks (dist/client missing — run build first)");
    return;
  }
  const samples = ["/", "/pricing", "/about", "/tools/spf-checker", "/google-workspace-alternative"];
  const bodies: string[] = [];
  for (const path of samples) {
    const file =
      path === "/"
        ? join(clientDir, "index.html")
        : join(clientDir, path.replace(/^\//, ""), "index.html");
    if (!existsSync(file)) {
      fail(`Missing prerender HTML: ${path}`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    if (html.length < 500) fail(`Prerender too short: ${path}`);
    const h1s = html.match(/<h1[\s>]/gi) || [];
    if (h1s.length !== 1) fail(`Expected 1 H1 in prerender ${path}, found ${h1s.length}`);
    const canons = html.match(/rel="canonical"/gi) || [];
    if (canons.length !== 1) fail(`Expected 1 canonical in ${path}, found ${canons.length}`);
    if (!html.includes("og:image")) fail(`Missing og:image in ${path}`);
    const ogTypeMatch = html.match(/property="og:image:type"\s+content="([^"]+)"/i);
    if (ogTypeMatch && /svg/i.test(ogTypeMatch[1]!)) {
      fail(`OG image type must be raster (PNG/JPEG), not SVG, on ${path}`);
    }
    const ogMatch = html.match(/property="og:image"\s+content="([^"]+)"/i);
    if (ogMatch && /\.svg(\?|$)/i.test(ogMatch[1]!)) {
      fail(`og:image must not be SVG for crawlers: ${path} → ${ogMatch[1]}`);
    }
    bodies.push(html.replace(/<script[\s\S]*?<\/script>/gi, "").slice(0, 2000));
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    for (const m of ld) {
      try {
        JSON.parse(m[1]!);
      } catch {
        fail(`Invalid JSON-LD on ${path}`);
      }
    }
  }
  if (bodies.length >= 2 && bodies[0] === bodies[1]) {
    fail("Unrelated prerender pages appear identical");
  }

  for (const name of ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"]) {
    const p = join(clientDir, name);
    const pub = join(root, "public", name);
    if (!existsSync(p) && !existsSync(pub)) fail(`Missing ${name} in public/ or dist/client`);
  }
}

function main() {
  validateRegistry();
  validateSitemap();
  validateStalePhrases();
  validatePricingConsistency();
  validatePrerender();

  if (errors.length) {
    console.error(`SEO validation failed (${errors.length}):`);
    for (const e of errors) console.error(" -", e);
    process.exit(1);
  }
  console.log(`SEO validation OK — ${getSeoRegistry().length} registry routes, ${buildSitemapEntries().length} sitemap URLs.`);
}

main();
