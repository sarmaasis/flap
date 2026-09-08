import { useEffect } from "react";
import {
  DocsCallout,
  DocsPage,
  DocsRelated,
  DocsShell,
  DocsStep,
  DocsSteps,
} from "../components/docs/DocsKit";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/getting-started";

const toc = [
  { id: "checklist", label: "Checklist" },
  { id: "dns", label: "DNS tips" },
  { id: "next", label: "What next" },
];

export default function DocsGettingStartedPage() {
  useEffect(() => {
    setPageMeta({
      title: "Getting started | Flap Docs",
      description: "Add a domain, publish SES DNS, create a mailbox, and send your first Flap email.",
      path: PATH,
    });
    setJsonLd(
      "docs-getting-started",
      webPageLd({
        title: "Getting started | Flap Docs",
        description: "First custom-domain mailbox on Flap.",
        path: PATH,
      }),
    );
    return () => clearJsonLd("docs-getting-started");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Getting started"
        description="From zero to a working @yourdomain.com address. Expect DNS propagation delays — plan for that, not for Flap config thrash."
        toc={toc}
        rightRail={
          <DocsRelated
            links={[
              { href: "/docs/concepts", label: "Core concepts" },
              { href: "/guides", label: "DNS guides" },
              { href: "/app/get-started", label: "In-app checklist" },
            ]}
          />
        }
      >
        <DocsCallout type="info" title="Sign in first">
          Create a free account, then open{" "}
          <a
            href="/app/domains"
            onClick={(e) => {
              e.preventDefault();
              go("/app/domains");
            }}
          >
            Domains
          </a>{" "}
          or the{" "}
          <a
            href="/app/get-started"
            onClick={(e) => {
              e.preventDefault();
              go("/app/get-started");
            }}
          >
            Get started
          </a>{" "}
          checklist. Docs stay public; sending keys live behind auth.
        </DocsCallout>

        <h2 id="checklist">Checklist</h2>
        <DocsSteps>
          <DocsStep n={1} title="Add a domain you already own">
            <p>
              Flap does not sell domains. Use any registrar. Enter the apex name (example.com) in Settings →
              Domains.
            </p>
          </DocsStep>
          <DocsStep n={2} title="Publish the DNS records Flap shows">
            <p>
              Copy MX, SPF, and DKIM (and any SES receiving CNAMEs) into your DNS host. Prefer the provider-specific{" "}
              <a
                href="/guides"
                onClick={(e) => {
                  e.preventDefault();
                  go("/guides");
                }}
              >
                DNS guides
              </a>{" "}
              if you are unsure where the panel lives.
            </p>
          </DocsStep>
          <DocsStep n={3} title="Wait for verification">
            <p>
              Flap polls DNS and marks receiving / sending ready when records match. Propagation can take minutes to
              hours depending on TTLs.
            </p>
          </DocsStep>
          <DocsStep n={4} title="Create a mailbox">
            <p>
              Add <code>you@</code>, <code>hello@</code>, or <code>support@</code> under Mailboxes. No extra DNS is
              required per local-part once the domain is live.
            </p>
          </DocsStep>
          <DocsStep n={5} title="Send and receive a test">
            <p>
              Mail yourself from Gmail or another provider, open Flap inbox, then reply. For programmatic sends, mint
              an API key and follow the{" "}
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
          </DocsStep>
        </DocsSteps>

        <h2 id="dns">DNS tips</h2>
        <ul>
          <li>Do not mix Cloudflare Email Routing MX with Flap’s SES MX on the same zone.</li>
          <li>Keep one SPF record; merge includes rather than publishing two TXT rows.</li>
          <li>Use the free{" "}
            <a
              href="/tools"
              onClick={(e) => {
                e.preventDefault();
                go("/tools");
              }}
            >
              DNS tools
            </a>{" "}
            to confirm MX/SPF/DKIM from the public internet.
          </li>
        </ul>

        <h2 id="next">What next</h2>
        <p>
          Read{" "}
          <a
            href="/docs/concepts"
            onClick={(e) => {
              e.preventDefault();
              go("/docs/concepts");
            }}
          >
            Core concepts
          </a>{" "}
          for live vs test keys, then{" "}
          <a
            href="/docs/webhooks"
            onClick={(e) => {
              e.preventDefault();
              go("/docs/webhooks");
            }}
          >
            Webhooks
          </a>{" "}
          if you sync inbound mail into your product.
        </p>
      </DocsPage>
    </DocsShell>
  );
}
