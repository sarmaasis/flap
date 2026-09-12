# Flap Original Relaunch Plan

**Status:** Implementation brief  
**Goal:** Relaunch Flap with original positioning, copy, structure, claims, and visual direction that stand on their own.

## Principles

1. Flap leads with its own job: one operational inbox for founders and small teams managing many domains.
2. Public copy must be written from Flap product truth, not from another company's page structure, tagline, feature bundle, testimonials, or pricing story.
3. Marketing claims must match shipped behavior. Preview, partial, and planned features must be labeled as such.
4. Pricing should express Flap's economics and customer wedge directly. Avoid matching another provider's exact plan ladder, feature list, and phrasing unless the values are independently necessary.
5. Visual identity should keep Flap recognizable: direct founder tone, multi-domain workflow illustrations, restrained product UI, and a distinct palette/typographic rhythm.

## Copy Cleanup

- Replace generic business-email headlines with multi-domain founder language.
- Remove feature bundles that present every adjacent surface as equally central.
- Rewrite shared plan copy so it explains capacity in Flap terms: domains, mailboxes, team access, sending, export, and API.
- Remove copied-looking phrases such as "same stack as every paid plan" and "plans change capacity, not the product."
- Keep only comparison pages that are necessary for search and that discuss broad categories or well-known suites.

## Product Claims

- Webmail, multi-domain inbox, reply-from identity, DNS setup, export, and SES-backed send/receive are core claims.
- API, webhooks, newsletters, booking pages, calendars, and AI are secondary surfaces unless fully connected in production.
- IMAP/SMTP must stay framed as unavailable until shipped.
- No invented reviews, star ratings, artificial customer quotes, or broad "all included" claims.

## Visual Direction

- Move away from the measured warm-paper accent system.
- Use a Flap-owned palette: crisp off-white, deep ink, signal blue, mint success, and limited ember accents.
- Keep product mockups focused on the multi-domain flow: addresses enter one inbox, replies leave from the receiving domain.
- Avoid cloning another homepage rhythm. The relaunch should not be a tall stack of alternating light/dark feature bands with a generic hero, three/four-card feature grids, then pricing, FAQ, and final CTA.
- Use an original "domain operations desk" wireframe:
  1. A first-screen command center: left-side promise and actions, right-side live domain/inbox console, plus a small operations strip below the hero.
  2. A visual domain map showing owned domains, DNS state, mailbox routing, and reply identity in one flow.
  3. An inbox triage desk that shows domain context, sender identity, labels, and owner-visible status.
  4. A founder operating loop: launch, verify, receive, reply, export.
  5. Expansion lanes for teams, API, newsletters, and bookings as secondary add-ons.
  6. Trust and portability as a compact evidence panel, not a testimonial-style proof band.
  7. Pricing as a decision table based on operating shape, not a cloned plan-card ladder.
  8. FAQ only after the main product story is complete.

## Wireframe Reset Acceptance

- The homepage must no longer read as: hero split, stats strip, problem band, feature band, how-it-works cards, inbox mockup, use-case cards, feature cards, pricing cards, trust cards, founder, FAQ, compare, CTA.
- The hero must include a product-specific operations visual instead of stacked address cards.
- The middle of the page must be anchored by a domain-to-inbox workflow diagram and an inbox triage surface.
- Repeated card grids should be limited and should not be the primary page rhythm.
- Pricing should use operating profiles or a comparison table, not only three similar plan cards.

## Source Cleanup

- Delete obsolete internal docs that name another product as the design source.
- Remove the direct competitor comparison route from route lists, sitemap generation, footer navigation, and pricing CTAs.
- Regenerate `public/llms.txt`, `public/sitemap.xml`, Open Graph images, and `dist/client`.
- Run type checks and SEO validation.

## Acceptance Checklist

- `rg` finds no explicit source-product references in public source, generated public assets, or docs.
- The homepage title and metadata are Flap-owned.
- Pricing cards use Flap-specific descriptions and avoid exact borrowed phrasing.
- The footer no longer links to the removed direct comparison route.
- Build output does not contain stale copied copy.
- `npm run check` passes.
