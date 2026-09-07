import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import { API_DOCS, API_SEND, WEBHOOK_DOCS } from "../content/api-docs";
import { PLANS } from "../../shared/plans";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

export default function DocsApiPage() {
  useEffect(() => {
    setPageMeta({
      title: API_DOCS.title,
      description: API_DOCS.description,
      path: API_DOCS.path,
    });
    setJsonLd(
      "docs-api",
      webPageLd({
        title: API_DOCS.title,
        description: API_DOCS.description,
        path: API_DOCS.path,
        dateModified: API_DOCS.updated,
      }),
    );
    return () => clearJsonLd("docs-api");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Docs · Developers
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          {API_DOCS.h1}
        </h1>
        <LastUpdated date={API_DOCS.updated} />
        <p className="mt-5 text-lg text-[var(--muted)]">{API_DOCS.lede}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => go("/signup")}>Start free</Button>
          <Button variant="outline" onClick={() => go("/app/developer")}>
            Open Developers settings
          </Button>
        </div>

        <h2 className="mt-12 text-xl font-semibold">Plan access</h2>
        <p className="mt-3 text-[15px] text-[var(--muted)]">
          Create API keys and webhooks in Settings → Developers. Limits by plan:
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-[var(--muted)]">
          <li>
            Solo — {PLANS.solo.limits.api_keys} API keys, {PLANS.solo.limits.webhooks} webhooks
          </li>
          <li>
            Pro — {PLANS.pro.limits.api_keys} API keys, {PLANS.pro.limits.webhooks} webhooks
          </li>
          <li>
            Team — {PLANS.team.limits.api_keys} API keys, {PLANS.team.limits.webhooks} webhooks
          </li>
        </ul>

        <h2 className="mt-12 text-xl font-semibold">Send mail — POST /api/v1/send</h2>
        <p className="mt-3 text-[15px] text-[var(--muted)]">
          Authenticate with a Bearer API key. Base URL:{" "}
          <code className="text-[var(--fg)]">https://useflap.online</code>
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] leading-relaxed text-[var(--fg)]">
{`curl -X POST https://useflap.online/api/v1/send \\
  -H "Authorization: Bearer flap_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "customer@example.com",
    "subject": "Thanks for signing up",
    "text": "Welcome to the product.",
    "html": "<p>Welcome to the product.</p>",
    "from": "hello@yourdomain.com"
  }'`}
        </pre>
        <h3 className="mt-8 text-base font-semibold">Body fields</h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          {Object.entries(API_SEND.body).map(([k, v]) => (
            <li key={k}>
              <code className="text-[var(--fg)]">{k}</code> — {v}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-base font-semibold">Success</h3>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] text-[var(--fg)]">
          {API_SEND.success}
        </pre>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          {API_SEND.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <h2 className="mt-12 text-xl font-semibold">Inbound webhooks</h2>
        <p className="mt-3 text-[15px] text-[var(--muted)]">
          Flap POSTs JSON to your HTTPS endpoint when subscribed events fire. Create a webhook in Settings →
          Developers and store the signing secret.
        </p>
        <h3 className="mt-8 text-base font-semibold">Events</h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          {WEBHOOK_DOCS.events.map((e) => (
            <li key={e.name}>
              <code className="text-[var(--fg)]">{e.name}</code> — {e.description}
            </li>
          ))}
          <li>
            <code className="text-[var(--fg)]">*</code> — subscribe to all events
          </li>
        </ul>
        <h3 className="mt-8 text-base font-semibold">Request headers</h3>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          {WEBHOOK_DOCS.headers.map((h) => (
            <li key={h.name}>
              <code className="text-[var(--fg)]">{h.name}</code> — {h.value}
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-base font-semibold">Example payload</h3>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] leading-relaxed text-[var(--fg)]">
          {WEBHOOK_DOCS.payloadExample}
        </pre>
        <h3 className="mt-8 text-base font-semibold">Verify signatures</h3>
        <p className="mt-3 text-[15px] text-[var(--muted)]">{WEBHOOK_DOCS.verifyNote}</p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[13px] leading-relaxed text-[var(--fg)]">
{`// Node / Cloudflare Worker sketch
import { createHash } from "node:crypto";

function verify(secret, rawBody, headerSig) {
  const expected = createHash("sha256")
    .update(\`\${secret}.\${rawBody}\`, "utf8")
    .digest("hex");
  return expected === headerSig;
}`}
        </pre>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          {WEBHOOK_DOCS.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <h2 className="mt-12 text-xl font-semibold">Related</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] text-[var(--muted)]">
          <li>
            <a className="text-[var(--cta)] underline-offset-2 hover:underline" href="/#pricing" onClick={(e) => { e.preventDefault(); go("/#pricing"); }}>
              Pricing
            </a>
          </li>
          <li>
            <a className="text-[var(--cta)] underline-offset-2 hover:underline" href="/tools" onClick={(e) => { e.preventDefault(); go("/tools"); }}>
              Free tools
            </a>
          </li>
          <li>
            <a className="text-[var(--cta)] underline-offset-2 hover:underline" href="/guides/cloudflare-custom-domain-email" onClick={(e) => { e.preventDefault(); go("/guides/cloudflare-custom-domain-email"); }}>
              DNS setup guides
            </a>
          </li>
        </ul>
      </article>
    </MarketingShell>
  );
}
