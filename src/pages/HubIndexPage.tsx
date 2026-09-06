import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { FOR_PAGES, VS_PAGES } from "../content/hubs";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

export default function HubIndexPage({ kind }: { kind: "for" | "vs" }) {
  const path = kind === "for" ? "/for" : "/vs";
  const pages = kind === "for" ? FOR_PAGES : VS_PAGES;
  const title = kind === "for" ? "Flap for your role" : "Compare Flap";

  useEffect(() => {
    setPageMeta({
      title: `${title} | Flap`,
      description: kind === "for"
        ? "ICP pages for indie hackers, startups, freelancers, developers, agencies, ecommerce, and creators."
        : "Compare Flap with Google Workspace, Shipmail, Hydra, Folio, Zoho, and more.",
      path,
    });
    setJsonLd("hub-index", [
      webPageLd({ title: `${title} | Flap`, description: title, path, dateModified: "2026-09-07" }),
    ]);
    return () => clearJsonLd("hub-index");
  }, [kind, path, title]);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          {kind === "for" ? "For" : "Compare"}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        <ul className="mt-8 space-y-3">
          {pages.map((p) => (
            <li key={p.path}>
              <a
                href={p.path}
                className="block rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--cta)]"
                onClick={(e) => {
                  e.preventDefault();
                  go(p.path);
                }}
              >
                <span className="font-medium">{p.h1}</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">{p.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </article>
    </MarketingShell>
  );
}
