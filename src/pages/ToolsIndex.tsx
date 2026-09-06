import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { TOOL_PAGES } from "../content/marketing";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

function toolTitle(path: string, title: string) {
  const short = title.split("|")[0]?.trim() || title;
  if (path.includes("calculator")) return short;
  return short.replace(/\s*\|\s*Flap$/, "").trim() || short;
}

function toolBlurb(description: string) {
  return description.replace(/\s*-\s*interactive.*$/i, "").trim();
}

export default function ToolsIndex() {
  useEffect(() => {
    setPageMeta({
      title: "Free email DNS & deliverability tools | Flap",
      description: "MX, SPF, DMARC, DKIM, headers, scorecards, and more — free tools for custom-domain email.",
      path: "/tools",
    });
    setJsonLd("tools-index", webPageLd({
      title: "Flap tools",
      description: "Free DNS and deliverability tools for custom-domain email.",
      path: "/tools",
    }));
    return () => clearJsonLd("tools-index");
  }, []);

  const dns = TOOL_PAGES.filter((t) => t.kind === "dns");
  const local = TOOL_PAGES.filter((t) => t.kind === "local");
  const other = TOOL_PAGES.filter((t) => t.kind !== "dns" && t.kind !== "local");

  return (
    <MarketingShell>
      <main className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Tools</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Free email DNS & deliverability tools
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Check MX, SPF, DMARC, and more before you cut over — or while debugging deliverability.
        </p>

        {[
          { title: "DNS checks", items: dns },
          { title: "Builders & analyzers", items: local },
          { title: "Pricing & share", items: other },
        ].map((group) =>
          group.items.length ? (
            <section key={group.title} className="mt-12">
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
                {group.title}
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((t) => (
                  <li key={t.path}>
                    <a
                      href={t.path}
                      className="block h-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--cta)] hover:bg-[var(--cta-dim)]"
                      onClick={(e) => {
                        e.preventDefault();
                        go(t.path);
                      }}
                    >
                      <strong className="text-[var(--fg)]">{toolTitle(t.path, t.title)}</strong>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                        {toolBlurb(t.description)}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}

        <div className="mt-14 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-6 md:p-8">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Ready for real inboxes?</h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Flap hosts custom-domain email on Amazon SES — one inbox for every project domain.
          </p>
          <Button asChild className="mt-4">
            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                go("/signup");
              }}
            >
              Start free
            </a>
          </Button>
        </div>
      </main>
    </MarketingShell>
  );
}
