import { useEffect } from "react";
import { DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/deliverability";

export default function DocsDeliverabilityPage() {
  useEffect(() => {
    setPageMeta({
      title: "Deliverability | Flap Docs",
      description: "How Flap handles SES delivery events, suppressions, and Flap vs provider-level rejection.",
      path: PATH,
    });
    setJsonLd("docs-deliverability", webPageLd({
      title: "Deliverability | Flap Docs",
      description: "Flap delivery events and suppression model.",
      path: PATH,
    }));
    return () => clearJsonLd("docs-deliverability");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Deliverability"
        description="Workspace-scoped delivery feedback. Empty Flap suppressions do not mean SES will accept every recipient."
        toc={[
          { id: "events", label: "Events" },
          { id: "suppression", label: "Suppression layers" },
        ]}
        rightRail={<DocsRelated links={[{ href: "/docs/bounces-and-complaints", label: "Bounces and complaints" }, { href: "/docs/sending-limits", label: "Sending limits" }]} />}
      >
        <h2 id="events">Events</h2>
        <p>
          Outbound sends can attach an SES configuration set. Flap records send, delivery, bounce, complaint, and
          reject events against the workspace that sent the message (via the SES message id), not the bounce
          recipient&apos;s domain.
        </p>
        <h2 id="suppression">Suppression layers</h2>
        <p>
          <strong>Flap suppression</strong> is workspace-scoped. <strong>Provider suppression</strong> may still reject
          recipients at the Amazon SES account even when Flap lists no local suppression.
        </p>
      </DocsPage>
    </DocsShell>
  );
}
