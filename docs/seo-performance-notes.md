# SEO performance / accessibility notes

Do **not** invent Lighthouse scores. Re-run locally or in CI with the commands below and paste measured results after each release that changes marketing HTML/CSS/JS.

## Commands (Chrome Lighthouse CLI)

```bash
# After npm run build && npx vite preview --port 4173
npx --yes lighthouse http://127.0.0.1:4173/ \
  --only-categories=performance,accessibility,seo \
  --form-factor=mobile --quiet --chrome-flags="--headless"

npx --yes lighthouse http://127.0.0.1:4173/pricing --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless"
npx --yes lighthouse http://127.0.0.1:4173/flap-vs-google-workspace --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless"
npx --yes lighthouse http://127.0.0.1:4173/guides/cloudflare-custom-domain-email --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless"
npx --yes lighthouse http://127.0.0.1:4173/blog/mx-spf-dmarc-setup-checklist --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless"
npx --yes lighthouse http://127.0.0.1:4173/tools/email-setup-checker --only-categories=performance,accessibility,seo --form-factor=mobile --quiet --chrome-flags="--headless"
```

Repeat with `--form-factor=desktop` for desktop checks.

## What to investigate if regressions appear

- LCP: hero text/fonts, prerender HTML size, render-blocking CSS
- INP: heavy main-thread JS on tool pages
- CLS: late font swap, images without dimensions (OG PNGs are meta-only; not layout images)
- Fonts: ensure display strategy does not cause large layout shifts
- JS: keep marketing chunks lazy (already via `React.lazy` in App)

## Measurement status (this implementation)

Lighthouse was **not** executed in the automated agent environment for this change set (no claimed numeric scores). Operators should run the commands above against a local preview or production after deploy and archive the JSON/HTML reports outside the repo if they contain environment noise.

## Accessibility checklist (manual)

- One H1 per page (registry + prerender validation)
- Form labels on DNS tools
- Keyboard focus on CTAs and accordion FAQs
- Color contrast on marketing tokens
- Skip inventing aggregate ratings or review schema
