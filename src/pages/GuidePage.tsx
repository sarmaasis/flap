import { useEffect } from "react";
import {
  DocsCallout,
  DocsPage,
  DocsRelated,
  DocsShell,
} from "../components/docs/DocsKit";
import { Button } from "../components/ui/button";
import { GUIDE_PAGES } from "../content/marketing";
import { getGuideBody, getGuideMeta } from "../content/guides";
import { GUIDES_FLAT, GUIDES_FOOTER_LINKS, GUIDES_NAV } from "../content/guides-nav";
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
    { title: `2 · ${dnsHost}`, body: "Paste MX + SPF + DKIM from Flap Settings" },
    { title: "3 · Amazon SES", body: "MX delivers to SES inbound → Flap ingest" },
    { title: "4 · Flap Check DNS", body: "Auto-poll or Check DNS until MX + SPF look good" },
  ];

  return (
    <figure className="not-prose my-6" aria-label="Setup walkthrough diagram">
      <figcaption className="text-sm font-medium text-[var(--foreground)]">Setup map</figcaption>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Annotated flow (not a product screenshot). Same path for every DNS host — only step 2’s UI changes.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {stages.map((s) => (
          <div key={s.title} className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3">
            <p className="text-sm font-semibold tracking-tight text-[var(--foreground)]">{s.title}</p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--foreground-muted)]">{s.body}</p>
          </div>
        ))}
      </div>
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
      <DocsShell pathname="/guides" nav={GUIDES_NAV} brandHref="/guides" brandLabel="Guides" footerLinks={GUIDES_FOOTER_LINKS}>
        <DocsPage href="/guides" flatNav={GUIDES_FLAT} title="Guide not found">
          <p>That registrar guide is missing.</p>
          <div className="not-prose mt-4">
            <Button type="button" onClick={() => go("/guides/cloudflare-custom-domain-email")}>
              Cloudflare guide
            </Button>
          </div>
        </DocsPage>
      </DocsShell>
    );
  }

  const toc = [
    { id: "overview", label: "Overview" },
    { id: "steps", label: "Steps" },
    { id: "records", label: "Records" },
    ...(body.proxy_notes ? [{ id: "proxy", label: "Proxy settings" }] : []),
    { id: "verification", label: "Verification" },
    { id: "mistakes", label: "Common mistakes" },
    ...(body.faqs.length ? [{ id: "faq", label: "FAQ" }] : []),
  ];

  const siblingGuides = GUIDE_PAGES.filter(
    (g) => g.path !== path && !body.related.some((r) => r.href === g.path),
  ).slice(0, 4);

  return (
    <DocsShell
      pathname={path}
      nav={GUIDES_NAV}
      brandHref="/guides"
      brandLabel="Guides"
      footerLinks={GUIDES_FOOTER_LINKS}
    >
      <DocsPage
        href={path}
        flatNav={GUIDES_FLAT}
        title={body.heading}
        description={body.intro}
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              ...body.related.slice(0, 4),
              ...siblingGuides.map((g) => ({ href: g.path, label: g.title.replace(" | Flap", "") })),
              { href: "/guides", label: "All guides" },
            ]}
          />
        }
      >
        <p className="text-xs text-[var(--foreground-faint)]">Updated {body.updated}</p>
        <DocsCallout type="info" title="Definition">
          {body.definition}
        </DocsCallout>

        <h2 id="overview">Overview</h2>
        <GuideDiagram provider={meta.provider} />

        <h2 id="steps">Steps</h2>
        <ol>
          {body.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        <h2 id="records">Records</h2>
        <p>{body.records_note}</p>

        {body.proxy_notes ? (
          <>
            <h2 id="proxy">Proxy / DNS-only settings</h2>
            <p>{body.proxy_notes}</p>
          </>
        ) : null}

        <h2 id="verification">Verification</h2>
        <p>{body.verification}</p>

        <h2 id="mistakes">Common mistakes</h2>
        <ul>
          {body.mistakes.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>

        {body.faqs.length ? (
          <>
            <h2 id="faq">FAQ</h2>
            <div className="space-y-4">
              {body.faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="!mt-4">{f.q}</h3>
                  <p>{f.a}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="not-prose mt-8 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              track("signup_clicked", { source: path });
              go("/signup");
            }}
          >
            Start free
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              track("guide_to_tool", { tool: "email-setup-checker" });
              go("/tools/email-setup-checker");
            }}
          >
            Run setup checker
          </Button>
        </div>
      </DocsPage>
    </DocsShell>
  );
}
