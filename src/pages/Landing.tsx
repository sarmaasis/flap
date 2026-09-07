import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Inbox,
  Layers,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import WorkspaceCalculator from "../components/WorkspaceCalculator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { CREDIBILITY, ICP_LINES, MARKETING, planCards, SITE_URL } from "../content/marketing";
import { api } from "../lib/api";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, faqPageLd, setJsonLd, setPageMeta } from "../lib/seo";
import { PLANS } from "../../shared/plans";
import { cn } from "../lib/utils";

const ALIASES = [
  "hello@", "billing@", "press@", "launch@", "support@", "careers@", "founder@",
  "orders@", "newsletter@", "legal@", "demo@", "team@", "invoices@", "sales@",
  "api@", "security@", "media@", "feedback@", "rsvp@", "beta@",
];

const FEATURES = [
  {
    icon: Layers,
    title: "Many domains, one place",
    body: `Up to ${PLANS.solo.limits.domains} custom domains on every paid plan. Read and reply as each brand without juggling separate suites.`,
  },
  {
    icon: Inbox,
    title: "Calendars, bookings, newsletters",
    body: "Week calendar, booking pages, and newsletter drafts ship with the same subscription as webmail — not add-on silos.",
  },
  {
    icon: Zap,
    title: "API, webhooks, MCP",
    body: "Send transactional mail with API keys and react to mail.received events. Thin TypeScript and Python SDKs plus a CLI.",
  },
  {
    icon: Shield,
    title: "AI assistant (confirm-before-send)",
    body: "Ask your inbox in plain language and draft replies in your voice. Nothing sends without your approval.",
  },
];

const STATS = [
  { value: `$${PLANS.solo.price_monthly}`, label: "Solo starts", body: `${PLANS.solo.limits.mailboxes} mailboxes. Same stack as Pro and Team.` },
  { value: "50", label: "Domains", body: "Included on every paid plan. Mailbox count is the capacity dial." },
  { value: "5-in-1", label: "One subscription", body: "Webmail, newsletters, bookings, calendar, and an email API." },
  { value: "0", label: "Ads or scanning", body: "Customer mail on Amazon SES. App on Cloudflare." },
];

const FAQS = [
  {
    q: "Who is Flap for?",
    a: "Indie hackers, serial founders, micro-SaaS builders, and small studios who own multiple domains and do not want a separate Google Workspace (or similar) for every project.",
  },
  {
    q: "Is Flap just cheap business email?",
    a: "No. The product is built around one inbox for many startup domains - fast setup and multiple identities - not competing solely on price with full productivity suites.",
  },
  {
    q: "How many domains can I connect?",
    a: `Free includes ${PLANS.free.limits.domains}, Solo ${PLANS.solo.limits.domains}, Pro ${PLANS.pro.limits.domains}, Team ${PLANS.team.limits.domains}. Referrals can add bonus domain slots permanently.`,
  },
  {
    q: "Do you support teams?",
    a: "Pro adds seats. Team unlocks unlimited seats, shared mailboxes, and delegation. Free and Solo stay solo-friendly.",
  },
  {
    q: "How does DNS / delivery work?",
    a: "Customer mail on Amazon SES. App on Cloudflare. Your DNS stays at any registrar - add the MX/SPF/DKIM Flap shows, create a mailbox, then Check DNS.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Settings includes JSON backup, .mbox mailbox download, and restore for workspace data.",
  },
];

export default function Landing() {
  const [auth, setAuth] = useState<"loading" | "setup" | "guest" | "user">("loading");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const plans = planCards();

  useEffect(() => {
    captureReferralFromUrl();
    setPageMeta({
      title: MARKETING.seo_title,
      description: MARKETING.seo_description,
      path: "/",
    });
    setJsonLd("flap-org", {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Flap",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: MARKETING.short_description,
      offers: PLAN_ORDER_OFFERS(),
      publisher: { "@type": "Organization", name: "Flap", url: SITE_URL },
    });
    setJsonLd("flap-faq", faqPageLd(FAQS));
    trackOnce("landing", "landing_view");
    Promise.all([api.setupStatus().catch(() => ({ needs_setup: false })), api.me().then((me) => me.user.email_verified !== false).catch(() => false)])
      .then(([setup, signedIn]) => {
        if (setup.needs_setup) setAuth("setup");
        else if (signedIn) setAuth("user");
        else setAuth("guest");
      })
      .catch(() => setAuth("guest"));
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) trackOnce("pricing_view", "pricing_view");
      },
      { threshold: 0.35 },
    );
    const el = document.getElementById("pricing");
    if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const primaryHref = auth === "setup" ? "/setup" : auth === "user" ? "/app" : "/signup";
  const primaryLabel = auth === "setup" ? "Create your workspace" : auth === "user" ? "Open inbox" : "Start free";

  const onPrimary = (source: string) => {
    track("signup_clicked", { source });
    go(primaryHref);
  };

  return (
    <MarketingShell primaryHref={primaryHref} primaryLabel={auth === "guest" || auth === "loading" ? "Get started" : primaryLabel}>
      <section className="landing-hero relative mx-auto grid max-w-6xl gap-12 px-5 pb-12 pt-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-14 md:px-8 md:pb-16 md:pt-14">
        <div className="landing-hero-copy">
          <p className="flap-eyebrow">A little less switching. A lot more focus.</p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-4xl font-bold leading-[1.08] tracking-tight text-[var(--fg)] md:text-5xl lg:text-[3.35rem]">
            Every project.
            <br /><span className="landing-hero-mark">One calm inbox.</span>
          </h1>
          <p className="lede mt-6 max-w-lg text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Your brands have different addresses. Give them one place to work. Bring email, newsletters, bookings, and your team together on your own domains.{" "}
            <strong className="font-semibold text-[var(--fg)]">From ${PLANS.solo.price_monthly}/mo.</strong>
          </p>
          <div className="hero-actions mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <a
                href={primaryHref}
                onClick={(e) => {
                  e.preventDefault();
                  onPrimary("hero");
                }}
              >
                {auth === "guest" || auth === "loading" ? "Try free" : primaryLabel}
                <ArrowRight />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/pricing" onClick={(e) => { e.preventDefault(); go("/pricing"); }}>
                See pricing
              </a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-[var(--muted)]">
            Start with real mailboxes for free. Add room as your projects grow.
          </p>
        </div>

        <div className="flap-mail-preview" aria-label="Example of the Flap inbox">
          <div className="flap-preview-top"><span className="flap-eyebrow">YOUR WORKSPACE</span><span className="flap-preview-label">Product preview</span></div>
          <div className="flap-preview-heading"><h2>All together now.</h2><Inbox size={22} /></div>
          <div className="flap-preview-tabs"><span>All inboxes <b>3</b></span><span>Starred</span><span>Sent</span></div>
          {[
            { initials: "AC", name: "Alex Chen", address: "hello@studio.example", subject: "The next chapter starts here", body: "The proposal looks great. Let’s make it happen.", time: "9:41", unread: true },
            { initials: "JL", name: "Jamie Lee", address: "team@launch.example", subject: "A small update. A big milestone.", body: "Our first release is ready for your review.", time: "9:12", unread: true },
            { initials: "MR", name: "Morgan Reed", address: "support@studio.example", subject: "Thanks for the quick reply", body: "That was exactly what I needed. All set!", time: "Yesterday", unread: false },
          ].map(row => <div className="flap-preview-message" key={row.initials}>
            <span className="flap-preview-avatar">{row.initials}</span>
            <div><div className="flap-preview-sender"><strong>{row.name}</strong><small>{row.time}</small></div><p>{row.subject}</p><small>{row.body}</small><span className="flap-preview-address">{row.address}</span></div>
            <span className={row.unread ? "flap-unread-dot" : ""} />
          </div>)}
          <div className="flap-preview-bottom"><Layers size={15} /><span>Different domains. Everything in reach.</span><Check size={15} /></div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-stats">
          {STATS.map((s) => (
            <div key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-12" aria-hidden>
        <div className="landing-ticker">
          <div className="landing-ticker-track">
            {[...ALIASES, ...ALIASES].map((a, i) => (
              <span key={`${a}-${i}`}>{a}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">
            <Sparkles className="mr-1 inline h-3 w-3" /> Workflow
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            From domain to first reply in three steps
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">Built for people who keep launching things.</p>
        </div>
        <ol className="landing-steps grid gap-10 md:grid-cols-3 md:gap-12">
          {[
            { n: "01", title: "Add every project domain", body: "Connect the domains you already own - side projects, SaaS brands, client sites." },
            { n: "02", title: "Point DNS once per domain", body: "Copy MX/SPF/DKIM. Flap checks records and tells you exactly what is missing." },
            { n: "03", title: "Send & receive as each brand", body: "Create addresses, open one inbox, reply as the right identity." },
          ].map((s) => (
            <li key={s.n} className="landing-step">
              <span className="landing-step-n font-[family-name:var(--font-mono)] text-sm font-medium tracking-wider text-[var(--cta)]">{s.n}</span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-2xl text-sm text-[var(--muted)] md:text-[15px]">
          {ICP_LINES[0]}. {ICP_LINES[4]}.
        </p>
      </section>

      <section id="features" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            All your email in one place
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">
            {MARKETING.architecture_line}
          </p>
        </div>
        <ul className="mb-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted)] md:text-[15px]">
          {MARKETING.key_features.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-[var(--cta)]" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-8 md:grid-cols-2 md:gap-x-12 md:gap-y-10">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-row flex gap-4 border-t border-[var(--line)] pt-7">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--cta-dim)] text-[var(--cta)]">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="savings" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            What Workspace×N actually costs
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">
            Compare a seat per domain against Flap&apos;s domain-first plans.
          </p>
        </div>
        <WorkspaceCalculator compact ctaHref={primaryHref} />
      </section>

      <section id="pricing" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Pricing</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Simple pricing<span className="text-[var(--cta)]">.</span>
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">
            Flat plans. Domains included. No per-seat tax for every side project.
          </p>
        </div>
        <div className="mb-8 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-sm">
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium",
              billingInterval === "month" ? "bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm" : "text-[var(--muted)]",
            )}
            onClick={() => setBillingInterval("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-1.5 font-medium",
              billingInterval === "year" ? "bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm" : "text-[var(--muted)]",
            )}
            onClick={() => setBillingInterval("year")}
          >
            Yearly
            <span className="ml-1 text-xs font-semibold text-[var(--cta)]">2 mo free</span>
          </button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "landing-plan flex flex-col border p-5 md:p-6",
                plan.highlighted
                  ? "landing-plan-featured"
                  : "border-[var(--line)] bg-[var(--surface)]",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.badge ? (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    plan.highlighted ? "bg-[var(--cta)] text-[var(--cta-fg)]" : "bg-[var(--surface-2)] text-[var(--muted)]",
                  )}>
                    {plan.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
                {plan.price_monthly === 0 ? "$0" : billingInterval === "year" ? `$${plan.price_yearly}` : `$${plan.price_monthly}`}
                <span className={cn("text-sm font-normal", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>
                  {plan.price_monthly === 0 ? "/mo" : billingInterval === "year" ? "/yr" : "/mo"}
                </span>
              </p>
              {plan.price_monthly > 0 && billingInterval === "year" ? (
                <p className={cn("text-xs", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>
                  ${Math.round((plan.price_yearly / 12) * 100) / 100}/mo effective
                </p>
              ) : null}
              <p className={cn("mt-2 text-sm", plan.highlighted ? "text-[#a8a29e]" : "text-[var(--muted)]")}>{plan.blurb}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.slice(0, 6).map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", plan.highlighted ? "text-[var(--cta)]" : "text-[var(--fg)]")} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => {
                  track("signup_clicked", { source: `pricing_${plan.id}` });
                  go(auth === "user" ? "/app/billing" : primaryHref);
                }}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
        <p className="mt-6 text-sm text-[var(--muted)]">
          Need more mailboxes? See <a className="font-medium text-[var(--cta)]" href="/pricing" onClick={(e) => { e.preventDefault(); go("/pricing"); }}>full pricing</a> including Scale.
        </p>
      </section>

      <section id="proof" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Built to be trusted
          </h2>
          <p className="mt-4 text-base text-[var(--muted)]">
            Your domain, your conversations, your choice. Know what goes into your email.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-5">
          {CREDIBILITY.map((c) => (
            <div key={c.title} className="border-t border-[var(--line)] pt-4">
              <h3 className="text-sm font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="landing-section mx-auto max-w-3xl px-5 md:px-8">
        <h2 className="mb-8 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
          Questions<span className="text-[var(--cta)]">?</span>
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-20">
        <div className="landing-cta relative overflow-hidden border border-[var(--line-strong)] px-8 py-12 md:px-14 md:py-14">
          <div className="landing-cta-glow" aria-hidden />
          <p className="relative font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
            Your email, set up in minutes.
          </p>
          <p className="relative mt-4 max-w-xl text-base text-[var(--muted)] md:text-lg">
            First receive usually takes a few minutes depending on DNS. From ${PLANS.solo.price_monthly}/month.
            Free includes real mailboxes.
          </p>
          <Button size="lg" className="relative mt-8" onClick={() => onPrimary("final_cta")}>
            {primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}

function PLAN_ORDER_OFFERS() {
  return planCards()
    .filter((p) => p.id !== "free")
    .map((p) => ({
      "@type": "Offer",
      price: String(p.price_monthly),
      priceCurrency: "USD",
      name: p.name,
    }));
}
