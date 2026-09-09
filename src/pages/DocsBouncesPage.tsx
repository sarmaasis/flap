import { useEffect } from "react";
import { DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/bounces-and-complaints";

export default function DocsBouncesPage() {
  useEffect(() => {
    setPageMeta({
      title: "Bounces and complaints | Flap Docs",
      description: "How Flap processes SES bounce and complaint events and applies workspace-scoped suppressions.",
      path: PATH,
    });
    setJsonLd("docs-bounces", webPageLd({
      title: "Bounces and complaints | Flap Docs",
      description: "Flap bounce and complaint handling.",
      path: PATH,
    }));
    return () => clearJsonLd("docs-bounces");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Bounces and complaints"
        description="Authenticated SES events are attributed to the sending workspace."
        toc={[
          { id: "hard", label: "Hard bounces" },
          { id: "soft", label: "Soft bounces" },
          { id: "complaint", label: "Complaints" },
        ]}
        rightRail={<DocsRelated links={[{ href: "/docs/deliverability", label: "Deliverability" }, { href: "/acceptable-use", label: "Acceptable use" }]} />}
      >
        <h2 id="hard">Hard bounces</h2>
        <p>
          Permanent bounce events create a workspace suppression so Flap will not keep sending to that recipient from
          the same workspace. Newsletter subscribers on that workspace are marked unsubscribed.
        </p>
        <h2 id="soft">Soft bounces</h2>
        <p>
          Transient bounces are stored with a 72-hour expiry and do not permanently suppress the address or unsubscribe
          newsletter recipients.
        </p>
        <h2 id="complaint">Complaints</h2>
        <p>
          Complaint events suppress the recipient on the sending workspace only. A complaint on Workspace A never
          writes suppressions for Workspace B.
        </p>
      </DocsPage>
    </DocsShell>
  );
}
