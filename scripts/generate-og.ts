/**
 * Generate page-specific 1200×630 Open Graph images under public/og/.
 * Outputs PNG (crawler-safe for Facebook/LinkedIn/X) plus SVG source.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { getSeoRegistry } from "../src/content/seo-registry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "public", "og");

const OG_WIDTH = 1200;
const OG_PAD_X = 72;
/** Keep titles inside a padded content column (mirrored left/right). */
const OG_SAFE_WIDTH = OG_WIDTH - OG_PAD_X * 2;
const TITLE_MAX_LINES = 3;
const TITLE_FONT_CANDIDATES = [54, 48, 44, 40, 36] as const;
const TITLE_FONT_FAMILY = "Inter, ui-sans-serif, system-ui, sans-serif";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const measureCache = new Map<string, number>();

/** Measure title width with the same engine that rasterizes OG PNGs. */
function measureTextWidth(text: string, fontSize: number): number {
  const key = `${fontSize}\0${text}`;
  const hit = measureCache.get(key);
  if (hit != null) return hit;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="${fontSize}" font-family="${TITLE_FONT_FAMILY}" font-size="${fontSize}" font-weight="700">${esc(text)}</text>
</svg>`;
  const box = new Resvg(svg).getBBox();
  const width = box?.width ?? 0;
  measureCache.set(key, width);
  return width;
}

function wrapTitleToWidth(title: string, fontSize: number, maxWidth: number, maxLines: number): string[] | null {
  const words = title
    .replace(/\s*\|\s*Flap.*$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    // Hard-break an oversized token across lines rather than overflowing.
    if (measureTextWidth(w, fontSize) > maxWidth) {
      if (cur) {
        lines.push(cur);
        cur = "";
        if (lines.length >= maxLines) return null;
      }
      let chunk = "";
      for (const ch of w) {
        const next = chunk + ch;
        if (chunk && measureTextWidth(next, fontSize) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
          if (lines.length >= maxLines) return null;
        } else chunk = next;
      }
      cur = chunk;
      continue;
    }

    const next = cur ? `${cur} ${w}` : w;
    if (cur && measureTextWidth(next, fontSize) > maxWidth) {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) return null;
    } else {
      cur = next;
    }
  }
  if (cur) {
    if (lines.length >= maxLines) return null;
    lines.push(cur);
  }
  return lines;
}

function layoutTitle(rawTitle: string): { lines: string[]; fontSize: number; lineGap: number } {
  for (const fontSize of TITLE_FONT_CANDIDATES) {
    const lines = wrapTitleToWidth(rawTitle, fontSize, OG_SAFE_WIDTH, TITLE_MAX_LINES);
    if (lines && lines.every((line) => measureTextWidth(line, fontSize) <= OG_SAFE_WIDTH)) {
      return { lines, fontSize, lineGap: Math.round(fontSize * 0.96) };
    }
  }
  // Last resort: force wrap at smallest size (may truncate to max lines).
  const fontSize = TITLE_FONT_CANDIDATES[TITLE_FONT_CANDIDATES.length - 1];
  const words = rawTitle.replace(/\s*\|\s*Flap.*$/i, "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measureTextWidth(next, fontSize) > OG_SAFE_WIDTH) {
      lines.push(cur);
      cur = w;
      if (lines.length >= TITLE_MAX_LINES) break;
    } else cur = next;
  }
  if (cur && lines.length < TITLE_MAX_LINES) lines.push(cur);
  return { lines: lines.slice(0, TITLE_MAX_LINES), fontSize, lineGap: Math.round(fontSize * 0.96) };
}

function categoryLabel(pageType: string): string {
  const map: Record<string, string> = {
    home: "Product",
    pricing: "Pricing",
    comparison: "Comparison",
    guide: "Guide",
    tool: "Tool",
    blog: "Blog",
    blog_index: "Blog",
    about: "About",
    docs: "Docs",
    product: "Product",
    collection: "Resources",
    legal: "Legal",
    support: "Support",
    status: "Status",
  };
  return map[pageType] || "Flap";
}

function renderSvg(opts: { title: string; category: string }): string {
  const { lines, fontSize, lineGap } = layoutTitle(opts.title);
  // Anchor the block so 1–3 lines stay visually centered in the mid band.
  const blockHeight = lineGap * (lines.length - 1);
  const titleY = Math.round(250 - blockHeight / 2);
  const titleTspans = lines
    .map((line, i) => `<tspan x="${OG_PAD_X}" dy="${i === 0 ? 0 : lineGap}">${esc(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(opts.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF9F6"/>
      <stop offset="55%" stop-color="#F3F1EC"/>
      <stop offset="100%" stop-color="#EDEAE3"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="120" r="180" fill="#F26522" fill-opacity="0.08"/>
  <circle cx="160" cy="520" r="220" fill="#141211" fill-opacity="0.04"/>
  <rect x="${OG_PAD_X}" y="64" width="56" height="56" rx="14" fill="#050505"/>
  <path d="M84 82.4L100 93l16-10.6V104a4 4 0 0 1-4 4H88a4 4 0 0 1-4-4V82.4z" fill="#FAF9F6"/>
  <path d="M84 82.4L100 93l16-10.6L100 74 84 82.4z" fill="#F26522"/>
  <text x="${OG_PAD_X}" y="160" fill="#F26522" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="22" font-weight="600" letter-spacing="0.14em">${esc(categoryLabel(opts.category).toUpperCase())}</text>
  <text x="${OG_PAD_X}" y="${titleY}" fill="#141211" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="${fontSize}" font-weight="700">${titleTspans}</text>
  <text x="${OG_PAD_X}" y="560" fill="#141211" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="36" font-weight="700">Flap</text>
  <text x="${OG_PAD_X}" y="598" fill="#5c5652" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="22">useflap.online · professional email on every domain</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
const reg = getSeoRegistry().filter((e) => e.indexable);
let n = 0;
for (const e of reg) {
  const slug = e.path === "/" ? "home" : e.path.replace(/^\//, "").replace(/\//g, "--");
  const svg = renderSvg({ title: e.h1 || e.title, category: e.pageType });
  writeFileSync(join(outDir, `${slug}.svg`), svg);
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
  writeFileSync(join(outDir, `${slug}.png`), png);
  n++;
}
console.log(`Wrote ${n} OG PNG (+ SVG) images to public/og/`);
