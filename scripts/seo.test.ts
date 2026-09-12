/**
 * SEO regression tests — run via `npm run test:seo` (tsx).
 * Covers the 12 required automated checks from the SEO spec.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { PLANS } from "../shared/plans.ts";
import { OBSOLETE_PLAN_PHRASES, OBSOLETE_SETUP_PHRASES } from "../shared/obsolete-seo-phrases.ts";
import {
  absoluteCanonical,
  getSeoRegistry,
  indexableRegistryEntries,
  isPrivatePath,
} from "../src/content/seo-registry.ts";
import { buildSitemapEntries, renderSitemapXml } from "../src/content/sitemap.ts";
import { SEO_PATHS, SEO_REDIRECTS, FOR_PATHS, VS_PATHS } from "../shared/client-routes.ts";
import { SEO_PAGE_DEFS } from "../src/content/seo-pages.ts";
import { BLOG_POSTS } from "../src/content/blog.ts";
import { TOOL_EXPLAINERS } from "../src/content/tool-explainers.ts";
import {
  articleLd,
  faqPageLd,
  softwareApplicationLd,
} from "../src/lib/jsonld.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const clientDir = join(root, "dist", "client");
const publicDir = join(root, "public");

let passed = 0;
function ok(name: string) {
  passed++;
  console.log(`ok — ${name}`);
}

function collectCorpus(): string {
  const parts: string[] = [];
  for (const page of Object.values(SEO_PAGE_DEFS)) {
    parts.push(JSON.stringify(page));
  }
  for (const post of BLOG_POSTS) parts.push(JSON.stringify(post));
  for (const t of Object.values(TOOL_EXPLAINERS)) parts.push(JSON.stringify(t));
  return parts.join("\n");
}

// 1–4 registry / uniqueness
{
  const reg = indexableRegistryEntries();
  assert.ok(reg.length > 20, "public SEO routes registered");
  const titles = new Set<string>();
  const descs = new Set<string>();
  for (const e of reg) {
    assert.ok(e.title, `title ${e.path}`);
    assert.ok(e.description, `desc ${e.path}`);
    assert.ok(e.h1, `h1 ${e.path}`);
    assert.equal(absoluteCanonical(e.path).startsWith("https://useflap.online"), true);
    assert.ok(e.ogImagePath.endsWith(".png"), `PNG OG path ${e.path}`);
    assert.equal(e.twitterCard, "summary_large_image");
    assert.equal(titles.has(e.title), false, `unique title ${e.path}`);
    titles.add(e.title);
    assert.equal(descs.has(e.description), false, `unique desc ${e.path}`);
    descs.add(e.description);
  }
  ok("1–4 public routes have unique title/desc and one canonical path + H1 field");
}

// 5–6 private absent; sitemap matches canonicals
{
  const entries = buildSitemapEntries();
  for (const e of entries) {
    assert.equal(isPrivatePath(e.path), false, `private ${e.path}`);
  }
  const site = new Set(entries.map((e) => e.path));
  const reg = new Set(indexableRegistryEntries().map((e) => e.path));
  assert.deepEqual([...site].sort(), [...reg].sort());
  ok("5–6 private routes absent; sitemap matches registry canonicals");
}

// SEO_PAGE_DEFS ↔ shared/client-routes SEO_PATHS stay in sync
{
  assert.deepEqual(Object.keys(SEO_PAGE_DEFS).sort(), [...SEO_PATHS].sort());
  ok("SEO_PAGE_DEFS keys match shared SEO_PATHS");
}

// SEO alias redirects target known indexable routes (no orphan 301s)
{
  const targets = new Set<string>([...SEO_PATHS, ...FOR_PATHS, ...VS_PATHS]);
  for (const [from, to] of Object.entries(SEO_REDIRECTS)) {
    assert.notEqual(from, to, `redirect must change path: ${from}`);
    assert.equal(targets.has(to), true, `redirect ${from} → unknown target ${to}`);
  }
  ok("SEO_REDIRECTS targets are known SEO/for/vs paths");
}

// 7 JSON-LD parses
{
  const soft = softwareApplicationLd();
  const art = articleLd({
    path: "/blog/x",
    title: "T",
    description: "D",
    datePublished: "2026-09-07",
  });
  const faq = faqPageLd([{ q: "Q?", a: "A" }]);
  assert.equal(JSON.parse(JSON.stringify(soft))["@type"], "SoftwareApplication");
  assert.equal(JSON.parse(JSON.stringify(art))["@type"], "Article");
  assert.equal(JSON.parse(JSON.stringify(faq))["@type"], "FAQPage");
  // Offers from PLANS
  const offers = soft.offers as Array<{ price: string; name: string }>;
  assert.ok(offers.some((o) => o.price === String(PLANS.solo.price_monthly)));
  ok("7 JSON-LD parses; software offers from PLANS");
}

// 8 FAQ schema matches visible FAQs (sample page)
{
  const page = SEO_PAGE_DEFS["/flap-vs-google-workspace"]!;
  const ld = faqPageLd(page.faqs);
  const entities = ld.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
  assert.equal(entities.length, page.faqs.length);
  assert.equal(entities[0]!.name, page.faqs[0]!.q);
  assert.equal(entities[0]!.acceptedAnswer.text, page.faqs[0]!.a);
  ok("8 FAQ schema matches visible FAQs");
}

// 9 pricing shared
{
  assert.equal(PLANS.free.limits.domains, 2);
  assert.equal(PLANS.solo.limits.domains, 25);
  assert.equal(PLANS.pro.limits.domains, 40);
  assert.equal(PLANS.solo.price_monthly, 6);
  assert.equal(PLANS.pro.price_monthly, 15);
  assert.equal(PLANS.team.price_monthly, 35);
  assert.equal(PLANS.solo.limits.mailboxes, 3);
  assert.equal(PLANS.pro.limits.mailboxes, 8);
  ok("9 shared plan configuration authoritative");
}

// 10 obsolete phrases absent
{
  const corpus = collectCorpus();
  for (const phrase of [...OBSOLETE_SETUP_PHRASES, ...OBSOLETE_PLAN_PHRASES]) {
    assert.equal(corpus.includes(phrase), false, `obsolete: ${phrase}`);
  }
  ok("10 obsolete setup/plan phrases absent from SEO content");
}

// 11 robots/sitemap/llms exist
{
  for (const name of ["robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt"]) {
    assert.equal(existsSync(join(publicDir, name)), true, name);
  }
  const robots = readFileSync(join(publicDir, "robots.txt"), "utf8");
  assert.match(robots, /Disallow: \/app/);
  assert.match(robots, /Disallow: \/api/);
  assert.match(robots, /Disallow: \/signup/);
  assert.match(robots, /Disallow: \/sso-callback/);
  assert.match(robots, /Disallow: \/auth\//);
  const xml = renderSitemapXml();
  assert.match(xml, /<urlset/);
  assert.match(xml, /useflap\.online\/about/);
  ok("11 robots/sitemap/llms present and private routes disallowed");
}

// 12 prerender not empty / not identical (when dist exists)
{
  const home = join(clientDir, "index.html");
  const pricing = join(clientDir, "pricing", "index.html");
  const about = join(clientDir, "about", "index.html");
  if (!existsSync(home) || !existsSync(pricing)) {
    console.log("skip — 12 prerender HTML (run build first)");
  } else {
    const a = readFileSync(home, "utf8");
    const b = readFileSync(pricing, "utf8");
    assert.ok(a.length > 800 && b.length > 800);
    assert.notEqual(a, b);
    assert.equal((a.match(/<h1[\s>]/gi) || []).length, 1);
    assert.equal((b.match(/rel="canonical"/gi) || []).length, 1);
    if (existsSync(about)) {
      const c = readFileSync(about, "utf8");
      assert.ok(c.length > 800);
      assert.notEqual(b, c);
    }
    ok("12 prerender HTML non-empty and not identical across pages");
  }
}

console.log(`\n${passed} SEO checks passed (${getSeoRegistry().length} registry routes).`);
