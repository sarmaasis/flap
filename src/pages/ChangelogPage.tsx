import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/changelog";

/** Real product dates only — no fabricated metrics. */
const ENTRIES = [
  {
    date: "2026-09-09",
    title: "Security & multi-domain hardening",
    body: "Workspace-scoped suppressions, inbound failure breadcrumbs, HTML email sanitization defense-in-depth, and clearer deliverability event visibility in Settings.",
  },
  {
    date: "2026-09-08",
    title: "Positioning: one inbox for every product",
    body: "Homepage and trust pages centered on multi-domain → one inbox → correct reply-from. Public /migrate and /why-not-amazon-ses guides.",
  },
  {
    date: "2026-08",
    title: "SES customer-domain mail",
    body: "Inbound/outbound on Amazon SES with domain readiness (identity, MX, receiving, sending), DNS wizard, and unified inbox.",
  },
];

export default function ChangelogPage() {
  useEffect(() => {
    setPageMeta({
      title: "Changelog | Flap",
      description: "Product updates for Flap — multi-domain custom email inbox.",
      path: PATH,
    });
    setJsonLd(
      "changelog-page",
      webPageLd({
        title: "Changelog | Flap",
        description: "Flap product changelog.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("changelog-page");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-2xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Changelog</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          What shipped
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          Concise product notes. For live health, see{" "}
          <a href="/status" className="text-[var(--foreground)] underline-offset-2 hover:underline">
            status
          </a>
          .
        </p>
        <ol className="mt-10 flex flex-col gap-8">
          {ENTRIES.map((entry) => (
            <li key={entry.date + entry.title} className="border-t border-[var(--line)] pt-6">
              <time className="font-mono text-[12px] text-[var(--foreground-faint)]">{entry.date}</time>
              <h2 className="mt-2 text-lg font-semibold">{entry.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{entry.body}</p>
            </li>
          ))}
        </ol>
      </main>
    </MarketingShell>
  );
}
