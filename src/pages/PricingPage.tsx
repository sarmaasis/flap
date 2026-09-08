import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { Button } from "../components/ui/button";
import {
  PLANS,
  PLAN_ORDER,
  SHARED_STACK_FEATURES,
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
    q: "How does billing work?",
    a: "Free includes real mailboxes. Paid plans are Solo, Pro, Team, and Scale. Annual is 10× monthly (2 months free). You can cancel anytime.",
  },
  {
    q: "What counts as a mailbox?",
    a: "A unique address like hello@yourdomain.com. Each mailbox has its own inbox and storage. Aliases deliver into an existing mailbox.",
  },
  {
    q: "Do plans share the same features?",
    a: "Yes on paid plans. Capacity (mailboxes, sends, seats, newsletter caps) changes, not the product surface. Free lets you try real mailboxes before choosing a paid plan.",
  },
  {
    q: "Do you support IMAP/SMTP today?",
    a: "Not yet. Use the web app and PWA. Support for other email apps is not yet available.",
  },
  {
    q: "Can I use multiple domains?",
    a: `Yes. Every paid plan includes up to ${PLANS.solo.limits.domains} custom domains. Your plan limit is based on mailboxes.`,
  },
];

export default function PricingPage() {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [scaleBoxes, setScaleBoxes] = useState(SCALE_MIN_MAILBOXES);

  useEffect(() => {
    setPageMeta({
      title: "Email hosting pricing | Flap: from $6/month, free plan available",
      description: `Custom-domain email hosting plans: Free $0 forever, Solo $${PLANS.solo.price_monthly}/mo (3 mailboxes, 50 domains), Pro $${PLANS.pro.price_monthly}/mo (6 mailboxes, 5 seats), Team $${PLANS.team.price_monthly}/mo. Annual billing = 2 months free. No per-domain seat tax.`,
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
      <article className="flap-pricing mx-auto max-w-6xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Transparent email hosting pricing.
        </h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 max-w-2xl text-lg text-[var(--muted)]">
          Start free with real custom-domain mailboxes. No credit card required. Paid plans include up to {PLANS.solo.limits.domains} custom domains, AI assistant, newsletters, calendar, booking pages, and a transactional email API. From ${PLANS.solo.price_monthly}/month.
        </p>

        <div
          className="mt-8 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface-hover)] p-1 text-sm"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              interval === "month"
                ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            )}
            aria-pressed={interval === "month"}
            onClick={() => setInterval("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              interval === "year"
                ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            )}
            aria-pressed={interval === "year"}
            onClick={() => setInterval("year")}
          >
            Yearly
            <span className="ml-1.5 inline-flex items-center rounded-md bg-[var(--accent-dim)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--accent-text)]">
              2 mo free
            </span>
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
                  "landing-plan rounded-[18px] border p-5",
                  plan.highlighted
                    ? "landing-plan-featured"
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
                <p className={cn("mt-1 text-sm", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>{plan.blurb}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">
                  {plan.price_monthly === 0 ? "$0" : `$${price}`}
                  {suffix ? (
                    <span className={cn("text-base font-normal", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>
                      {suffix}
                    </span>
                  ) : null}
                </p>
                {interval === "month" && plan.price_yearly > 0 ? (
                  <p className={cn("mt-1 text-xs", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>
                    or ${plan.price_yearly}/yr (~${yearlyEq}/mo)
                  </p>
                ) : null}
                {interval === "year" && plan.price_monthly > 0 ? (
                  <p className={cn("mt-1 text-xs", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>
                    About ${yearlyEq}/mo, billed yearly
                  </p>
                ) : null}
                <ul className={cn("mt-4 space-y-2 text-sm", plan.highlighted ? "text-[#d6d3d1]" : "text-[var(--muted)]")}>
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlighted ? "text-[var(--cta)]" : "text-[var(--fg)]")} />
                      <span>{f}</span>
                    </li>
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

        <section className="mt-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-semibold">The essentials, already included.</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Plans change capacity, not the product. Solo through Scale share these tools (IMAP/SMTP not included yet).
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-3">
            {SHARED_STACK_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

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
