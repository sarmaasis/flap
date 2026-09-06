# SEO / prerender (not full React SSR)

Flap is a **Vite SPA** deployed on **Cloudflare Workers Assets** (`not_found_handling: 404-page`). There is no React Server Components / Node SSR pipeline.

Unknown marketing URLs serve `public/404.html` with HTTP 404 and `noindex` (avoids soft-404 homepage clones). Authenticated SPA routes (`/app`, `/login`, …) and known marketing paths (when a prerender shell is missing — e.g. Vite `npm run dev`) are handled by the Worker via `spa-shell.html` / index, so direct loads like `/about` work locally without changing production hard-404 behavior for unknown URLs.

## What we ship

After `vite build`, `npm run prerender` (`scripts/prerender.ts`) writes static HTML shells into `dist/client/`:

- `/` (updates `index.html`)
- `/about`
- SEO landing pages (`src/content/seo-pages.ts`)
- Guides, DNS tools (with `tool-explainers` body copy), blog index + posts
- Pricing, docs, support, status
- Legal (`/terms`, `/privacy`, `/billing-terms`)

Each shell keeps the production JS/CSS asset tags from the SPA build, then injects:

1. Route-specific `<title>`, description, Open Graph, Twitter, canonical
2. JSON-LD (`SoftwareApplication`, `FAQPage`, `Article`, `HowTo`, `WebApplication` as appropriate)
3. Crawlable article HTML inside `#root` (definition, sections, FAQ, CTA)

The same script regenerates `public/sitemap.xml` and `dist/client/sitemap.xml` from the SEO registry (`src/content/seo-registry.ts` → `src/content/sitemap.ts`).

Static discovery files in `public/` (copied to Assets by Vite):

| File | Role |
|--|--|
| `robots.txt` | Allow marketing; disallow `/app`, `/api`, auth, settings; sitemap pointer |
| `sitemap.xml` | Public indexable URLs + lastmod |
| `llms.txt` / `llms-full.txt` | AI-oriented summaries (generated from `shared/product-facts.ts`) |
| `og/*.png` | Page-specific Open Graph images (1200×630 PNG; SVG sources also written) |
| `404.html` | Hard 404 + noindex for unknown paths |

Cloudflare Assets serves those files for exact paths. React still mounts client-side and replaces `#root` for interactive users.

## vs full React SSR

| | Prerender shells (this repo) | Full React SSR |
|--|--|--|
| Bot-visible content + meta | Yes, at build time | Yes, per request |
| Auth / personalization in HTML | No | Possible |
| Cloudflare Workers fit | Excellent (static Assets) | Needs Workers SSR framework |
| Maintenance | Content modules + one script | Hydration + streaming stack |

`index.html` also includes a `<noscript>` marketing blurb for non-JS clients.

Dev (`npm run dev`) does not prerender; run `npm run build` to verify shells and sitemap.
