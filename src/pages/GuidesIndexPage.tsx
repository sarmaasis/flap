import { useEffect } from "react";
import { DocsCallout, DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { GUIDE_PAGES } from "../content/marketing";
import { GUIDES_FLAT, GUIDES_FOOTER_LINKS, GUIDES_NAV } from "../content/guides-nav";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/guides";

export default function GuidesIndexPage() {
  useEffect(() => {
    setPageMeta({
      title: "Custom-domain email DNS setup guides: Cloudflare, Namecheap, GoDaddy and more | Flap",
      description:
        "Step-by-step guides to publish Amazon SES MX/SPF/DKIM for Flap at Cloudflare, Namecheap, Porkbun, GoDaddy, Vercel, Squarespace, and Route 53.",
      path: PATH,
    });
    setJsonLd(
      "guides-index",
      webPageLd({
        title: "Custom-domain email DNS setup guides | Flap",
        description: "Registrar-specific DNS guides for Flap custom-domain email: MX, SPF, and DKIM setup.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("guides-index");
  }, []);

  return (
    <DocsShell
      pathname={PATH}
      nav={GUIDES_NAV}
      brandHref="/guides"
      brandLabel="Guides"
      footerLinks={GUIDES_FOOTER_LINKS}
    >
      <DocsPage
        href={PATH}
        flatNav={GUIDES_FLAT}
        title="DNS setup guides"
        description="Point your registrar DNS at Amazon SES with the records Flap shows in Settings → Setup. Cloudflare Email Routing is not required."
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/getting-started", label: "Getting started" },
              { href: "/tools", label: "DNS tools" },
              { href: "/docs", label: "Developer docs" },
            ]}
          />
        }
      >
        <DocsCallout type="tip" title="Copy from Flap">
          Always paste live MX/SPF/DKIM values from Settings → Domains. Guides explain where to click in each
          registrar, not invent records.
        </DocsCallout>

        <h2 id="providers">Pick your DNS host</h2>
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {GUIDE_PAGES.map((g) => (
            <a
              key={g.path}
              href={g.path}
              onClick={(e) => {
                e.preventDefault();
                go(g.path);
              }}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <p className="text-sm font-medium text-[var(--foreground)]">{g.title.replace(" | Flap", "")}</p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">{g.description}</p>
            </a>
          ))}
        </div>
      </DocsPage>
    </DocsShell>
  );
}
