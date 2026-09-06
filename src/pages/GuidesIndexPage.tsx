import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { GUIDE_PAGES } from "../content/marketing";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/guides";

export default function GuidesIndexPage() {
  useEffect(() => {
    setPageMeta({
      title: "DNS setup guides | Flap",
      description:
        "Publish Amazon SES MX/SPF/DKIM for Flap at Cloudflare, Namecheap, Porkbun, GoDaddy, Vercel, Squarespace, or Route 53.",
      path: PATH,
    });
    setJsonLd(
      "guides-index",
      webPageLd({
        title: "DNS setup guides | Flap",
        description: "Registrar DNS guides for Flap custom-domain email.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("guides-index");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Guides</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          DNS setup guides
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Point your registrar DNS at Amazon SES with the records Flap shows in Settings → Setup. Cloudflare Email
          Routing is not required.
        </p>
        <ul className="mt-10 space-y-3">
          {GUIDE_PAGES.map((g) => (
            <li key={g.path}>
              <a
                href={g.path}
                className="block rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-medium hover:border-[var(--cta)]"
                onClick={(e) => {
                  e.preventDefault();
                  go(g.path);
                }}
              >
                {g.title.replace(" | Flap", "")}
              </a>
            </li>
          ))}
        </ul>
      </main>
    </MarketingShell>
  );
}
