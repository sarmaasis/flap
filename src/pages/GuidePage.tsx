import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import {
  DefinitionBox,
  FaqBlock,
  LastUpdated,
  RelatedLinks,
} from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import { GUIDE_PAGES } from "../content/marketing";
import { getGuideBody, getGuideMeta } from "../content/guides";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  clearJsonLd,
  faqPageLd,
  howToLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webPageLd,
} from "../lib/seo";

/** Honest annotated walkthrough panels — not product screenshots or testimonials. */
function GuideDiagram({ provider }: { provider: string }) {
  const dnsHost =
    provider === "cloudflare"
      ? "Cloudflare DNS"
      : provider === "vercel"
        ? "Vercel Domains DNS"
        : provider === "route53"
          ? "Route 53"
          : `${provider[0]!.toUpperCase()}${provider.slice(1)} DNS`;

  const stages = [
    { title: "1 · Flap", body: "Add domain + mailbox in Settings → Setup" },
    { title: `2 · ${dnsHost}`, body: "Paste MX + SPF (and DKIM TXT) from Flap / Cloudflare" },
    { title: "3 · Cloudflare Email Routing", body: "Rule: address → Send to Flap Worker" },
    { title: "4 · Flap Check DNS", body: "Auto-poll or Check DNS until MX + SPF look good" },
  ];

  return (
    <figure className="mt-10" aria-label="Setup walkthrough diagram">
      <figcaption className="text-sm font-medium text-[var(--fg)]">Setup map</figcaption>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Annotated flow (not a product screenshot). Same path for every DNS host — only step 2’s UI changes.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {stages.map((s) => (
          <div
            key={s.title}
            className="rounded-lg border border-[var(--line)] px-4 py-3"
            style={{ background: "color-mix(in oklab, var(--fg) 3%, transparent)" }}
          >
            <p className="text-sm font-semibold tracking-tight">{s.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--muted)]">{s.body}</p>
          </div>
        ))}
      </div>
      <svg
        viewBox="0 0 640 72"
        className="mt-6 hidden w-full max-w-3xl md:block"
        role="img"
        aria-label="Mail path: sender to DNS to Cloudflare to Flap"
      >
        <defs>
          <marker id="guide-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" opacity="0.45" />
          </marker>
        </defs>
        <g fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" markerEnd="url(#guide-arrow)">
          <line x1="70" y1="36" x2="150" y2="36" />
          <line x1="230" y1="36" x2="310" y2="36" />
          <line x1="400" y1="36" x2="480" y2="36" />
        </g>
        {[
          { x: 8, label: "Sender" },
          { x: 158, label: "MX / SPF" },
          { x: 318, label: "CF Routing" },
          { x: 488, label: "Flap inbox" },
        ].map((n) => (
          <g key={n.label}>
            <rect
              x={n.x}
              y="16"
              width="100"
              height="40"
              rx="8"
              fill="color-mix(in oklab, currentColor 6%, transparent)"
              stroke="currentColor"
              strokeOpacity="0.25"
            />
            <text x={n.x + 50} y="41" textAnchor="middle" fontSize="12" fill="currentColor">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export default function GuidePage({ path }: { path: string }) {
  const meta = getGuideMeta(path);
  const body = meta ? getGuideBody(meta.provider) : null;

  useEffect(() => {
    if (!meta || !body) return;
    setPageMeta({ title: meta.title, description: meta.description, path: meta.path });
    trackOnce(`guide_${path}`, "guide_view", { path });
    setJsonLd(
      "flap-webpage",
      webPageLd({
        path: meta.path,
        title: meta.title,
        description: meta.description,
        dateModified: body.updated,
      }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    setJsonLd(
      "flap-howto",
      howToLd({
        name: body.heading,
        description: body.definition,
        steps: body.steps,
      }),
    );
    if (body.faqs.length) setJsonLd("flap-faq", faqPageLd(body.faqs));
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-howto");
      clearJsonLd("flap-faq");
    };
  }, [meta, body, path]);

  if (!meta || !body) {
    return (
      <MarketingShell>
        <div className="mx-auto max-w-3xl px-5 py-24">
          <h1 className="text-2xl font-semibold">Guide not found</h1>
          <Button className="mt-6" onClick={() => go("/guides/cloudflare-custom-domain-email")}>
            Cloudflare guide
          </Button>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Guide · Flap · useflap.online
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          {body.heading}
        </h1>
        <LastUpdated date={body.updated} />
        <DefinitionBox>{body.definition}</DefinitionBox>
        <p className="mt-5 text-lg text-[var(--muted)]">{body.intro}</p>

        <GuideDiagram provider={meta.provider} />

        <h2 className="mt-12 text-xl font-semibold">Steps</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-[15px] leading-relaxed text-[var(--muted)]">
          {body.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <h2 className="mt-12 text-xl font-semibold">Records</h2>
        <p className="mt-3 text-[15px] text-[var(--muted)]">{body.records_note}</p>

        {body.proxy_notes ? (
          <>
            <h2 className="mt-12 text-xl font-semibold">Proxy / DNS-only settings</h2>
            <p className="mt-3 text-[15px] text-[var(--muted)]">{body.proxy_notes}</p>
          </>
        ) : null}

        <h2 className="mt-12 text-xl font-semibold">Verification</h2>
        <p className="mt-3 text-[15px] text-[var(--muted)]">{body.verification}</p>

        <h2 className="mt-12 text-xl font-semibold">Common mistakes</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-[var(--muted)]">
          {body.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        <FaqBlock faqs={body.faqs} />

        <div className="mt-12 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              track("signup_clicked", { source: path });
              go("/signup");
            }}
          >
            Start free
          </Button>
          <Button variant="outline" onClick={() => go("/tools/email-setup-checker")}>
            Run setup checker
          </Button>
        </div>

        <RelatedLinks
          links={[
            ...body.related,
            ...GUIDE_PAGES.filter(
              (g) => g.path !== path && !body.related.some((r) => r.href === g.path),
            ).map((g) => ({
              href: g.path,
              label: g.title,
            })),
            { href: "/blog", label: "Flap blog" },
          ]}
        />
      </article>
    </MarketingShell>
  );
}
