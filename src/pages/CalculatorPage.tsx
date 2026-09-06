import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import WorkspaceCalculator from "../components/WorkspaceCalculator";
import {
  DefinitionBox,
  LastUpdated,
  RelatedLinks,
} from "../components/MarketingArticle";
import { getToolExplainer } from "../content/tool-explainers";
import { trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  clearJsonLd,
  faqPageLd,
  setJsonLd,
  setPageMeta,
  softwareApplicationLd,
  webApplicationToolLd,
  webPageLd,
} from "../lib/seo";

const PATH = "/tools/google-workspace-cost-calculator";
const TITLE = "Google Workspace cost calculator | Flap";
const DESC =
  "Estimate Workspace spend across projects vs Flap — interactive savings calculator for multi-domain founders.";

export default function CalculatorPage({ share = false }: { share?: boolean }) {
  const explainer = getToolExplainer(PATH);

  useEffect(() => {
    setPageMeta({ title: TITLE, description: DESC, path: PATH });
    trackOnce("calc_page", "seo_page_view", { path: PATH });
    setJsonLd(
      "flap-webpage",
      webPageLd({
        path: PATH,
        title: TITLE,
        description: DESC,
        dateModified: explainer?.updated || "2026-09-07",
      }),
    );
    setJsonLd("flap-software", softwareApplicationLd());
    setJsonLd(
      "flap-tool",
      webApplicationToolLd({
        name: "Google Workspace cost calculator",
        path: PATH,
        description: DESC,
      }),
    );
    if (explainer?.faqs.length) setJsonLd("flap-faq", faqPageLd(explainer.faqs));
    return () => {
      clearJsonLd("flap-webpage");
      clearJsonLd("flap-software");
      clearJsonLd("flap-tool");
      clearJsonLd("flap-faq");
    };
  }, [explainer]);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
          Tool · Flap · useflap.online
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Google Workspace cost calculator
        </h1>
        <LastUpdated date={explainer?.updated || "2026-09-07"} />
        <DefinitionBox>
          {explainer?.answerFirst ||
            "This calculator estimates monthly Google Workspace cost when each project domain is provisioned separately versus the cheapest Flap plan that covers that many domains."}
        </DefinitionBox>
        <p className="mt-5 text-lg text-[var(--muted)]">
          See what a seat per project domain adds up to — versus Flap&apos;s domain-first plans. Figures
          are illustrative, not invoices, and never a delivery guarantee.
        </p>
        <div className="mt-10">
          <WorkspaceCalculator shareMode={share} />
        </div>
        {explainer ? (
          <div className="mt-12 space-y-6 text-sm leading-relaxed text-[var(--muted)]">
            <section>
              <h2 className="text-lg font-semibold text-[var(--fg)]">How to read the result</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5">
                {explainer.interpret.map((row) => (
                  <li key={row.state}>
                    <strong className="text-[var(--fg)]">{row.state}:</strong> {row.meaning}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--fg)]">Examples</h2>
              {explainer.examples.map((ex) => (
                <div key={ex.label} className="mt-3">
                  <p className="font-medium text-[var(--fg)]">{ex.label}</p>
                  <p className="mt-1">{ex.body}</p>
                </div>
              ))}
            </section>
            <section>
              <h2 className="text-lg font-semibold text-[var(--fg)]">FAQ</h2>
              {explainer.faqs.map((f) => (
                <div key={f.q} className="mt-3">
                  <h3 className="font-medium text-[var(--fg)]">{f.q}</h3>
                  <p className="mt-1">{f.a}</p>
                </div>
              ))}
            </section>
          </div>
        ) : null}
        <RelatedLinks
          links={
            explainer?.nextLinks || [
              { href: "/flap-vs-google-workspace", label: "Flap vs Google Workspace" },
              { href: "/blog/cost-of-google-workspace-multiple-domains", label: "Blog: multi-domain Workspace cost" },
              { href: "/google-workspace-alternative", label: "Workspace alternative" },
              { href: "/pricing", label: "Pricing" },
            ]
          }
        />
        <p className="mt-6 text-xs text-[var(--muted)]">
          Prefer the{" "}
          <a
            href="/pricing"
            className="text-[var(--cta)] hover:underline"
            onClick={(e) => {
              e.preventDefault();
              go("/pricing");
            }}
          >
            live Flap pricing page
          </a>{" "}
          for current plan limits.
        </p>
      </div>
    </MarketingShell>
  );
}
