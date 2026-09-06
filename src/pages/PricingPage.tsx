import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import { PLANS, PLAN_ORDER, monthlyEquivalentFromYearly } from "../../shared/plans";
import { go } from "../lib/nav";
import { clearJsonLd, faqPageLd, setJsonLd, setPageMeta, softwareApplicationLd, webPageLd } from "../lib/seo";
import { track } from "../lib/analytics";

const PATH = "/pricing";
const UPDATED = "2026-09-06";

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. You keep access through the paid period. Export JSON or .mbox from Settings before it ends.",
  },
  {
    q: "Does Free include real custom-domain email?",
    a: `Yes — Free includes ${PLANS.free.limits.domains} domains, mailboxes, and outbound sends with a small Flap footer. Paid plans remove the footer and raise limits.`,
  },
  {
    q: "Is this Google Workspace?",
    a: "No. Flap is email infrastructure (multi-domain inbox on Amazon SES). It does not replace Docs, Drive, Meet, or Calendar.",
  },
  {
    q: "Do you offer IMAP/SMTP today?",
    a: "Not yet. Use the web app and PWA. Do not expect desktop IMAP until we ship it.",
  },
];

export default function PricingPage() {
  useEffect(() => {
    setPageMeta({
      title: "Pricing | Flap — domain-first custom-domain email",
      description: `Free $${PLANS.free.price_monthly}, Solo $${PLANS.solo.price_monthly}/mo (${PLANS.solo.limits.domains} domains), Builder $${PLANS.builder.price_monthly}/mo (${PLANS.builder.limits.domains} domains), Studio $${PLANS.studio.price_monthly}/mo. Annual −20%.`,
      path: PATH,
    });
    setJsonLd("pricing-page", [
      webPageLd({
        title: "Pricing | Flap",
        description: "Domain-first Flap plans for multi-domain founders.",
        path: PATH,
        dateModified: UPDATED,
      }),
      softwareApplicationLd(),
      faqPageLd(FAQS),
    ]);
    return () => clearJsonLd("pricing-page");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-5xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Pricing</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Domain-first plans
        </h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
          Pay for domains you launch, not a Workspace seat per brand. Annual billing is 20% off monthly.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const yearlyEq =
              plan.price_yearly > 0 ? monthlyEquivalentFromYearly(plan.price_yearly) : 0;
            return (
              <section
                key={id}
                className={`rounded-xl border p-5 ${plan.highlighted ? "border-[var(--cta)] bg-[var(--cta-dim)]" : "border-[var(--line)] bg-[var(--surface)]"}`}
              >
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{plan.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{plan.blurb}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">
                  {plan.price_monthly === 0 ? "$0" : `$${plan.price_monthly}`}
                  {plan.price_monthly > 0 ? <span className="text-base font-normal text-[var(--muted)]">/mo</span> : null}
                </p>
                {plan.price_yearly > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    or ${plan.price_yearly}/yr (~${yearlyEq}/mo)
                  </p>
                ) : null}
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <a
              href="/signup"
              onClick={(e) => {
                e.preventDefault();
                track("signup_clicked", { source: "pricing_page" });
                go("/signup");
              }}
            >
              Start free
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/#pricing" onClick={(e) => { e.preventDefault(); go("/#pricing"); }}>
              Pricing on home
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/tools/google-workspace-cost-calculator" onClick={(e) => { e.preventDefault(); go("/tools/google-workspace-cost-calculator"); }}>
              Cost calculator
            </a>
          </Button>
        </div>

        <h2 className="mt-14 text-xl font-semibold">Export & cancel</h2>
        <p className="mt-3 max-w-2xl text-[15px] text-[var(--muted)]">
          Cancel anytime from Settings → Billing. Access continues through the paid period. Download JSON backup
          or classic .mbox from Settings → Privacy before the period ends.
        </p>

        <h2 className="mt-12 text-xl font-semibold">FAQ</h2>
        <dl className="mt-4 space-y-5">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1 text-[15px] text-[var(--muted)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </MarketingShell>
  );
}
