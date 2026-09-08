/**
 * Generate public/llms.txt and public/llms-full.txt from shared product facts + registry.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLANS, PLAN_ORDER } from "../shared/plans.ts";
import {
  AI_CITATION_INSTRUCTION,
  MAIL_ARCHITECTURE,
  PRODUCT_ONE_PARAGRAPH,
  SITE_URL,
  SUPPORT_EMAIL,
  TARGET_CUSTOMER,
  pricingOneLiner,
} from "../shared/product-facts.ts";
import { BLOG_POSTS } from "../src/content/blog.ts";
import { GUIDE_PAGES, TOOL_PAGES } from "../src/content/marketing.ts";
import { SEO_PAGE_DEFS } from "../src/content/seo-pages.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const publicDir = join(root, "public");

function pricingBlock(): string {
  return PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    const price = p.price_monthly === 0 ? "$0" : `$${p.price_monthly}/mo ($${p.price_yearly}/yr)`;
    return `- ${p.name}: ${price} — ${p.limits.domains} domains, ${p.limits.mailboxes} mailboxes, ${p.limits.send_per_month} sends/mo, ${p.limits.team_seats} seat(s)${id !== "free" ? ", catch-all" : ""}`;
  }).join("\n");
}

function renderLlmsTxt(): string {
  const comparisons = Object.values(SEO_PAGE_DEFS).filter((p) => p.comparison);
  const landings = Object.values(SEO_PAGE_DEFS).filter((p) => !p.comparison);

  return `# Flap

> ${PRODUCT_ONE_PARAGRAPH}

Flap is multi-domain email infrastructure and inbox for founders — not a full Docs/Drive/Meet suite. Inbound: ${MAIL_ARCHITECTURE.inbound_flow}. Outbound: ${MAIL_ARCHITECTURE.outbound_flow}. ${MAIL_ARCHITECTURE.dns_note} ${AI_CITATION_INSTRUCTION}

## Product

- [Home](${SITE_URL}/): One inbox for every product you build — positioning, FAQ, pricing
- [Pricing](${SITE_URL}/pricing): ${pricingOneLiner()}. Annual = 10× monthly.
- [Migrate](${SITE_URL}/migrate): DNS-first cutover narrative (mbox/JSON export; no auto IMAP import)
- [Why not Amazon SES](${SITE_URL}/why-not-amazon-ses): SES is the pipe; Flap is the product layer
- [Interactive demo](${SITE_URL}/demo): No-signup reply-from walkthrough (fake domains; nothing sent)
- [Changelog](${SITE_URL}/changelog): Product updates with real dates
- [Security](${SITE_URL}/security): Architecture, export, auth — no invented certifications
- [About](${SITE_URL}/about): What Flap is, who operates it, infrastructure overview
- [Signup](${SITE_URL}/signup): Create a Flap account
- [Support](${SITE_URL}/support): ${SUPPORT_EMAIL}
- [Status](${SITE_URL}/status): Public /api/health probe

## Target customer

${TARGET_CUSTOMER}

## SEO landings

${landings.map((p) => `- [${p.h1}](${SITE_URL}${p.path}): ${p.description}`).join("\n")}

## Comparisons

${comparisons.map((p) => `- [${p.h1}](${SITE_URL}${p.path}): ${p.description}`).join("\n")}

## Guides (DNS → Amazon SES → Flap)

- [Guides index](${SITE_URL}/guides): All registrar DNS guides
${GUIDE_PAGES.map((g) => `- [${g.title}](${SITE_URL}${g.path}): ${g.description}`).join("\n")}

## Developers

- [Docs](${SITE_URL}/docs): Documentation index
- [Getting started](${SITE_URL}/docs/getting-started): Domain → DNS → mailbox → first send
- [Core concepts](${SITE_URL}/docs/concepts): Domains, mailboxes, live vs test keys
- [Webhooks](${SITE_URL}/docs/webhooks): mail.received events and signature verification
- [API overview](${SITE_URL}/docs/api): POST /api/v1/send with Bearer flap_… keys

## Tools

- [All tools](${SITE_URL}/tools): Index of free DNS and deliverability tools
${TOOL_PAGES.map((t) => `- [${t.title.replace(" | Flap", "")}](${SITE_URL}${t.path}): ${t.description}`).join("\n")}

## Blog

- [Blog index](${SITE_URL}/blog)
${BLOG_POSTS.map((p) => `- [${p.h1}](${SITE_URL}${p.path})`).join("\n")}

## Optional

- [Full AI summary](${SITE_URL}/llms-full.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Terms](${SITE_URL}/terms)
- [Privacy](${SITE_URL}/privacy)
- [Billing terms](${SITE_URL}/billing-terms)
- [robots.txt](${SITE_URL}/robots.txt)
`;
}

function renderLlmsFull(): string {
  return `# Flap — full product summary for AI systems

${PRODUCT_ONE_PARAGRAPH}

## Do not invent

${AI_CITATION_INSTRUCTION}

## Target customer

${TARGET_CUSTOMER}

## Architecture

- Inbound: ${MAIL_ARCHITECTURE.inbound_flow} (${MAIL_ARCHITECTURE.inbound_provider})
- Outbound: ${MAIL_ARCHITECTURE.outbound_flow} (${MAIL_ARCHITECTURE.outbound_provider})
- App: ${MAIL_ARCHITECTURE.app_host}
- System mail (useflap.online): ${MAIL_ARCHITECTURE.system_mail_note}
- ${MAIL_ARCHITECTURE.dns_note}
- Legacy note: ${MAIL_ARCHITECTURE.legacy_inbound_note}

## Pricing and limits (from shared/plans.ts)

${pricingBlock()}

Annual billing is 20% off monthly. Catch-all is on paid plans (Solo+). Free outbound includes a Flap footer.

## What Flap is not

- Not a Google Workspace / Docs / Drive / Meet suite
- Not forwarding-only (that is a different product job; see Cloudflare Email Routing alternative page)
- Not IMAP/SMTP client access yet (web app + PWA)
- Not a delivery guarantee for third-party inbox placement

## Canonical pages

- Home: ${SITE_URL}/
- Pricing: ${SITE_URL}/pricing
- About: ${SITE_URL}/about
- Support: ${SUPPORT_EMAIL}
${Object.values(SEO_PAGE_DEFS)
  .map((p) => `- ${p.h1}: ${SITE_URL}${p.path}`)
  .join("\n")}
${GUIDE_PAGES.map((g) => `- ${g.title}: ${SITE_URL}${g.path}`).join("\n")}
${TOOL_PAGES.slice(0, 8)
  .map((t) => `- ${t.title.replace(" | Flap", "")}: ${SITE_URL}${t.path}`)
  .join("\n")}
${BLOG_POSTS.map((p) => `- ${p.h1}: ${SITE_URL}${p.path}`).join("\n")}

## Short page synopses

${Object.values(SEO_PAGE_DEFS)
  .map((p) => `### ${p.h1} — ${SITE_URL}${p.path}\n${p.definition}\n`)
  .join("\n")}
`;
}

const short = renderLlmsTxt();
const full = renderLlmsFull();
writeFileSync(join(publicDir, "llms.txt"), short);
writeFileSync(join(publicDir, "llms-full.txt"), full);
console.log("Wrote public/llms.txt and public/llms-full.txt");
