import { useEffect, useMemo, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  clearJsonLd,
  faqPageLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webApplicationToolLd,
  webPageLd,
} from "../lib/seo";
import { TOOL_PAGES } from "../content/marketing";
import { getToolExplainer } from "../content/tool-explainers";

type Result = {
  ok?: boolean;
  status?: string;
  summary?: string;
  records?: unknown;
  checks?: unknown;
  provider?: string;
  guide_path?: string | null;
  error?: string;
  grade?: string;
  score?: number;
  whois_hint?: string;
  [key: string]: unknown;
};

type ToolMeta = {
  tool: string;
  kind: "dns" | "local";
  title: string;
  description: string;
  heading: string;
  blurb: string;
};

function metaForPath(path: string): ToolMeta {
  const row = TOOL_PAGES.find((t) => t.path === path) as
    | { path: string; title: string; description: string; kind?: string; tool?: string }
    | undefined;
  const tool = row?.tool || "mx";
  const kind = (row?.kind === "local" ? "local" : "dns") as "dns" | "local";
  const heading = (row?.title || "DNS tool").split("|")[0]?.trim() || "DNS tool";
  return {
    tool,
    kind,
    title: row?.title || "Flap tools",
    description: row?.description || "",
    heading,
    blurb: row?.description || "",
  };
}

function analyzeHeaders(raw: string) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const headers: Array<{ name: string; value: string }> = [];
  let cur: { name: string; value: string } | null = null;
  for (const line of lines) {
    if (!line.trim()) break;
    if (/^\s/.test(line) && cur) {
      cur.value += " " + line.trim();
      continue;
    }
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) {
      if (cur) headers.push(cur);
      cur = { name: m[1]!, value: m[2]! };
    }
  }
  if (cur) headers.push(cur);
  const get = (n: string) => headers.filter((h) => h.name.toLowerCase() === n.toLowerCase()).map((h) => h.value);
  return {
    ok: headers.length > 0,
    status: headers.length ? "valid" : "invalid",
    summary: headers.length
      ? `Parsed ${headers.length} header fields. Auth-Results and Received tell the delivery story.`
      : "Paste full raw headers (from Show original).",
    records: {
      from: get("From"),
      to: get("To"),
      subject: get("Subject"),
      received: get("Received"),
      auth_results: get("Authentication-Results"),
      dkim: get("DKIM-Signature"),
      spf_via_auth: get("Authentication-Results").filter((v) => /spf=/i.test(v)),
      arc: get("ARC-Authentication-Results"),
    },
  };
}

function localResult(tool: string, domain: string, extra: string): Result {
  if (tool === "headers") return analyzeHeaders(extra);
  if (tool === "dmarc-gen") {
    const rua = extra.trim() || `dmarc@${domain || "example.com"}`;
    const record = `v=DMARC1; p=none; rua=mailto:${rua}; ruf=mailto:${rua}; fo=1; adkim=r; aspf=r`;
    return {
      ok: true,
      status: "valid",
      summary: "Paste this TXT at _dmarc." + (domain || "yourdomain") + ". Start with p=none, then quarantine, then reject.",
      records: { host: `_dmarc.${domain || "example.com"}`, type: "TXT", value: record },
    };
  }
  if (tool === "spf-flat") {
    const includes = extra
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const parts = ["v=spf1", ...includes.map((i) => (i.startsWith("include:") ? i : `include:${i}`)), "~all"];
    const lookupEstimate = 1 + includes.length;
    return {
      ok: lookupEstimate <= 10,
      status: lookupEstimate <= 10 ? "valid" : "invalid",
      summary:
        lookupEstimate <= 10
          ? `SPF draft uses ~${lookupEstimate} DNS lookups (limit is 10). Flatten providers if you grow past the limit.`
          : `Too many lookups (~${lookupEstimate}). Flatten or remove includes.`,
      records: { value: parts.join(" "), lookup_estimate: lookupEstimate },
    };
  }
  if (tool === "dkim-gen") {
    return {
      ok: true,
      status: "valid",
      summary:
        "Flap uses Amazon SES Easy DKIM. Copy the exact CNAME tokens from Settings → Setup after you add the domain. Do not invent selectors.",
      records: {
        tip: "SES publishes three CNAME records under selector tokens. Legacy smtp._domainkey is not required for SES Easy DKIM.",
        host_examples: [`<token>._domainkey.${domain || "example.com"}`],
      },
    };
  }
  if (tool === "plus") {
    const [local, host] = (domain.includes("@") ? domain : `hello@${domain || "example.com"}`).split("@");
    const tag = (extra || "stripe").replace(/[^a-z0-9._-]/gi, "") || "tag";
    const address = `${local}+${tag}@${host}`;
    return {
      ok: true,
      status: "valid",
      summary: "Plus-address ready. Create aliases in Flap or rely on catch-all + plus tags.",
      records: { address, copy: address },
    };
  }
  if (tool === "from-mismatch") {
    return {
      ok: true,
      status: "valid",
      summary:
        "Replying from the wrong domain is the #1 multi-domain failure. Flap locks From to the inbound address on reply; override only via verified aliases on that domain.",
      records: {
        bad: "Customer mails sales@shop.com → you reply from founder@other.io",
        good: "Reply From stays sales@shop.com (locked). Reputation stays with shop.com.",
        flap: "From lock + domain color chips make the identity obvious before send.",
      },
    };
  }
  if (tool === "arc") {
    return {
      ok: true,
      status: "valid",
      summary:
        "Forwarders break SPF alignment. ARC (Authenticated Received Chain) lets receivers trust prior authentication. Flap receives on SES; prefer re-sending as the brand instead of fragile Gmail forwards.",
      records: {
        symptom: "DMARC fail on forwarded mail",
        fix: "Host the mailbox (Flap) or use ARC-aware forwarders; publish DMARC carefully.",
      },
    };
  }
  if (tool === "registrar") {
    const d = domain || "example.com";
    return {
      ok: true,
      status: "valid",
      summary: "Paste-ready starter block. Replace SES region and DKIM tokens with values from Flap Setup.",
      records: {
        mx: [
          { type: "MX", host: d, value: "10 inbound-smtp.us-east-1.amazonaws.com" },
        ],
        spf: [{ type: "TXT", host: d, value: "v=spf1 include:amazonses.com ~all" }],
        dmarc: [{ type: "TXT", host: `_dmarc.${d}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${d}` }],
        note: "Exact MX host and DKIM CNAMEs come from your Flap domain card after provisioning.",
      },
    };
  }
  return { error: "Unknown local tool." };
}

export default function DnsToolPage({ path }: { path: string }) {
  const meta = useMemo(() => metaForPath(path), [path]);
  const explainer = useMemo(() => getToolExplainer(path), [path]);
  const [domain, setDomain] = useState("");
  const [selector, setSelector] = useState("smtp");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    setPageMeta({ title: meta.title, description: meta.description, path });
    trackOnce(`tool_${path}`, "seo_page_view", { path });
    setJsonLd(
      "flap-webpage",
      webPageLd({
        path,
        title: meta.title,
        description: meta.description,
        dateModified: explainer?.updated || "2026-09-07",
      }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    setJsonLd(
      "flap-tool",
      webApplicationToolLd({ name: meta.heading, path, description: meta.description }),
    );
    if (explainer?.faqs.length) setJsonLd("flap-faq", faqPageLd(explainer.faqs));
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-tool");
      clearJsonLd("flap-faq");
    };
  }, [meta, path, explainer]);

  async function onCheck(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    track("tool_started", { tool: meta.tool });
    track("seo_tool_used", { tool: meta.tool });
    try {
      if (meta.kind === "local") {
        const local = localResult(meta.tool, domain, extra);
        setResult(local);
        if (local.error) track("tool_error", { tool: meta.tool });
        else track("tool_completed", { tool: meta.tool, ok: Boolean(local.ok) });
        return;
      }
      const res = await fetch("/api/tools/dns-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, tool: meta.tool, selector }),
      });
      const data = (await res.json()) as Result;
      if (!res.ok) {
        setResult({ error: data.error || "Check failed." });
        track("tool_error", { tool: meta.tool });
      } else {
        setResult(data);
        track("tool_completed", {
          tool: meta.tool,
          ok: Boolean(data.ok || data.status === "valid_flap_ready"),
        });
      }
    } catch {
      setResult({ error: "Network error. Try again." });
      track("tool_error", { tool: meta.tool });
    } finally {
      setBusy(false);
    }
  }

  const ready = result?.status === "valid_flap_ready" || result?.ok;
  const needsDomain = meta.tool !== "headers" && meta.tool !== "from-mismatch" && meta.tool !== "arc";
  const needsExtra =
    meta.tool === "headers" ||
    meta.tool === "spf-flat" ||
    meta.tool === "dmarc-gen" ||
    meta.tool === "plus";

  return (
    <MarketingShell>
      <div className="mx-auto max-w-xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">{meta.heading}</h1>
        {explainer ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            Last updated: <time dateTime={explainer.updated}>{explainer.updated}</time>
          </p>
        ) : null}
        <p className="mt-4 text-[var(--muted)]">{explainer?.answerFirst || meta.blurb}</p>

        {explainer ? (
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
            <p>
              <strong className="text-[var(--fg)]">What this tool checks: </strong>
              {explainer.whatItChecks}
            </p>
            <p className="rounded-md border border-[var(--line)] px-3 py-2 text-xs">
              Passing a DNS check does not guarantee inbox placement. SPF, DKIM, and DMARC are
              authentication signals — not delivery promises.
            </p>
          </div>
        ) : null}

        <form className="mt-8 space-y-4" onSubmit={onCheck}>
          {needsDomain ? (
            <div className="space-y-1.5">
              <Label htmlFor="domain">{meta.tool === "plus" ? "Address or domain" : meta.tool === "ptr" ? "Domain or IPv4" : "Domain"}</Label>
              <Input
                id="domain"
                type="text"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={meta.tool === "plus" ? "hello@example.com" : "example.com"}
                required={meta.tool !== "dmarc-gen" && meta.tool !== "dkim-gen" && meta.tool !== "registrar"}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>
          ) : null}
          {meta.tool === "dkim" ? (
            <div className="space-y-1.5">
              <Label htmlFor="selector">DKIM selector</Label>
              <Input id="selector" value={selector} onChange={(e) => setSelector(e.target.value)} />
            </div>
          ) : null}
          {needsExtra ? (
            <div className="space-y-1.5">
              <Label htmlFor="extra">
                {meta.tool === "headers"
                  ? "Raw headers"
                  : meta.tool === "spf-flat"
                    ? "Includes (one per line)"
                    : meta.tool === "dmarc-gen"
                      ? "rua email"
                      : "Plus tag"}
              </Label>
              <textarea
                id="extra"
                className="flex min-h-28 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder={
                  meta.tool === "headers"
                    ? "Paste raw headers…"
                    : meta.tool === "spf-flat"
                      ? "include:amazonses.com"
                      : meta.tool === "plus"
                        ? "stripe"
                        : "dmarc@example.com"
                }
                required={meta.tool === "headers"}
              />
            </div>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Working…" : meta.kind === "local" ? "Generate" : "Check"}
          </Button>
        </form>

        {result ? (
          <div className="mt-8 rounded-lg border border-[var(--line)] p-5" role="status">
            {result.error ? (
              <p className="text-sm text-red-700">{result.error}</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {result.grade
                    ? `Grade ${result.grade}${typeof result.score === "number" ? ` (${result.score}/100)` : ""}`
                    : result.status === "valid_flap_ready" || result.ok
                      ? "Looks good"
                      : result.status === "partial"
                        ? "Partially configured"
                        : "Needs attention"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{result.summary}</p>
                {result.provider && result.provider !== "unknown" ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">Detected DNS: {String(result.provider)}</p>
                ) : null}
                {result.whois_hint ? (
                  <p className="mt-2 text-sm">
                    <a className="text-[var(--cta)] underline" href={String(result.whois_hint)} target="_blank" rel="noreferrer">
                      Open WHOIS
                    </a>
                  </p>
                ) : null}
                {result.records ? (
                  <pre className="mt-4 max-h-56 overflow-auto rounded bg-[var(--surface)] p-3 text-xs">
                    {JSON.stringify(result.records, null, 2)}
                  </pre>
                ) : null}
                {result.checks ? (
                  <pre className="mt-4 max-h-56 overflow-auto rounded bg-[var(--surface)] p-3 text-xs">
                    {JSON.stringify(result.checks, null, 2)}
                  </pre>
                ) : null}
                {result.guide_path ? (
                  <Button variant="outline" className="mt-4" onClick={() => go(String(result.guide_path))}>
                    Open setup guide
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <div className="mt-10 border-t border-[var(--line)] pt-8">
          {explainer ? (
            <div className="mb-10 space-y-8 text-sm leading-relaxed text-[var(--muted)]">
              <section>
                <h2 className="text-lg font-semibold text-[var(--fg)]">How to interpret results</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {explainer.interpret.map((row) => (
                    <li key={row.state}>
                      <strong className="text-[var(--fg)]">{row.state}:</strong> {row.meaning}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="text-lg font-semibold text-[var(--fg)]">Examples</h2>
                {explainer.examples.map((ex) => (
                  <div key={ex.label} className="mt-3">
                    <p className="font-medium text-[var(--fg)]">{ex.label}</p>
                    <p className="mt-1">{ex.body}</p>
                  </div>
                ))}
              </section>
              <section>
                <h2 className="text-lg font-semibold text-[var(--fg)]">Common errors</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {explainer.commonErrors.map((row) => (
                    <li key={row.error}>
                      <strong className="text-[var(--fg)]">{row.error}.</strong> {row.fix}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h2 className="text-lg font-semibold text-[var(--fg)]">References</h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {explainer.references.map((r) => (
                    <li key={r.href}>
                      <a
                        href={r.href}
                        className="text-[var(--cta)] hover:underline"
                        {...(r.href.startsWith("http")
                          ? { target: "_blank", rel: "noreferrer" }
                          : {
                              onClick: (e: React.MouseEvent) => {
                                e.preventDefault();
                                go(r.href);
                              },
                            })}
                      >
                        {r.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
              {explainer.faqs.length ? (
                <section>
                  <h2 className="text-lg font-semibold text-[var(--fg)]">FAQ</h2>
                  {explainer.faqs.map((f) => (
                    <div key={f.q} className="mt-3">
                      <h3 className="font-medium text-[var(--fg)]">{f.q}</h3>
                      <p className="mt-1">{f.a}</p>
                    </div>
                  ))}
                </section>
              ) : null}
              <section>
                <h2 className="text-lg font-semibold text-[var(--fg)]">Next steps</h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {explainer.nextLinks.map((l) => (
                    <li key={l.href}>
                      <a
                        href={l.href}
                        className="text-[var(--cta)] hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          go(l.href);
                        }}
                      >
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
          <p className="text-sm font-medium">Fix this permanently in the Flap DNS wizard</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {ready
              ? "Your domain looks ready. Want Flap to host the inbox on Amazon SES?"
              : "Add the domain in Flap, copy MX/SPF/DKIM, and finish with a green receiving check."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <a
                href="/signup"
                onClick={(e) => {
                  e.preventDefault();
                  track("signup_clicked", { source: path });
                  go("/signup");
                }}
              >
                Start free
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/guides" onClick={(e) => { e.preventDefault(); go("/guides"); }}>
                DNS guides
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="/app/domains" onClick={(e) => { e.preventDefault(); go("/app/domains"); }}>
                DNS wizard
              </a>
            </Button>
          </div>
          <ul className="mt-8 flex flex-col gap-2 text-sm">
            {TOOL_PAGES.filter((t) => t.path.startsWith("/tools/") && t.path !== path && !t.path.includes("calculator") && !t.path.includes("share")).slice(0, 12).map((t) => (
              <li key={t.path}>
                <a
                  href={t.path}
                  className="text-[var(--cta)] hover:underline"
                  onClick={(e) => {
                    e.preventDefault();
                    go(t.path);
                  }}
                >
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
