import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import WorkspaceCalculator from "../components/WorkspaceCalculator";
import {
  DefinitionBox,
  LastUpdated,
  RelatedLinks,
} from "../components/MarketingArticle";
import { trackOnce } from "../lib/analytics";
import {
  clearJsonLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webPageLd,
} from "../lib/seo";

const PATH = "/tools/google-workspace-cost-calculator";
const TITLE = "Google Workspace cost calculator | Flap";
const DESC =
  "Estimate Workspace spend across projects vs Flap — interactive savings calculator for multi-domain founders.";

export default function CalculatorPage() {
  useEffect(() => {
    setPageMeta({ title: TITLE, description: DESC, path: PATH });
    trackOnce("calc_page", "seo_page_view", { path: PATH });
    setJsonLd(
      "flap-webpage",
      webPageLd({ path: PATH, title: TITLE, description: DESC, dateModified: "2026-09-04" }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
    };
  }, []);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Tool · Flap · useflap.online
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Google Workspace cost calculator
        </h1>
        <LastUpdated date="2026-09-04" />
        <DefinitionBox>
          This calculator estimates monthly Google Workspace cost when each project domain is provisioned
          separately (illustrative $7/user/month list price) versus the cheapest Flap plan that covers
          that many domains on one inbox.
        </DefinitionBox>
        <p className="mt-5 text-lg text-[var(--muted)]">
          See what a seat per project domain adds up to — versus Flap&apos;s domain-first plans.
        </p>
        <div className="mt-10">
          <WorkspaceCalculator />
        </div>
        <RelatedLinks
          links={[
            { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
            { href: "/blog/cost-of-google-workspace-multiple-domains", label: "Blog: multi-domain Workspace cost" },
            { href: "/google-workspace-alternative", label: "Workspace alternative" },
            { href: "/#pricing", label: "Pricing" },
            { href: "/blog", label: "Blog" },
          ]}
        />
      </div>
    </MarketingShell>
  );
}
