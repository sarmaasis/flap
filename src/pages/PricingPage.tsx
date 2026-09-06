import { useEffect, useMemo, useState } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import {
  PLANS,
  PLAN_ORDER,
  monthlyEquivalentFromYearly,
  scaleMonthlyPrice,
  scaleYearlyPrice,
  clampScaleMailboxes,
  SCALE_MIN_MAILBOXES,
  SCALE_MAX_MAILBOXES,
  type PlanId,
} from "../../shared/plans";
import { go } from "../lib/nav";
import { clearJsonLd, faqPageLd, setJsonLd, setPageMeta, softwareApplicationLd, webPageLd } from "../lib/seo";
import { track } from "../lib/analytics";
import { cn } from "../lib/utils";

const PATH = "/pricing";
const UPDATED = "2026-09-07";

const FAQS = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. You keep access through the paid period. Export JSON or .mbox from Settings before it ends.",
  },
  {
    q: "Does Free include real custom-domain email?",
    a: `Yes. Free includes ${PLANS.free.limits.domains} domains, ${PLANS.free.limits.mailboxes} mailboxes, and ${PLANS.free.limits.send_per_month} outbound sends with a small Flap footer. Paid plans remove the footer and raise limits.`,
  },
  {
    q: "Is this Google Workspace?",
    a: "No. Flap is email infrastructure (multi-domain inbox on Amazon SES). It does not replace Docs, Drive, Meet, or Calendar.",
  },
  {
    q: "Do you support IMAP/SMTP today?",
    a: "Not yet. Use the web app and PWA. Client credentials are scheduled for 2026-10-15. Settings shows the honest path until then.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual costs the same as 10 monthly payments (2 months free).",
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [scaleBoxes, setScaleBoxes] = useState(SCALE_MIN_MAILBOXES);

  useEffect(() => {
    setPageMeta({
      title: "Pricing | Flap - custom-domain email for multi-domain founders",
      description: `Free $0, Solo $${PLANS.solo.price_monthly}/mo, Pro $${PLANS.pro.price_monthly}/mo (highlighted), Team $${PLANS.team.price_monthly}/mo, Scale $${PLANS.scale.price_monthly}/mailbox. Annual = 10× monthly.`,
      path: PATH,
    });
    setJsonLd("pricing-page", [
      webPageLd({
        title: "Pricing | Flap",
        description: "Flat Flap plans with domains included. Free includes real mailboxes.",
        path: PATH,
        dateModified: UPDATED,
      }),
      softwareApplicationLd(),
      faqPageLd(FAQS),
    ]);
    return () => clearJsonLd("pricing-page");
  }, []);

  const scaleCount = clampScaleMailboxes(scaleBoxes);
  const scalePrice = interval === "year" ? scaleYearlyPrice(scaleCount) : scaleMonthlyPrice(scaleCount);

  const cards = useMemo(() => PLAN_ORDER.filter((id) => id !== "scale") as PlanId[], []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-6xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Flat plans. Domains included.
        </h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
          No per-seat tax for every side project. Free includes real mailboxes, unlike hosts that charge before you can receive mail.
          Annual billing is 10× monthly.
        </p>

        <div className="mt-8 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-sm">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium",
              interval === "month" ? "bg-[var(--cta)] text-[var(--cta-fg)]" : "text-[var(--muted)]",
            )}
            onClick={() => setInterval("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium",
              interval === "year" ? "bg-[var(--cta)] text-[var(--cta-fg)]" : "text-[var(--muted)]",
            )}
            onClick={() => setInterval("year")}
          >
            Annual
            <span className="ml-1 text-xs opacity-80">2 mo free</span>
          </button>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((id) => {
            const plan = PLANS[id];
            const price =
              interval === "year" && plan.price_yearly > 0
                ? plan.price_yearly
                : plan.price_monthly;
            const suffix =
              plan.price_monthly === 0
                ? ""
                : interval === "year"
                  ? "/yr"
                  : "/mo";
            const yearlyEq =
              plan.price_yearly > 0 ? monthlyEquivalentFromYearly(plan.price_yearly) : 0;
            return (
              <section
                key={id}
                className={cn(
                  "rounded-xl border p-5",
                  plan.highlighted
                    ? "border-[var(--cta)] bg-[var(--cta-dim)]"
                    : "border-[var(--line)] bg-[var(--surface)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-[var(--cta)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--cta-fg)]">
                      Popular
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{plan.blurb}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">
                  {plan.price_monthly === 0 ? "$0" : `$${price}`}
                  {suffix ? <span className="text-base font-normal text-[var(--muted)]">{suffix}</span> : null}
                </p>
                {interval === "month" && plan.price_yearly > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    or ${plan.price_yearly}/yr (~${yearlyEq}/mo)
                  </p>
                ) : null}
                {interval === "year" && plan.price_monthly > 0 ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">${plan.price_monthly}/mo billed yearly</p>
                ) : null}
                <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() => {
                    track("signup_clicked", { source: "pricing_card", plan: id, interval });
                    go("/signup");
                  }}
                >
                  {id === "free" ? "Start free" : `Get ${plan.name}`}
                </Button>
              </section>
            );
          })}
        </div>

        <section className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Scale</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {SCALE_MIN_MAILBOXES}-{SCALE_MAX_MAILBOXES} mailboxes at ${PLANS.scale.price_monthly}/mailbox/mo
                (${PLANS.scale.price_yearly}/mailbox/yr). 50 domains included.
              </p>
            </div>
            <p className="text-3xl font-semibold tracking-tight">
              ${scalePrice}
              <span className="text-base font-normal text-[var(--muted)]">
                {interval === "year" ? "/yr" : "/mo"}
              </span>
            </p>
          </div>
          <label className="mt-5 block text-sm font-medium">
            Mailboxes: {scaleCount}
            <input
              className="mt-2 w-full accent-[var(--cta)]"
              type="range"
              min={SCALE_MIN_MAILBOXES}
              max={SCALE_MAX_MAILBOXES}
              value={scaleCount}
              onChange={(e) => setScaleBoxes(Number(e.target.value))}
            />
          </label>
          <ul className="mt-4 grid list-disc gap-1 pl-5 text-sm text-[var(--muted)] md:grid-cols-2">
            {PLANS.scale.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              track("signup_clicked", { source: "pricing_scale", mailboxes: scaleCount, interval });
              go("/signup");
            }}
          >
            Talk to us / start on Team
          </Button>
        </section>

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
            <a href="/vs/shipmail" onClick={(e) => { e.preventDefault(); go("/vs/shipmail"); }}>
              Flap vs Shipmail
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="/tools/google-workspace-cost-calculator"
              onClick={(e) => {
                e.preventDefault();
                go("/tools/google-workspace-cost-calculator");
              }}
            >
              Cost calculator
            </a>
          </Button>
        </div>

        <h2 className="mt-14 text-xl font-semibold">Questions</h2>
        <dl className="mt-4 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 text-sm text-[var(--muted)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </MarketingShell>
  );
}
