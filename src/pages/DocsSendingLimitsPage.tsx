import { useEffect } from "react";
import { DocsPage, DocsRelated, DocsShell } from "../components/docs/DocsKit";
import { PLANS } from "../../shared/plans";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";

const PATH = "/docs/sending-limits";

export default function DocsSendingLimitsPage() {
  useEffect(() => {
    setPageMeta({
      title: "Sending limits | Flap Docs",
      description: "Flap sending limits depend on your plan and account status. There is no unlimited bulk sending.",
      path: PATH,
    });
    setJsonLd("docs-sending-limits", webPageLd({
      title: "Sending limits | Flap Docs",
      description: "Plan send caps and workspace restrictions.",
      path: PATH,
    }));
    return () => clearJsonLd("docs-sending-limits");
  }, []);

  return (
    <DocsShell pathname={PATH}>
      <DocsPage
        href={PATH}
        title="Sending limits"
        description="Sending limits depend on your plan and account status."
        toc={[
          { id: "plans", label: "Plan caps" },
          { id: "newsletters", label: "Newsletters" },
        ]}
        rightRail={<DocsRelated links={[{ href: "/pricing", label: "Pricing" }, { href: "/acceptable-use", label: "Acceptable use" }]} />}
      >
        <h2 id="plans">Plan caps</h2>
        <p>
          Free includes {PLANS.free.limits.send_per_month} outbound sends per UTC month. Paid plans raise the monthly
          send room. Server-side checks apply to compose, scheduled send, vacation replies, calendar invites, the
          transactional API, and newsletters. Domain and workspace suspension are also enforced at dispatch.
        </p>
        <h2 id="newsletters">Newsletters</h2>
        <p>
          Newsletters are for opt-in audiences and remain subject to sending limits and abuse policies. Public signup
          requires double opt-in. Every send includes an unsubscribe link and a physical mailing address. Unsubscribed
          and suppressed addresses are not resent.
        </p>
      </DocsPage>
    </DocsShell>
  );
}
