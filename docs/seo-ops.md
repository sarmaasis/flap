# SEO + indexing ops (useflap.online)

## Canonical brand

- **Live product:** https://useflap.online
- Do not market `flapmail.xyz`, `useinlet.com`, or `inlet.email` as Flap. See [domain-hygiene.md](./domain-hygiene.md).

## Search Console / Bing

1. Create a Google Search Console property for `https://useflap.online`.
2. Verify via DNS TXT **or** HTML meta. If using meta, add to `index.html` head:
   ```html
   <meta name="google-site-verification" content="YOUR_TOKEN" />
   ```
3. Submit sitemap: `https://useflap.online/sitemap.xml`
4. Create Bing Webmaster Tools property; import from GSC or verify similarly.
5. After content bursts, use URL Inspection / IndexNow (below).

## IndexNow

- Key file (must stay public): `/flap-indexnow-7c4e9a2b1d8f.txt`
- Key value: `flap-indexnow-7c4e9a2b1d8f`
- Submit changed URLs after deploy:

```bash
npm run indexnow
# or
npx tsx scripts/indexnow.ts
```

## HSTS

Worker responses (API + SPA shells) send `Strict-Transport-Security`. For static Assets HTML (marketing prerenders), also enable HSTS in the Cloudflare dashboard (SSL/TLS → Edge Certificates → HSTS) so every response includes it.


- Unknown marketing paths return Assets **404-page** (`public/404.html`) with HTTP 404.
- App/auth paths are served as SPA shells via Worker `run_worker_first`.
- Client router shows `NotFoundPage` for unknown paths (does not soft-serve homepage).

## OG / social

- Static shells include `og:*` / `twitter:*` via prerender.
- Image: https://useflap.online/og.png (also `og.svg`).

## Weekly distribution metrics

First-party events hit `/api/analytics`. Review weekly (Cloudflare logs / D1 analytics table if enabled):

- `seo_tool_used` (or tool page tracks)
- `signup_clicked` / `signup_completed`
- `checkout_started`

No third-party pixel is required for launch.
