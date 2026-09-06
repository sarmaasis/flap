import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

export default function NotFoundPage() {
  useEffect(() => {
    setPageMeta({
      title: "Page not found | Flap",
      description: "That URL is not a Flap page. Try tools, guides, pricing, or the home page.",
      path: "/404",
    });
    setJsonLd(
      "not-found",
      webPageLd({
        title: "Page not found | Flap",
        description: "That URL is not a Flap page.",
        path: "/404",
      }),
    );
    return () => clearJsonLd("not-found");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-xl px-5 py-20 text-center md:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">404</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Page not found
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          This path is not a Flap marketing or product page. Unknown URLs should not look like the homepage.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <a href="/" onClick={(e) => { e.preventDefault(); go("/"); }}>Home</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/tools" onClick={(e) => { e.preventDefault(); go("/tools"); }}>Tools</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/pricing" onClick={(e) => { e.preventDefault(); go("/pricing"); }}>Pricing</a>
          </Button>
        </div>
      </main>
    </MarketingShell>
  );
}
