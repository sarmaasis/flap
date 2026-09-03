import { useEffect, useState } from "react";
import { ArrowRight, Check, Inbox, KeyRound, Shield, Sparkles, Workflow, Zap } from "lucide-react";
import BrandMark from "../components/BrandMark";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { cn } from "../lib/utils";

const FEATURES = [
  {
    icon: Inbox,
    title: "A real mailbox",
    body: "Inbox, send, drafts, scheduled, archive, spam, trash, snooze, star, and unread — with threads and attachments.",
  },
  {
    icon: Workflow,
    title: "Domains that work",
    body: "Custom domains, catch-all, aliases, and disposables. Point MX once, then route with rules that archive, label, forward, or block.",
  },
  {
    icon: KeyRound,
    title: "Built for builders",
    body: "API keys for transactional send, signed webhooks on inbound mail, contacts, signatures, templates, and JSON export/restore.",
  },
  {
    icon: Zap,
    title: "Live and quiet",
    body: "Live folder counts, browser notifications while Flap is open, and a dense inbox UI designed for daily mail — not demos.",
  },
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    blurb: "One domain to prove the fit.",
    features: ["1 domain · 2 mailboxes", "5 aliases", "100 MB storage", "Rules & export"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$9",
    blurb: "Founders who send and automate.",
    features: ["3 domains · 10 mailboxes", "50 aliases", "5 GB · API & webhooks", "Catch-all filters"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    blurb: "The plan most teams pick.",
    features: ["10 domains · 50 mailboxes", "Unlimited aliases", "25 GB storage", "Priority queue"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$49",
    blurb: "Headroom and shared-inbox roadmap.",
    features: ["50 domains · 200 mailboxes", "100 GB storage", "Team seats (roadmap)", "Onboarding help"],
  },
];

const FAQS = [
  {
    q: "Is Flap a forwarding service or a mailbox?",
    a: "Both. Flap is a hosted mailbox for your custom domain — receive, read, reply, schedule, archive — with aliases, catch-all, and optional forward rules when you want them.",
  },
  {
    q: "How does DNS / delivery work?",
    a: "You add your domain in Flap, then set MX (and SPF/DKIM) at your DNS host. Inbound mail is accepted for mailboxes and aliases you configure. Outbound send uses authenticated domain mail.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Settings includes JSON backup and restore for messages and key settings. You own the export.",
  },
  {
    q: "Do you support teams?",
    a: "Billing and single-tenant workspaces ship today. Shared inboxes and multi-seat access are on the Business roadmap — you can record interest from Settings → Team.",
  },
  {
    q: "What about API access?",
    a: "Starter and above include API keys for transactional send and HTTPS webhooks on mail.received, signed with your secret.",
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
          <a href="#features" className="hover:text-[var(--fg)]">Features</a>
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
          <Button
            size="sm"
            onClick={() => go(primaryHref)}
          >
            {primaryLabel}
          </Button>
        </nav>
        <Button className="md:hidden" size="sm" onClick={() => go(primaryHref)}>
          {primaryLabel}
        </Button>
      </header>

      <section className="landing-hero relative mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-8 md:grid-cols-[1.05fr_0.95fr] md:items-center md:px-8 md:pb-28 md:pt-14">
        <div className="landing-hero-copy">
          <p className="brand-hero mb-3 font-[family-name:var(--font-display)] text-5xl font-bold tracking-tight text-[var(--cta)] md:text-7xl">
            Flap
          </p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-3xl font-semibold leading-[1.15] tracking-tight text-[var(--fg)] md:text-4xl">
            Custom-domain email that ships as a product, not a side project.
          </h1>
          <p className="lede mt-4 max-w-lg text-base text-[var(--muted)] md:text-lg">
            Hosted inbox for your brand — aliases, rules, send, and developer rails — with plans that scale when you do.
          </p>
          <div className="hero-actions mt-8 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={() => go(primaryHref)}>
              {primaryLabel}
              <ArrowRight />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
              See pricing
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--muted)]">
            <Shield className="h-3.5 w-3.5 text-[var(--cta)]" />
            useflap.online · hosted mailbox · cancel anytime
          </p>
        </div>

        <div className="landing-stage relative" aria-label="Flap inbox preview">
          <div className="landing-stage-glow" aria-hidden />
          <div className="hero-preview landing-preview">
            <div className="preview-top">
              <span className="preview-dot" />
              <strong>Inbox</strong>
              <Badge className="ml-auto">live</Badge>
            </div>
            <div className="preview-message highlight">
              <span className="avatar coral">A</span>
              <div>
                <strong>Ava at Northstar</strong>
                <small>Welcome to hello@yourdomain.com</small>
              </div>
              <time>9:41</time>
            </div>
            <div className="preview-message">
              <span className="avatar mint">R</span>
              <div>
                <strong>Rules engine</strong>
                <small>Alias + catch-all applied</small>
              </div>
              <time>9:12</time>
            </div>
            <div className="preview-message">
              <span className="avatar violet">W</span>
              <div>
                <strong>Webhook delivered</strong>
                <small>mail.received → your app</small>
              </div>
              <time>Mon</time>
            </div>
            <div className="preview-footer">
              hello@yourdomain.com <span>•</span> yours to keep
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mb-10 max-w-2xl">
          <Badge variant="secondary" className="mb-3">
            <Sparkles className="mr-1 h-3 w-3" /> Why Flap
          </Badge>
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
            Everything you need to sell email as software.
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            Forwarding-only tools stop at the relay. Flap is the inbox operators actually open every day.
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-row flex gap-4 border-t border-[var(--line)] pt-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--cta-dim)] text-[var(--cta)]">
                <f.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="mb-10 max-w-2xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">Simple plans. Clear limits.</h2>
          <p className="mt-3 text-[var(--muted)]">Start free. Upgrade when domains, aliases, or API volume need room.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-lg border p-5",
                plan.highlighted
                  ? "border-[var(--cta)]/40 bg-[var(--cta-dim)] shadow-[0_0_0_1px_rgba(var(--cta-rgb),0.2)]"
                  : "border-[var(--line)] bg-[var(--surface)]/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.highlighted ? <Badge>Popular</Badge> : null}
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-3xl font-bold">
                {plan.price}
                <span className="text-sm font-normal text-[var(--muted)]">/mo</span>
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{plan.blurb}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cta)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => go(auth === "user" ? "/app/settings?tab=billing" : primaryHref)}
              >
                {plan.id === "free" ? "Start free" : "Choose plan"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
        <h2 className="mb-8 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">FAQ</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
        <div className="landing-cta relative overflow-hidden rounded-2xl border border-[var(--line-strong)] px-6 py-12 md:px-12">
          <div className="landing-cta-glow" aria-hidden />
          <p className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
            Put your domain on Flap.
          </p>
          <p className="mt-3 max-w-xl text-[var(--muted)]">
            Create a workspace, add a domain, and open a mailbox that looks like a product — because it is one.
          </p>
          <Button size="lg" className="mt-6" onClick={() => go(primaryHref)}>
            {primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </section>

      <footer className="mx-auto grid max-w-6xl gap-8 border-t border-[var(--line)] px-5 py-10 text-sm text-[var(--muted)] md:grid-cols-[1.2fr_1fr_1fr_1fr] md:px-8">
        <div>
          <div className="brand mb-2 flex items-center gap-2 text-[var(--fg)]">
            <BrandMark /> Flap
          </div>
          <p className="max-w-xs text-xs leading-relaxed">Hosted custom-domain email at useflap.online.</p>
          <p className="mt-3 text-xs">© {new Date().getFullYear()} Flap</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Product</span>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Account</span>
          <a href="/signup" onClick={(e) => { e.preventDefault(); go("/signup"); }}>Start free</a>
          <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
          <a href="mailto:support@useflap.online">Support</a>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Legal</span>
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy</a>
          <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing terms</a>
        </div>
      </footer>
    </div>
  );
}
