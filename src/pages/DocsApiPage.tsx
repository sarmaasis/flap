import { useEffect } from "react";
import {
  CodeBlock,
  CodeTabs,
  DocsCallout,
  DocsPage,
  DocsRelated,
  DocsShell,
} from "../components/docs/DocsKit";
import { API_DOCS, API_SEND } from "../content/api-docs";
import { SEND_SNIPPETS, SITE_API_BASE } from "../content/docs-snippets";
import { PLANS } from "../../shared/plans";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/api";

const toc = [
  { id: "auth", label: "Authentication" },
  { id: "send", label: "POST /api/v1/send" },
  { id: "errors", label: "Errors" },
  { id: "limits", label: "Limits" },
  { id: "webhooks", label: "Webhooks" },
];

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
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="API overview"
        description={API_DOCS.lede}
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/webhooks", label: "Webhooks guide" },
              { href: "/docs/concepts", label: "Core concepts" },
              { href: "/app/developer", label: "Create an API key" },
            ]}
          />
        }
      >
        <div className="not-prose mb-2 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
            onClick={() => go("/signup")}
          >
            Start free
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl border border-[var(--line-strong)] bg-transparent px-4 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-hover)]"
            onClick={() => go("/app/developer")}
          >
            Open Developers settings
          </button>
        </div>

        <h2 id="auth">Authentication</h2>
        <p>
          All send requests use a Bearer token: <code>{API_SEND.auth}</code>. Base URL:{" "}
          <code>{SITE_API_BASE}</code>. Create keys in Settings → Developers. Test keys simulate delivery; live keys
          count against quota.
        </p>
        <DocsCallout type="info" title="Versioning">
          The public send surface is <code>/api/v1/*</code>. Breaking changes ship under a new version prefix.
        </DocsCallout>

        <h2 id="send">POST /api/v1/send</h2>
        <CodeTabs
          tabs={[
            { id: "curl", label: "curl", code: SEND_SNIPPETS.curl, language: "bash" },
            { id: "node", label: "Node", code: SEND_SNIPPETS.node, language: "ts" },
            { id: "python", label: "Python", code: SEND_SNIPPETS.python, language: "python" },
          ]}
        />

        <h3 id="body">Body fields</h3>
        <ul>
          {Object.entries(API_SEND.body).map(([k, v]) => (
            <li key={k}>
              <code>{k}</code> — {v}
            </li>
          ))}
        </ul>

        <h3 id="success">Success</h3>
        <CodeBlock code={API_SEND.success} language="json" title="200" />
        <ul>
          {API_SEND.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>

        <h2 id="errors">Errors</h2>
        <p>
          Non-2xx responses return JSON with a human-readable <code>error</code> (or message) string. Common cases:
          missing auth, from-address not on a workspace mailbox, plan quota exceeded, and domain not sending-ready.
        </p>

        <h2 id="limits">Limits</h2>
        <ul>
          <li>
            Solo — {PLANS.solo.limits.api_keys} keys, {PLANS.solo.limits.webhooks} webhooks
          </li>
          <li>
            Pro — {PLANS.pro.limits.api_keys} keys, {PLANS.pro.limits.webhooks} webhooks
          </li>
          <li>
            Team — {PLANS.team.limits.api_keys} keys, {PLANS.team.limits.webhooks} webhooks
          </li>
        </ul>
        <p>Sends count toward the monthly outbound quota and storage limits for your plan.</p>

        <h2 id="webhooks">Webhooks</h2>
        <p>
          Inbound event delivery is documented on the{" "}
          <a
            href="/docs/webhooks"
            onClick={(e) => {
              e.preventDefault();
              go("/docs/webhooks");
            }}
          >
            Webhooks
          </a>{" "}
          guide (events, headers, verify snippets, redelivery).
        </p>
      </DocsPage>
    </DocsShell>
  );
}
