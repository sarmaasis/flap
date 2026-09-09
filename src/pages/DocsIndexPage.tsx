import { useEffect } from "react";
import {
  CodeTabs,
  DocsCallout,
  DocsPage,
  DocsRelated,
  DocsShell,
} from "../components/docs/DocsKit";
import { ID_PREFIXES, SEND_SNIPPETS } from "../content/docs-snippets";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs";

const toc = [
  { id: "promise", label: "Time to first send" },
  { id: "paths", label: "Pick a path" },
  { id: "ids", label: "ID prefixes" },
  { id: "send", label: "Send an email" },
];

const cards = [
  {
    href: "/docs/getting-started",
    title: "I want my first custom-domain mailbox",
    body: "Add a domain → publish DNS → create an address → send a test.",
  },
  {
    href: "/docs/api",
    title: "I want to send via API",
    body: "Mint a key, POST /api/v1/send, confirm the message id.",
  },
  {
    href: "/docs/webhooks",
    title: "I want inbound webhooks",
    body: "mail.received events, signature header, verify snippets.",
  },
  {
    href: "/docs/concepts",
    title: "I want the mental model",
    body: "Domains, mailboxes, live vs test keys, plan limits.",
  },
  {
    href: "/docs/domain-verification",
    title: "How domain verification works",
    body: "No send from unverified or foreign domains.",
  },
  {
    href: "/docs/bounces-and-complaints",
    title: "Bounces and complaints",
    body: "Workspace-scoped suppressions and 72-hour soft bounces.",
  },
  {
    href: "/guides",
    title: "I need DNS at my registrar",
    body: "Cloudflare, Namecheap, Route 53, and more.",
  },
  {
    href: "/app/developer",
    title: "I want the in-app developer console",
    body: "API keys, webhooks, and delivery history.",
  },
];

export default function DocsIndexPage() {
  useEffect(() => {
    setPageMeta({
      title: "Custom-domain email docs: API, DNS setup and webhooks | Flap",
      description: "Developer documentation for Flap: publish DNS for your custom domain, send transactional email via REST API, receive inbound webhooks, and manage mailboxes.",
      path: PATH,
    });
    setJsonLd(
      "docs-index",
      webPageLd({
        title: "Custom-domain email docs: API, DNS setup and webhooks | Flap",
        description: "Flap developer documentation: custom-domain email setup, send API, and inbound webhook reference.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("docs-index");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Flap docs"
        description="Custom-domain email for founders. Publish DNS once, then send and receive from the web app or HTTPS API."
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/getting-started", label: "Getting started" },
              { href: "/docs/api", label: "API overview" },
              { href: "/llms.txt", label: "llms.txt" },
            ]}
          />
        }
      >
        <DocsCallout type="tip" title="Activation goal">
          Domain verified for receiving, one mailbox live, and a successful send (inbox or API) in the same
          afternoon. Product setup continues in{" "}
          <a
            href="/app/get-started"
            onClick={(e) => {
              e.preventDefault();
              go("/app/get-started");
            }}
          >
            Get started
          </a>
          .
        </DocsCallout>

        <h2 id="promise">Time to first send</h2>
        <p>
          Shortest path: add a domain in Settings, publish the MX/SPF/DKIM records Flap shows, create{" "}
          <code>you@yourdomain.com</code>, then mail yourself from another account and reply from the inbox.
        </p>
        <p>
          Prefer a guided checklist? Start with{" "}
          <a
            href="/docs/getting-started"
            onClick={(e) => {
              e.preventDefault();
              go("/docs/getting-started");
            }}
          >
            Getting started
          </a>
          . Building automations? Jump to the{" "}
          <a
            href="/docs/api"
            onClick={(e) => {
              e.preventDefault();
              go("/docs/api");
            }}
          >
            API overview
          </a>
          .
        </p>

        <h2 id="paths">Pick a path</h2>
        <div className="not-prose grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <a
              key={c.href}
              href={c.href}
              onClick={(e) => {
                e.preventDefault();
                go(c.href);
              }}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface-raised)] p-4 transition-colors hover:bg-[var(--surface-hover)]"
            >
              <p className="text-sm font-medium text-[var(--foreground)]">{c.title}</p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">{c.body}</p>
            </a>
          ))}
        </div>

        <h2 id="ids">ID prefixes</h2>
        <p>Resource ids are prefixed so logs and support tickets stay scannable.</p>
        <div className="not-prose flex flex-wrap gap-2">
          {ID_PREFIXES.map((item) => (
            <span
              key={item.prefix}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3 py-1 text-xs"
            >
              <code className="font-mono text-[var(--foreground)]">{item.prefix}</code>
              <span className="text-[var(--foreground-muted)]">{item.meaning}</span>
            </span>
          ))}
        </div>

        <h2 id="send">Send an email</h2>
        <p>
          Base URL: <code>https://useflap.online</code>. Authenticate with{" "}
          <code>Authorization: Bearer flap_…</code> from Settings → Developers.
        </p>
        <CodeTabs
          tabs={[
            { id: "curl", label: "curl", code: SEND_SNIPPETS.curl, language: "bash" },
            { id: "node", label: "Node", code: SEND_SNIPPETS.node, language: "ts" },
            { id: "python", label: "Python", code: SEND_SNIPPETS.python, language: "python" },
          ]}
        />
      </DocsPage>
    </DocsShell>
  );
}
