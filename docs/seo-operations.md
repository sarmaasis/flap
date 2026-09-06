# SEO operations (useflap.online)

This is the operator checklist for Search Console, Bing, and content maintenance.
It supersedes the shorter [seo-ops.md](./seo-ops.md) notes (kept as a pointer).

**Do not commit verification secrets or API tokens.** Supply them via Cloudflare dashboard / DNS TXT / env — never the public repo.

## Canonical brand

- Live product: https://useflap.online
- Do not market `flapmail.xyz`, `useinlet.com`, or `inlet.email` as Flap. See [domain-hygiene.md](./domain-hygiene.md).

## Google Search Console

1. Create a **Domain** property for `useflap.online` (preferred over URL-prefix only).
2. Verify via DNS TXT **or** HTML meta. If using meta, add a token to `index.html` head in a private deploy config — do not commit live tokens.
3. Submit sitemap: `https://useflap.online/sitemap.xml`
4. Request indexing initially for:
   - `/`
   - `/pricing`
   - `/google-workspace-alternative`
   - `/flap-vs-google-workspace`
   - `/custom-domain-email`
   - `/about`
   - `/tools/email-setup-checker`
   - `/tools/spf-checker`
   - `/tools/dmarc-checker`
   - `/tools/dkim-checker`
   - `/tools/google-workspace-cost-calculator`
5. Monthly review: Page Indexing, Sitemaps, Core Web Vitals, HTTPS, structured-data enhancements, manual actions, security issues.
6. Record queries, impressions, clicks, CTR, and average position by landing page monthly (export or Looker Studio).

## Bing Webmaster Tools

1. Verify the domain (import from Search Console if desired).
2. Submit the same sitemap: `https://useflap.online/sitemap.xml`
3. Spot-check URL inspection after major content releases.

## IndexNow

- Key file (public): `/flap-indexnow-7c4e9a2b1d8f.txt`
- After deploy of URL batches:

```bash
npm run indexnow
```

## Content maintenance

- When **plans** or **mail architecture** change, update `shared/plans.ts` / `shared/product-facts.ts` first, then regenerate:

```bash
npm run generate:llms
npm run generate:og
npm run sitemap
npm run validate:seo
```

- Update comparison pages with a visible **Last verified** / `updated` date only after checking competitor facts on first-party sources.
- Review broken internal and external links monthly.
- Refresh meaningful `dateModified` and sitemap `lastmod` **only** after substantive content changes (registry `modified` field) — do not stamp every URL on every deploy.
- Monitor 404s; 301 consolidated or removed pages.
- After content bursts, use GSC URL Inspection and/or IndexNow.

## Structured data (manual)

Validate sample URLs with:

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

Do not assume rich results will appear.

## Social preview images (Open Graph)

- Build script: `npm run generate:og` (runs inside `npm run build`).
- Emits **PNG** 1200×630 files under `public/og/` (plus SVG sources for editing).
- Meta tags use PNG (`image/png`) — Facebook, LinkedIn, and X do not reliably render SVG as `og:image`.
- Fallback brand image: `/og.png`.
- Re-run after adding registry routes so new pages get an image before deploy.

## Analytics

First-party events POST to `/api/analytics`. Review weekly:

- `organic_landing`
- `tool_started` / `tool_completed` / `tool_error`
- `guide_to_tool`
- `content_to_pricing`
- `signup_cta_clicked` / `signup_completed`

UTM parameters are preserved in session storage and attached to events. Do not send domain names, emails, raw headers, or DNS payloads.

## Performance checks

See [seo-performance-notes.md](./seo-performance-notes.md) for reproducible Lighthouse commands. Do not invent scores.

## Related

- Architecture: [mail-architecture.md](./mail-architecture.md)
- Prerender: [ssr-prerender.md](./ssr-prerender.md)
- Legacy short ops notes: [seo-ops.md](./seo-ops.md)
