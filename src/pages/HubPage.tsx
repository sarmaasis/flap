import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { hubByPath } from "../content/hubs";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import NotFoundPage from "./NotFoundPage";

export default function HubPage({ path }: { path: string }) {
  const page = hubByPath(path);
  useEffect(() => {
    if (!page) return;
    setPageMeta({ title: page.title, description: page.description, path: page.path });
    setJsonLd("hub-page", [
      webPageLd({
        title: page.title,
        description: page.description,
        path: page.path,
        dateModified: "2026-09-07",
      }),
    ]);
    return () => clearJsonLd("hub-page");
  }, [page]);

  if (!page) return <NotFoundPage />;

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          {page.path.startsWith("/for") ? "For" : "Compare"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{page.h1}</h1>
        <div className="mt-6 space-y-4 text-lg text-[var(--muted)]">
          {page.body.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button onClick={() => go("/signup")}>Start free</Button>
          <Button variant="outline" onClick={() => go("/pricing")}>
            See pricing
          </Button>
        </div>
      </article>
    </MarketingShell>
  );
}
