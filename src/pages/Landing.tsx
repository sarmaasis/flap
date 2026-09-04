import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  Download,
  Filter,
  Inbox,
  KeyRound,
  Mail,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import BrandMark from "../components/BrandMark";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { cn } from "../lib/utils";

/** ICP: solo founders / freelancers with 1–3 brand domains who need a real mailbox, not Gmail dumping. */

const PAINS = [
  {
    title: "Brand mail in personal Gmail",
    body: "hello@ and support@ land next to newsletters and family threads. You lose the brand surface — and the habit of treating it like a product channel.",
  },
  {
    title: "Forwarding is not an inbox",
    body: "Routing tools dump mail elsewhere. You still cannot reply as the brand, schedule, archive cleanly, or automate without duct tape.",
  },
  {
    title: "Workspace is overkill",
    body: "Per-seat suites assume a team and an admin. One founder shipping a domain should not need an enterprise mail stack.",
  },
];

const FEATURES = [
  {
    icon: Inbox,
    title: "Reply as your brand",
    body: "hello@ and support@ live in Flap — read, reply, schedule, and archive without forwarding everything into personal Gmail.",
  },
  {
    icon: Workflow,
    title: "One domain, many addresses",
    body: "Catch-all, aliases, and disposables on your domain. Route with rules: archive, label, forward, or block senders.",
  },
  {
    icon: Zap,
    title: "Setup in minutes",
    body: "Add the domain, point MX, create a mailbox. Guided checklist after signup — no Google Workspace admin maze.",
  },
  {
    icon: KeyRound,
    title: "Automate when you grow",
    body: "Pro unlocks API send and inbound webhooks so forms, apps, and ops can talk to your mailbox.",
  },
  {
    icon: Filter,
    title: "Catch-all with control",
    body: "Accept mail to any address on the domain, then quiet the noise with filters so founders stay in the loop without drowning.",
  },
  {
    icon: Download,
    title: "Your data, exportable",
    body: "JSON backup and restore from Settings. Hosted convenience without locking your brand mail in a black box.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Add your domain",
    body: "Create a free workspace and connect the brand domain you already own.",
  },
  {
    n: "02",
    title: "Point DNS",
    body: "Set MX (and SPF/DKIM) at your DNS host. Flap shows a clear checklist — no mail-server ops.",
  },
  {
    n: "03",
    title: "Create & reply",
    body: "Spin up hello@ (and aliases), open the inbox, and answer as your brand.",
  },
];

const COMPARE_ROWS = [
  {
    dim: "Time to hello@",
    flap: "Minutes — guided DNS checklist",
    diy: "Hours to days standing up mail infrastructure",
  },
  {
    dim: "Inbox experience",
    flap: "Read, reply, schedule, rules in one place",
    diy: "You assemble clients, filters, and storage",
  },
  {
    dim: "Day-to-day upkeep",
    flap: "We run delivery and storage for you",
    diy: "You patch, back up, and watch the queue",
  },
  {
    dim: "Best fit",
    flap: "Founders shipping a brand inbox",
    diy: "Operators who want full stack control",
  },
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "Solo trial — prove MX on one domain.",
    features: ["1 domain · 2 mailboxes", "5 aliases · 25 MB · 100 sends/mo", "Rules & export", "1 seat (you only)"],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    blurb: "Solo founders with multiple brands.",
    features: ["5 domains · 20 mailboxes", "Unlimited aliases", "15 GB · 2k sends/mo · API", "1 seat (solo)"],
    highlighted: true,
    badge: "Most popular",
    cta: "Get Pro",
  },
  {
    id: "team",
    name: "Team",
    price: "$39",
    blurb: "Shared inboxes and multi-seat access.",
    features: ["15 domains · 75 mailboxes", "Up to 10 seats", "50 GB · 10k sends/mo", "Shared support@ / hello@"],
    cta: "Get Team",
  },
];

const FAQS = [
  {
    q: "Who is Flap for?",
    a: "Solo founders, freelancers, and small teams who want hello@yourdomain.com in a real inbox — without paying a per-seat suite or living inside forwarding-only tools.",
  },
  {
    q: "How is this different from forwarding-only email tools?",
    a: "Forwarders dump mail into another inbox. Flap is the inbox: receive, read, reply, schedule, archive, plus aliases, rules, and (on paid plans) API/webhooks.",
  },
  {
    q: "Is Flap hosted, or do I run my own mail server?",
    a: "Flap is hosted brand email at useflap.online. You bring the domain; we run delivery, storage, and the inbox UI. Self-hosting DIY stacks is a different path — Flap is for founders who want hello@ without becoming a mail admin.",
  },
  {
    q: "How does DNS / delivery work?",
    a: "Add your domain in Flap, set MX (and SPF/DKIM) at your DNS host, create a mailbox. Inbound mail lands for addresses you configure; outbound send uses your authenticated domain.",
  },
  {
    q: "Which plan should I pick?",
    a: "Start free to validate one domain. Most founders upgrade to Pro ($15) for aliases, storage, and API. Team ($39) unlocks seats, shared mailboxes, and delegation.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Settings includes JSON backup and restore. You own the export.",
  },
  {
    q: "Do you support teams?",
    a: "Yes on the Team plan — invite members, assign admin/member roles, share mailboxes like support@, and delegate access. Free and Pro stay solo.",
  },
];

export default function Landing() {
  const [auth, setAuth] = useState<"loading" | "setup" | "guest" | "user">("loading");

  useEffect(() => {
    Promise.all([api.setupStatus().catch(() => ({ needs_setup: false })), api.me().then(() => true).catch(() => false)])
      .then(([setup, signedIn]) => {
        if (setup.needs_setup) setAuth("setup");
        else if (signedIn) setAuth("user");
        else setAuth("guest");
      })
      .catch(() => setAuth("guest"));
  }, []);

  const primaryHref = auth === "setup" ? "/setup" : auth === "user" ? "/app" : "/signup";
  const primaryLabel = auth === "setup" ? "Create your workspace" : auth === "user" ? "Open inbox" : "Start free";

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-root min-h-screen overflow-x-clip">
      <div className="landing-atmosphere" aria-hidden />

      <header className="landing-nav mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <a
          href="/"
          className="brand flex items-center gap-2 text-lg font-semibold tracking-tight"
          onClick={(e) => {
            e.preventDefault();
            go("/");
          }}
        >
          <BrandMark />
          Flap
        </a>
        <nav className="hidden items-center gap-6 text-sm text-[var(--muted)] md:flex">
          <a href="#problem" className="hover:text-[var(--fg)]">Why Flap</a>
          <a href="#features" className="hover:text-[var(--fg)]">Features</a>
          <a href="#how" className="hover:text-[var(--fg)]">How it works</a>
          <a href="#pricing" className="hover:text-[var(--fg)]">Pricing</a>
          <a href="#faq" className="hover:text-[var(--fg)]">FAQ</a>
          <a
            href="/login"
            className="hover:text-[var(--fg)]"
            onClick={(e) => {
              e.preventDefault();
              go("/login");
            }}
          >
            Sign in
          </a>
          <Button size="sm" onClick={() => go(primaryHref)}>
            {primaryLabel}
          </Button>
        </nav>
        <Button className="md:hidden" size="sm" onClick={() => go(primaryHref)}>
          {primaryLabel}
        </Button>
      </header>

      {/* Hero — one composition */}
      <section className="landing-hero relative mx-auto grid max-w-6xl gap-12 px-5 pb-24 pt-10 md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-16 md:px-8 md:pb-32 md:pt-16">
        <div className="landing-hero-copy">
          <p className="brand-hero mb-4 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--cta)] md:text-7xl lg:text-8xl">
            Flap
          </p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-[var(--fg)] md:text-4xl">
            Brand email for founders — without Google Workspace.
          </h1>
          <p className="lede mt-5 max-w-lg text-base leading-relaxed text-[var(--muted)] md:text-lg">
            hello@yourdomain.com in a real inbox. Aliases, rules, and reply — from $0, upgrade when you need room.
          </p>
          <div className="hero-actions mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => go(primaryHref)}>
              {primaryLabel}
              <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollTo("pricing")}>
              See pricing
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-[var(--muted)]">
            <Shield className="h-3.5 w-3.5 text-[var(--cta)]" />
            Hosted brand email for indie founders · cancel anytime
          </p>
        </div>

        <div className="landing-stage relative" aria-label="Flap inbox preview">
          <div className="landing-stage-glow" aria-hidden />
          <div className="hero-preview landing-preview">
            <div className="preview-top">
              <span className="preview-dot" />
              <strong>hello@acme.dev</strong>
              <Badge className="ml-auto">inbox</Badge>
            </div>
            <div className="preview-message highlight">
              <span className="avatar coral">C</span>
              <div>
                <strong>New customer</strong>
                <small>Re: pricing for acme.dev</small>
              </div>
              <time>9:41</time>
            </div>
            <div className="preview-message">
              <span className="avatar mint">S</span>
              <div>
                <strong>support@ → you</strong>
                <small>Alias routed · starred</small>
              </div>
              <time>9:12</time>
            </div>
            <div className="preview-message">
              <span className="avatar violet">A</span>
              <div>
                <strong>Catch-all quiet</strong>
                <small>spam@ archived by rule</small>
              </div>
              <time>Mon</time>
            </div>
            <div className="preview-footer">
              Your domain · your inbox · not a forward
            </div>
          </div>
        </div>
      </section>

      {/* Problem / ICP */}
      <section id="problem" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-12 max-w-2xl md:mb-14">
          <Badge variant="secondary" className="mb-4">
            <Mail className="mr-1 h-3 w-3" /> For founders
          </Badge>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Your brand deserves an inbox that is not Gmail.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Flap is for solo founders and freelancers with one to three domains who need hello@ to feel like a product — not a personal dump.
          </p>
        </div>
        <div className="landing-pain-grid grid gap-10 md:grid-cols-3 md:gap-12">
          {PAINS.map((p) => (
            <div key={p.title} className="landing-pain border-t border-[var(--line)] pt-6">
              <h3 className="text-lg font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-12 max-w-2xl md:mb-14">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" /> Product
          </Badge>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Stop dumping brand mail into personal Gmail.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Forwarding is fine until you need to reply, archive, or automate. Flap is the mailbox founders actually open.
          </p>
        </div>
        <div className="grid gap-10 md:grid-cols-2 md:gap-x-14 md:gap-y-12">
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

      {/* How it works */}
      <section id="how" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-12 max-w-2xl md:mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Live on your domain in three steps.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            No mail-server ops. Guided DNS, then a real inbox.
          </p>
        </div>
        <div className="landing-steps grid gap-10 md:grid-cols-3 md:gap-12">
          {STEPS.map((s) => (
            <div key={s.n} className="landing-step">
              <span className="landing-step-n font-[family-name:var(--font-mono)] text-sm font-medium tracking-wider text-[var(--cta)]">
                {s.n}
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] md:text-[15px]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Hosted vs DIY */}
      <section id="compare" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-12 max-w-2xl md:mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Hosted brand email — not a weekend of mail ops.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Some founders want to run everything themselves. Flap is for the rest: bring your domain, we run the inbox.
          </p>
        </div>
        <div className="landing-compare overflow-x-auto">
          <table className="landing-compare-table w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Flap (hosted)</th>
                <th scope="col">DIY self-host</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.dim}>
                  <th scope="row">{row.dim}</th>
                  <td>{row.flap}</td>
                  <td className="text-[var(--muted)]">{row.diy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="landing-section mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-section-head mb-12 max-w-2xl md:mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
            Clear plans. Teams when you need them.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Free to validate. Pro for solo multi-domain. Team unlocks seats and shared mailboxes — hosted convenience, not a DIY stack.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "landing-plan flex flex-col rounded-lg border p-6",
                plan.highlighted
                  ? "landing-plan-featured border-[var(--cta)]/45 bg-[var(--cta-dim)]"
                  : "border-[var(--line)] bg-[var(--surface)]/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.badge ? <Badge>{plan.badge}</Badge> : null}
              </div>
              <p className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
                {plan.price}
                <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{plan.blurb}</p>
              <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
                {plan.features.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-7 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => go(auth === "user" ? "/app/settings?tab=billing" : primaryHref)}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="landing-section mx-auto max-w-3xl px-5 md:px-8">
        <h2 className="mb-10 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-[2rem]">
          FAQ
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

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8 md:pb-28">
        <div className="landing-cta relative overflow-hidden rounded-2xl border border-[var(--line-strong)] px-8 py-14 md:px-14 md:py-16">
          <div className="landing-cta-glow" aria-hidden />
          <p className="relative font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
            Put hello@ on your domain today.
          </p>
          <p className="relative mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)] md:text-lg">
            Free workspace in minutes. Upgrade to Pro when aliases, storage, or API matter — Team when you share inboxes.
          </p>
          <Button size="lg" className="relative mt-8" onClick={() => go(primaryHref)}>
            {primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </section>

      <footer className="landing-footer mx-auto grid max-w-6xl gap-10 border-t border-[var(--line)] px-5 py-14 text-sm text-[var(--muted)] md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8 md:px-8 md:py-16">
        <div>
          <div className="brand mb-3 flex items-center gap-2 text-[var(--fg)]">
            <BrandMark /> Flap
          </div>
          <p className="max-w-xs text-sm leading-relaxed">
            Hosted brand email for founders. Real inboxes on your domain — aliases, rules, and reply — at useflap.online.
          </p>
          <p className="mt-5 text-xs">© {new Date().getFullYear()} Flap · useflap.online</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Product</span>
          <a href="#problem">Why Flap</a>
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#compare">Hosted vs DIY</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Account</span>
          <a href="/signup" onClick={(e) => { e.preventDefault(); go("/signup"); }}>Start free</a>
          <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
          <a href="mailto:support@useflap.online">Support</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Legal</span>
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy</a>
          <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing terms</a>
        </div>
      </footer>
    </div>
  );
}
