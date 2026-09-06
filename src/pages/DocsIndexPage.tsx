import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { API_DOCS } from "../content/api-docs";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs";

export default function DocsIndexPage() {
  useEffect(() => {
    setPageMeta({
      title: "Docs | Flap",
      description: "Developer documentation for Flap API keys, send API, and inbound webhooks.",
      path: PATH,
    });
    setJsonLd(
      "docs-index",
      webPageLd({
        title: "Docs | Flap",
        description: "Flap developer documentation index.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("docs-index");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Docs</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Flap documentation
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Public developer docs for send and webhooks. Product setup lives in Settings after you sign up.
        </p>
        <ul className="mt-10 space-y-4">
          <li className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5">
            <a
              href={API_DOCS.path}
              className="text-lg font-semibold text-[var(--fg)] hover:text-[var(--cta)]"
              onClick={(e) => {
                e.preventDefault();
                go(API_DOCS.path);
              }}
            >
              API & webhooks
            </a>
            <p className="mt-2 text-sm text-[var(--muted)]">{API_DOCS.description}</p>
          </li>
        </ul>
        <Button asChild className="mt-10" variant="outline">
          <a href="/guides" onClick={(e) => { e.preventDefault(); go("/guides"); }}>
            DNS setup guides
          </a>
        </Button>
      </main>
    </MarketingShell>
  );
}
