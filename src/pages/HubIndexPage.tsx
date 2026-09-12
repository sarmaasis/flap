import { useEffect } from "react";
import { DocsCallout, DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { FOR_PAGES, VS_PAGES } from "../content/hubs";
import { FOR_FLAT, FOR_NAV, HUB_FOOTER_LINKS, VS_FLAT, VS_NAV } from "../content/hubs-nav";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

export default function HubIndexPage({ kind }: { kind: "for" | "vs" }) {
  const path = kind === "for" ? "/for" : "/vs";
  const pages = kind === "for" ? FOR_PAGES : VS_PAGES;
  const title = kind === "for" ? "Flap for your role" : "Compare Flap";
  const description =
    kind === "for"
      ? "ICP pages for indie hackers, startups, freelancers, developers, agencies, ecommerce, and creators."
      : "Compare Flap with Google Workspace, Microsoft 365, Zoho, Fastmail, and more.";
  const nav = kind === "for" ? FOR_NAV : VS_NAV;
  const flatNav = kind === "for" ? FOR_FLAT : VS_FLAT;
  const brandLabel = kind === "for" ? "For" : "Compare";

  useEffect(() => {
    setPageMeta({
      title: `${title} | Flap`,
      description,
      path,
    });
    setJsonLd("hub-index", [
      webPageLd({ title: `${title} | Flap`, description, path, dateModified: "2026-09-08" }),
    ]);
    return () => clearJsonLd("hub-index");
  }, [description, path, title]);

  return (
    <DocsShell
      pathname={path}
      nav={nav}
      brandHref={path}
      brandLabel={brandLabel}
      footerLinks={HUB_FOOTER_LINKS}
    >
      <DocsPage
        href={path}
        flatNav={flatNav}
        title={title}
        description={description}
        rightRail={
          <DocsRelated
            links={
              kind === "for"
                ? [
                    { href: "/vs", label: "Compare Flap" },
                    { href: "/pricing", label: "Pricing" },
                    { href: "/docs", label: "Docs" },
                  ]
                : [
                    { href: "/for", label: "Who it's for" },
                    { href: "/pricing", label: "Pricing" },
                    { href: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
                  ]
            }
          />
        }
      >
        <DocsCallout type="tip" title={kind === "for" ? "Pick your path" : "Honest comparisons"}>
          {kind === "for"
            ? "Each page is written for one ICP. Start free when the fit is clear — no sales call required."
            : "Flap is custom-domain email infrastructure, not a full Workspace suite. We say when the other product wins."}
        </DocsCallout>

        <h2 id="index">{kind === "for" ? "Roles" : "Competitors"}</h2>
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {pages.map((p) => (
            <a
              key={p.path}
              href={p.path}
              onClick={(e) => {
                e.preventDefault();
                go(p.path);
              }}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <p className="text-sm font-medium text-[var(--foreground)]">{p.h1}</p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">{p.description}</p>
            </a>
          ))}
        </div>
      </DocsPage>
    </DocsShell>
  );
}
