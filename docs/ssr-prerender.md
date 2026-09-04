# SEO / prerender (not full React SSR)

Flap is a **Vite SPA** deployed on **Cloudflare Workers Assets** (`not_found_handling: single-page-application`). There is no React Server Components / Node SSR pipeline.

## What we ship

After `vite build`, `npm run prerender` (`scripts/prerender.ts`) writes static HTML shells into `dist/client/`:

- `/` (updates `index.html`)
- SEO landing pages (`src/content/seo-pages.ts`)
- Guides, DNS tools, blog index + posts
- Legal (`/terms`, `/privacy`, `/billing-terms`)

Each shell keeps the production JS/CSS asset tags from the SPA build, then injects:

1. Route-specific `<title>`, description, Open Graph, Twitter, canonical
2. JSON-LD (`SoftwareApplication`, `FAQPage`, `Article`, `HowTo`, `WebApplication` as appropriate)
3. Crawlable article HTML inside `#root` (definition, sections, FAQ, CTA)

The same script regenerates `public/sitemap.xml` and `dist/client/sitemap.xml` from `src/content/sitemap.ts` (aligned with App public routes).

Static discovery files in `public/` (copied to Assets by Vite):

| File | Role |
|--|--|
| `robots.txt` | Allow marketing; disallow `/app`, `/api`, auth, settings; sitemap pointer |
| `sitemap.xml` | Public indexable URLs + lastmod |
| `llms.txt` | Short AI-oriented link index ([llms.txt](https://llmstxt.org/) convention) |
| `llms-full.txt` | Longer product / pricing / page synopsis for agents |

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
