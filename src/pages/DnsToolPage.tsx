import { useEffect, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, softwareApplicationLd, webPageLd } from "../lib/seo";
import { TOOL_PAGES } from "../content/marketing";

type Tool = "mx" | "spf" | "dmarc" | "dkim" | "setup";

const META: Record<string, { tool: Tool; title: string; description: string; heading: string; blurb: string }> = {
  "/tools/mx-checker": {
    tool: "mx",
    title: "MX record checker | Flap",
    description: "Check MX records and whether they point at Cloudflare Email Routing.",
    heading: "MX record checker",
    blurb: "See whether mail can be delivered to your domain, and if MX points at Cloudflare Email Routing (what Flap uses).",
  },
  "/tools/spf-checker": {
    tool: "spf",
    title: "SPF checker | Flap",
    description: "Check your domain’s SPF TXT record.",
    heading: "SPF checker",
    blurb: "Lookup the SPF TXT on your apex domain and check for include:_spf.mx.cloudflare.net.",
  },
  "/tools/dmarc-checker": {
    tool: "dmarc",
    title: "DMARC checker | Flap",
    description: "Look up _dmarc TXT for your domain.",
    heading: "DMARC checker",
    blurb: "Fetch the DMARC policy at _dmarc.yourdomain and summarize it in plain English.",
  },
  "/tools/dkim-checker": {
    tool: "dkim",
    title: "DKIM checker | Flap",
    description: "Verify a DKIM selector TXT record exists.",
    heading: "DKIM checker",
    blurb: "Check a DKIM selector (default cf2024-1 for Cloudflare Email Routing).",
  },
  "/tools/email-setup-checker": {
    tool: "setup",
    title: "Email setup checker | Flap",
    description: "Combined MX, SPF, and DMARC check.",
    heading: "Email / domain setup checker",
    blurb: "One check for MX, SPF, DMARC, and DNS provider hints — with a path back to Flap when you are ready for an inbox.",
  },
};

type Result = {
  ok?: boolean;
  status?: string;
  summary?: string;
  records?: unknown;
  checks?: unknown;
  provider?: string;
  guide_path?: string | null;
  error?: string;
  selector?: string;
};

export default function DnsToolPage({ path }: { path: string }) {
  const meta = META[path] || META["/tools/mx-checker"]!;
  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("cf2024-1");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    setPageMeta({ title: meta.title, description: meta.description, path });
    trackOnce(`tool_${path}`, "seo_page_view", { path });
    setJsonLd(
      "flap-webpage",
      webPageLd({ path, title: meta.title, description: meta.description, dateModified: "2026-09-04" }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    setJsonLd("flap-tool", {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: meta.heading,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web",
      url: `https://useflap.online${path}`,
      description: meta.description,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-tool");
    };
  }, [meta, path]);

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    track("seo_tool_used", { tool: meta.tool, domain });
    try {
      const res = await fetch("/api/tools/dns-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, tool: meta.tool, selector }),
      });
      const data = (await res.json()) as Result;
      if (!res.ok) setResult({ error: data.error || "Check failed." });
      else setResult(data);
    } catch {
      setResult({ error: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const ready = result?.status === "valid_flap_ready" || result?.ok;

  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">{meta.heading}</h1>
        <p className="mt-4 text-[var(--muted)]">{meta.blurb}</p>

        <form className="mt-8 space-y-4" onSubmit={onCheck}>
          <div className="space-y-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="example.com"
              required
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          {meta.tool === "dkim" ? (
            <div className="space-y-1.5">
              <Label htmlFor="selector">DKIM selector</Label>
              <Input id="selector" value={selector} onChange={(e) => setSelector(e.target.value)} />
            </div>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Checking…" : "Check DNS"}
          </Button>
        </form>

        {result ? (
          <div className="mt-8 rounded-lg border border-[var(--line)] p-5" role="status">
            {result.error ? (
              <p className="text-sm text-red-700">{result.error}</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {result.status === "valid_flap_ready" || result.ok
                    ? "Looks good"
                    : result.status === "partial"
                      ? "Partially configured"
                      : "Needs attention"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{result.summary}</p>
                {result.provider && result.provider !== "unknown" ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Detected DNS: {result.provider}</p>
                ) : null}
                {result.records ? (
                  <pre className="mt-4 max-h-48 overflow-auto rounded bg-[var(--surface)] p-3 text-xs">
                    {JSON.stringify(result.records, null, 2)}
                  </pre>
                ) : null}
                {result.checks ? (
                  <pre className="mt-4 max-h-56 overflow-auto rounded bg-[var(--surface)] p-3 text-xs">
                    {JSON.stringify(result.checks, null, 2)}
                  </pre>
                ) : null}
                {result.guide_path ? (
                  <Button variant="outline" className="mt-4" onClick={() => go(result.guide_path!)}>
                    Open setup guide
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="mt-10 border-t border-[var(--line)] pt-8">
          <p className="text-sm text-[var(--muted)]">
            {ready
              ? "Your domain is ready. Want Flap to host the inbox?"
              : "Want Flap to host the inbox after DNS is right?"}
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              track("signup_clicked", { source: path });
              go("/signup");
            }}
          >
            Start free
          </Button>
          <ul className="mt-8 flex flex-col gap-2 text-sm">
            {TOOL_PAGES.filter((t) => t.path.startsWith("/tools/") && t.path !== path && !t.path.includes("calculator")).map((t) => (
              <li key={t.path}>
                <a href={t.path} className="text-[var(--cta)] hover:underline" onClick={(e) => { e.preventDefault(); go(t.path); }}>
                  {t.title.split("|")[0]?.trim()}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingShell>
  );
}
