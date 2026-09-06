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
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CREDIBILITY, ICP_LINES, MARKETING, planCards, SITE_URL } from "../content/marketing";
import { api } from "../lib/api";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, faqPageLd, setJsonLd, setPageMeta } from "../lib/seo";
import { PLANS } from "../../shared/plans";
import { cn } from "../lib/utils";

const PROBLEM_BEFORE = [
  { domain: "project1.com", stack: "Google Workspace" },
  { domain: "project2.com", stack: "Google Workspace" },
  { domain: "project3.com", stack: "Zoho" },
  { domain: "project4.com", stack: "forwarding hack" },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Many domains, one inbox",
    body: `Connect up to ${PLANS.studio.limits.domains} domains on Studio. Read and reply as each brand without juggling separate mailboxes.`,
  },
  {
    icon: Inbox,
    title: "Filters & aliases",
    body: "Route with rules, catch-all, and disposable aliases — keep support@ and founder@ tidy across every project domain.",
  },
  {
    icon: Zap,
    title: "API keys & inbound webhooks",
    body: "Send transactional mail with API keys and react to mail.received events on paid plans — delivery logs in Settings.",
  },
  {
    icon: Shield,
    title: "Studio seats when you grow",
    body: "Solo and Builder stay solo. Studio adds seats, shared inboxes, and delegation without a Workspace-per-brand tax.",
  },
];

const USE_CASES = [
  {
    title: "Indie hackers",
    body: "Ship the next domain without opening another email product trial.",
  },
  {
    title: "Micro-SaaS founders",
    body: "Keep support@ and founder@ professional across products you still own alone.",
  },
  {
    title: "Small studios",
    body: "Studio plan adds seats and shared inboxes when a second person joins the thread.",
  },
  {
    title: "Agencies / brand managers",
    body: "Hold client or product brands in one place until they graduate to their own stack.",
  },
];

const FAQS = [
  {
    q: "Who is Flap for?",
    a: "Indie hackers, serial founders, micro-SaaS builders, and small studios who own multiple domains and do not want a separate Google Workspace (or similar) for every project.",
  },
  {
    q: "Is Flap just cheap business email?",
    a: "No. The product is built around one inbox for many startup domains — fast setup and multiple identities — not competing solely on price with full productivity suites.",
  },
  {
    q: "How many domains can I connect?",
    a: `Free includes ${PLANS.free.limits.domains}, Solo ${PLANS.solo.limits.domains}, Builder ${PLANS.builder.limits.domains}, Studio ${PLANS.studio.limits.domains}. Referrals can add bonus domain slots permanently.`,
  },
  {
    q: "Do you support teams?",
    a: "Studio unlocks up to 10 seats, shared mailboxes, and delegation. Free, Solo, and Builder stay solo.",
  },
  {
    q: "How does DNS / delivery work?",
    a: "Customer mail on Amazon SES. App on Cloudflare. Your DNS stays at any registrar — add the MX/SPF/DKIM Flap shows, create a mailbox, then Check DNS. Your domain does not need to be a Cloudflare zone.",
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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const onPrimary = (source: string) => {
    track("signup_clicked", { source });
    go(primaryHref);
  };

  return (
    <MarketingShell primaryHref={primaryHref} primaryLabel={primaryLabel}>
      <section className="landing-hero relative mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-14 md:px-8 md:pb-20 md:pt-12">
        <div className="landing-hero-copy">
          <p className="brand-hero mb-4 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--cta)] md:text-7xl lg:text-8xl">
            Flap
          </p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-[var(--fg)] md:text-4xl lg:text-[2.6rem]">
            {MARKETING.primary_tagline}
          </h1>
          <p className="lede mt-5 max-w-lg text-base leading-relaxed text-[var(--muted)] md:text-lg">
            {MARKETING.hero_subheadline}
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
                {primaryLabel}
                <ArrowRight />
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="/#how" onClick={(e) => { e.preventDefault(); scrollTo("how"); }}>
                See how it works
              </a>
            </Button>
          </div>
          <p className="mt-5 text-xs text-[var(--muted)]">
            {MARKETING.microcopy.replace("Multiple domains", `Up to ${PLANS.builder.limits.domains} domains on Builder`)}
          </p>
          <div className="demo-domain-chips mt-8 flex flex-wrap gap-2" aria-hidden>
            {[
              { name: "shopfront.io", color: "#1c6e5c" },
              { name: "launchkit.dev", color: "#2d5a8c" },
              { name: "studio.agency", color: "#b47828" },
            ].map((d) => (
              <span key={d.name} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
            ))}
          </div>

        </div>

        <div className="landing-stage relative" aria-label="Multiple domains into one inbox">
          <div className="landing-stage-glow" aria-hidden />
          <div className="hero-preview landing-preview multi-domain-preview">
            <div className="preview-top">
              <span className="preview-dot" />
              <strong>One inbox</strong>
              <Badge className="ml-auto">4 domains</Badge>
            </div>
            {["hello@launch.dev", "support@sidekit.app", "ash@studio.io", "hi@ship.fyi"].map((addr, i) => (
              <div key={addr} className={cn("preview-message", i === 0 && "highlight")}>
                <span className={cn("avatar", ["coral", "mint", "violet", "coral"][i])}>{addr[0]?.toUpperCase()}</span>
                <div>
                  <strong>{addr}</strong>
                  <small>Same Flap inbox</small>
                </div>
                <time>{["now", "2h", "Mon", "Sun"][i]}</time>
              </div>
            ))}
            <div className="preview-footer">Every startup domain · one place to reply</div>
          </div>
        </div>
      </section>

      <section id="problem" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl md:mb-10">
          <Badge variant="secondary" className="mb-4">The problem</Badge>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Stop managing email like this
          </h2>
        </div>
        <div className="problem-viz grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="problem-before">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Before</p>
            <ul className="space-y-3">
              {PROBLEM_BEFORE.map((row) => (
                <li key={row.domain} className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] pb-3 text-sm md:text-[15px]">
                  <code className="font-[family-name:var(--font-mono)] text-[var(--fg)]">{row.domain}</code>
                  <span className="text-[var(--muted)]">→</span>
                  <span className="text-[var(--muted)]">{row.stack}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="problem-after">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Do this instead</p>
            <ul className="space-y-2 text-sm md:text-[15px]">
              {PROBLEM_BEFORE.map((row) => (
                <li key={row.domain}>
                  <code className="font-[family-name:var(--font-mono)]">{row.domain}</code>
                </li>
              ))}
            </ul>
            <div className="my-5 flex flex-col items-start gap-2 text-sm text-[var(--muted)]">
              <span>↓</span>
              <strong className="text-[var(--cta)]">Flap</strong>
              <span>↓</span>
              <strong className="text-[var(--fg)]">One inbox</strong>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <Badge variant="secondary" className="mb-4"><Sparkles className="mr-1 h-3 w-3" /> Workflow</Badge>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            From domain to first reply in three steps
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">Built for people who keep launching things.</p>
        </div>
        <ol className="landing-steps grid gap-10 md:grid-cols-3 md:gap-12">
          {[
            { n: "01", title: "Add every project domain", body: "Connect the domains you already own — side projects, SaaS brands, client sites." },
            { n: "02", title: "Point DNS once per domain", body: "Copy MX/SPF. Flap checks records and tells you exactly what is missing." },
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

      <section id="features" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Built for multi-domain founders
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--cta-dim)] text-[var(--cta)]">
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

      <section id="use-cases" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Who Flap is for
          </h2>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="border-t border-[var(--line)] pt-5">
              <h3 className="font-semibold">{u.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Domain-first pricing
          </h2>
          <p className="mt-4 text-base text-[var(--muted)] md:text-lg">
            Scale by how many projects you run — not by how many Workspace seats you fake.
          </p>
        </div>
        <div className="mb-6 inline-flex rounded-lg border border-[var(--line)] p-1 text-sm">
          <button type="button" className={`rounded-md px-3 py-1.5 ${billingInterval === "month" ? "bg-[var(--cta)] text-[var(--cta-fg)]" : "text-[var(--muted)]"}`} onClick={() => setBillingInterval("month")}>Monthly</button>
          <button type="button" className={`rounded-md px-3 py-1.5 ${billingInterval === "year" ? "bg-[var(--cta)] text-[var(--cta-fg)]" : "text-[var(--muted)]"}`} onClick={() => setBillingInterval("year")}>Annual (-20%)</button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "landing-plan flex flex-col rounded-lg border p-5 md:p-6",
                plan.highlighted
                  ? "landing-plan-featured border-[var(--cta)]/45 bg-[var(--cta-dim)]"
                  : "border-[var(--line)] bg-[var(--surface)]/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.badge ? <Badge>{plan.badge}</Badge> : null}
              </div>
              <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold">
                {plan.price_monthly === 0 ? "$0" : billingInterval === "year" ? `$${plan.price_yearly}` : `$${plan.price_monthly}`}
                <span className="text-sm font-normal text-[var(--muted)]">{plan.price_monthly === 0 ? "/mo" : billingInterval === "year" ? "/yr" : "/mo"}</span>
              </p>
              {plan.price_monthly > 0 && billingInterval === "year" ? (
                <p className="text-xs text-[var(--muted)]">${Math.round((plan.price_yearly / 12) * 100) / 100}/mo effective</p>
              ) : null}
              <p className="mt-2 text-sm text-[var(--muted)]">{plan.blurb}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.slice(0, 6).map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => {
                  track("signup_clicked", { source: `pricing_${plan.id}` });
                  go(auth === "user" ? "/app/settings?tab=billing" : primaryHref);
                }}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section id="proof" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-8 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Built to be trusted
          </h2>
          <p className="mt-4 text-base text-[var(--muted)]">
            We do not fabricate user counts. Here is what Flap stands on today.
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
        <h2 className="mb-8 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">FAQ</h2>
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
        <div className="landing-cta relative overflow-hidden rounded-2xl border border-[var(--line-strong)] px-8 py-12 md:px-14 md:py-14">
          <div className="landing-cta-glow" aria-hidden />
          <p className="relative font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
            {MARKETING.primary_tagline}
          </p>
          <p className="relative mt-4 max-w-xl text-base text-[var(--muted)] md:text-lg">
            {MARKETING.founder_tagline}
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
