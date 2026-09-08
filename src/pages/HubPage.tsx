import { useEffect } from "react";
import { DocsCallout, DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { Button } from "../components/ui/button";
import { FOR_PAGES, VS_PAGES, hubByPath } from "../content/hubs";
import { FOR_FLAT, FOR_NAV, HUB_FOOTER_LINKS, VS_FLAT, VS_NAV } from "../content/hubs-nav";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import NotFoundPage from "./NotFoundPage";

export default function HubPage({ path }: { path: string }) {
  const page = hubByPath(path);
  const isFor = path.startsWith("/for");
  const nav = isFor ? FOR_NAV : VS_NAV;
  const flatNav = isFor ? FOR_FLAT : VS_FLAT;
  const siblings = (isFor ? FOR_PAGES : VS_PAGES).filter((p) => p.path !== path).slice(0, 5);

  useEffect(() => {
    if (!page) return;
    setPageMeta({ title: page.title, description: page.description, path: page.path });
    setJsonLd("hub-page", [
      webPageLd({
        title: page.title,
        description: page.description,
        path: page.path,
        dateModified: "2026-09-08",
      }),
    ]);
    return () => clearJsonLd("hub-page");
  }, [page]);

  if (!page) return <NotFoundPage />;

  return (
    <DocsShell
      pathname={path}
      nav={nav}
      brandHref={isFor ? "/for" : "/vs"}
      brandLabel={isFor ? "For" : "Compare"}
      footerLinks={HUB_FOOTER_LINKS}
    >
      <DocsPage
        href={path}
        flatNav={flatNav}
        title={page.h1}
        description={page.description}
        toc={[
          { id: "summary", label: "Summary" },
          { id: "next", label: "Next steps" },
        ]}
        rightRail={
          <DocsRelated
            links={[
              { href: isFor ? "/for" : "/vs", label: isFor ? "All roles" : "All comparisons" },
              ...siblings.map((p) => ({ href: p.path, label: p.h1 })),
              { href: "/pricing", label: "Pricing" },
            ]}
          />
        }
      >
        <DocsCallout type="info" title={isFor ? "Who this is for" : "Quick take"}>
          {isFor
            ? "Built for portfolio founders and small teams who need @yourdomain.com without a seat tax per launch."
            : "Flap is email infrastructure. Suites win when you need Docs, Drive, or Meet in the same vendor."}
        </DocsCallout>

        <h2 id="summary">Summary</h2>
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 id="next">Next steps</h2>
        <p>
          {isFor
            ? "Start free, add a domain you already own, and follow the DNS checklist in Get started."
            : "If Flap fits, start free and publish DNS. If you need a full suite (Docs/Drive/Meet), keep Workspace."}
        </p>
        <div className="not-prose mt-4 flex flex-wrap gap-3">
          <Button type="button" onClick={() => go("/signup")}>
            {page.cta || "Start free"}
          </Button>
          <Button type="button" variant="outline" onClick={() => go("/pricing")}>
            See pricing
          </Button>
          {!isFor ? (
            <Button type="button" variant="ghost" onClick={() => go("/tools/google-workspace-cost-calculator")}>
              Cost calculator
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => go("/docs/getting-started")}>
              Getting started
            </Button>
          )}
        </div>
      </DocsPage>
    </DocsShell>
  );
}
