import { useEffect } from "react";
import {
  CodeBlock,
  CodeTabs,
  DocsCallout,
  DocsPage,
  DocsRelated,
  DocsShell,
} from "../components/docs/DocsKit";
import { WEBHOOK_DOCS } from "../content/api-docs";
import { VERIFY_WEBHOOK_SNIPPETS } from "../content/docs-snippets";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/webhooks";

const toc = [
  { id: "events", label: "Events" },
  { id: "headers", label: "Headers" },
  { id: "payload", label: "Payload" },
  { id: "verify", label: "Verify signatures" },
  { id: "ops", label: "Operations" },
];

export default function DocsWebhooksPage() {
  useEffect(() => {
    setPageMeta({
      title: "Webhooks | Flap Docs",
      description: "Receive mail.received webhooks from Flap with SHA-256 signature verification.",
      path: PATH,
    });
    setJsonLd(
      "docs-webhooks",
      webPageLd({
        title: "Webhooks | Flap Docs",
        description: "Flap inbound webhook events and verification.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("docs-webhooks");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Webhooks"
        description="Flap POSTs JSON to your HTTPS endpoint when subscribed events fire. Create hooks in Settings → Developers and store the signing secret shown once."
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/api", label: "API overview" },
              { href: "/app/developer", label: "Developers settings" },
              { href: "/docs/concepts", label: "Core concepts" },
            ]}
          />
        }
      >
        <DocsCallout type="tip" title="HTTPS only">
          Webhook URLs must use <code>https://</code>. Use a tunnel (ngrok, Cloudflare Tunnel) for local development.
        </DocsCallout>

        <h2 id="events">Events</h2>
        <ul>
          {WEBHOOK_DOCS.events.map((e) => (
            <li key={e.name}>
              <code>{e.name}</code> — {e.description}
            </li>
          ))}
          <li>
            <code>*</code> — subscribe to all events
          </li>
        </ul>

        <h2 id="headers">Request headers</h2>
        <ul>
          {WEBHOOK_DOCS.headers.map((h) => (
            <li key={h.name}>
              <code>{h.name}</code> — {h.value}
            </li>
          ))}
        </ul>

        <h2 id="payload">Example payload</h2>
        <CodeBlock code={WEBHOOK_DOCS.payloadExample} language="json" title="mail.received" />

        <h2 id="verify">Verify signatures</h2>
        <p>{WEBHOOK_DOCS.verifyNote}</p>
        <CodeTabs
          tabs={[
            { id: "node", label: "Node", code: VERIFY_WEBHOOK_SNIPPETS.node, language: "ts" },
            { id: "python", label: "Python", code: VERIFY_WEBHOOK_SNIPPETS.python, language: "python" },
          ]}
        />

        <h2 id="ops">Operations</h2>
        <ul>
          {WEBHOOK_DOCS.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p>
          Failed deliveries can be redelivered from{" "}
          <a
            href="/app/developer"
            onClick={(e) => {
              e.preventDefault();
              go("/app/developer");
            }}
          >
            Developers settings
          </a>
          .
        </p>
      </DocsPage>
    </DocsShell>
  );
}
