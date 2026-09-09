import { useEffect } from "react";
import { DocsCallout, DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/domain-verification";

export default function DocsDomainVerificationPage() {
  useEffect(() => {
    setPageMeta({
      title: "Domain verification | Flap Docs",
      description: "Every Flap sending domain must complete DNS-based verification before outbound email is enabled.",
      path: PATH,
    });
    setJsonLd("docs-domain-verification", webPageLd({
      title: "Domain verification | Flap Docs",
      description: "How Flap verifies custom sending domains.",
      path: PATH,
    }));
    return () => clearJsonLd("docs-domain-verification");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Domain verification"
        description="Flap does not allow arbitrary sender domains."
        toc={[
          { id: "rule", label: "The rule" },
          { id: "steps", label: "What Flap checks" },
        ]}
        rightRail={<DocsRelated links={[{ href: "/docs/getting-started", label: "Getting started" }, { href: "/docs/deliverability", label: "Deliverability" }]} />}
      >
        <h2 id="rule">Every sending domain must be verified</h2>
        <p>
          Before outbound email can be enabled, the domain must be added to an authenticated Flap workspace and pass
          DNS-based verification. Users may only send from mailboxes associated with domains they are authorized to
          manage.
        </p>
        <DocsCallout title="Not an open relay">
          Signing up and typing an arbitrary hostname does not let you send as that domain. Sender identities are
          checked server-side on compose, reply, scheduled send, newsletters, and the send API.
        </DocsCallout>
        <h2 id="steps">What Flap checks</h2>
        <ul>
          <li>Domain ownership / SES identity verification</li>
          <li>DKIM and sending readiness</li>
          <li>Workspace ownership of the domain row</li>
          <li>From address belongs to a mailbox on that domain</li>
        </ul>
      </DocsPage>
    </DocsShell>
  );
}
