import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/status";

type Health = { ok?: boolean; name?: string; product?: string; time?: number };

export default function StatusPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setPageMeta({
      title: "Status | Flap",
      description: "Live health check for Flap (useflap.online) API and product availability.",
      path: PATH,
    });
    setJsonLd(
      "status-page",
      webPageLd({
        title: "Status | Flap",
        description: "Flap service status.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("status-page");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Health check failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ok = Boolean(health?.ok) && !error;

  return (
    <MarketingShell>
      <main className="mx-auto max-w-xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Status</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Flap status
        </h1>
        <p className="mt-4 text-[var(--muted)]">
          Lightweight public check against <code>/api/health</code>. For product notes see{" "}
          <a href="/changelog" className="text-[var(--foreground)] underline-offset-2 hover:underline">
            changelog
          </a>
          . This page is not a full incident timeline.
        </p>
        <div
          className={`mt-8 rounded-xl border px-5 py-4 ${ok ? "border-emerald-600/40 bg-emerald-500/10" : "border-[var(--line)] bg-[var(--surface)]"}`}
        >
          <p className="text-lg font-semibold">{error ? "Degraded / unreachable" : ok ? "Operational" : "Checking…"}</p>
          {error ? <p className="mt-2 text-sm text-[var(--muted)]">{error}</p> : null}
          {health?.time ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Last probe: {new Date(health.time).toISOString()} · {health.product || "useflap.online"}
            </p>
          ) : null}
        </div>
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Notes</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
            <li>No active incidents posted. When something is wrong, we will note it here with a real date.</li>
            <li>Mail delivery depends on your domain DNS (MX/SPF/DKIM) and Amazon SES; check Settings → Deliverability for bounce events.</li>
          </ul>
        </section>
      </main>
    </MarketingShell>
  );
}
