import { useEffect } from "react";
import { DocsCallout, DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { PLANS } from "../../shared/plans";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/concepts";

const toc = [
  { id: "domain", label: "Domain" },
  { id: "mailbox", label: "Mailbox" },
  { id: "keys", label: "API keys" },
  { id: "limits", label: "Plan limits" },
];

export default function DocsConceptsPage() {
  useEffect(() => {
    setPageMeta({
      title: "Core concepts | Flap Docs",
      description: "Domains, mailboxes, live vs test API keys, and plan limits on Flap.",
      path: PATH,
    });
    setJsonLd(
      "docs-concepts",
      webPageLd({
        title: "Core concepts | Flap Docs",
        description: "Flap product model for developers.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("docs-concepts");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Core concepts"
        description="The smallest vocabulary you need before calling the API or wiring webhooks."
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/getting-started", label: "Getting started" },
              { href: "/docs/api", label: "API overview" },
              { href: "/pricing", label: "Pricing" },
            ]}
          />
        }
      >
        <h2 id="domain">Domain</h2>
        <p>
          A domain is the apex you authenticate with Amazon SES (example.com). Receiving and sending readiness are
          separate timestamps — you can receive before outbound DKIM is fully verified, depending on record state.
        </p>

        <h2 id="mailbox">Mailbox</h2>
        <p>
          A mailbox is a local-part on a verified domain (<code>hello@example.com</code>). From addresses on the send
          API must belong to a mailbox on your workspace. Shared mailboxes are available on plans that unlock team
          seats.
        </p>

        <h2 id="keys">API keys</h2>
        <p>
          Keys are created in Settings → Developers. The full token is shown once. Prefer <strong>test</strong> keys
          while integrating — Flap logs a simulated send instead of delivering mail. Switch to <strong>live</strong>{" "}
          keys for production traffic.
        </p>
        <DocsCallout type="warning" title="Treat keys like passwords">
          Rotate compromised keys immediately. Never embed live keys in public client bundles.
        </DocsCallout>

        <h2 id="limits">Plan limits</h2>
        <p>API keys and webhook slots scale with plan. Current Solo / Pro / Team caps:</p>
        <ul>
          <li>
            Solo — {PLANS.solo.limits.api_keys} API keys, {PLANS.solo.limits.webhooks} webhooks,{" "}
            {PLANS.solo.limits.send_per_month.toLocaleString()} sends / month
          </li>
          <li>
            Pro — {PLANS.pro.limits.api_keys} API keys, {PLANS.pro.limits.webhooks} webhooks,{" "}
            {PLANS.pro.limits.send_per_month.toLocaleString()} sends / month
          </li>
          <li>
            Team — {PLANS.team.limits.api_keys} API keys, {PLANS.team.limits.webhooks} webhooks,{" "}
            {PLANS.team.limits.send_per_month.toLocaleString()} sends / month
          </li>
        </ul>
        <p>
          See{" "}
          <a
            href="/pricing"
            onClick={(e) => {
              e.preventDefault();
              go("/pricing");
            }}
          >
            Pricing
          </a>{" "}
          for full allowances including domains, mailboxes, and storage.
        </p>
      </DocsPage>
    </DocsShell>
  );
}
