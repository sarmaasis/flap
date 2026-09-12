import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Globe2,
  Inbox,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { CREDIBILITY, MARKETING, SITE_URL } from "../content/marketing";
import { api } from "../lib/api";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, faqPageLd, setJsonLd, setPageMeta } from "../lib/seo";
import { PLANS } from "../../shared/plans";
import { FOUNDER } from "../../shared/product-facts";
import { cn } from "../lib/utils";

const DOMAIN_FLOW = [
  {
    label: "Domains",
    value: "3 active",
    detail: "product-one.com, studio.co, launch.dev",
    icon: Globe2,
  },
  {
    label: "DNS",
    value: "Verified",
    detail: "MX, SPF, DKIM, and inbound checks pass",
    icon: ShieldCheck,
  },
  {
    label: "Mailboxes",
    value: "8 routes",
    detail: "hello@, support@, billing@, security@",
    icon: Inbox,
  },
  {
    label: "Replies",
    value: "Matched",
    detail: "Send from the address that received the message",
    icon: Send,
  },
];

const TRIAGE_ROWS = [
  {
    domain: "product-one.com",
    from: "Maya at Stripe",
    subject: "Invoice address mismatch",
    mailbox: "billing@product-one.com",
    label: "Billing",
    status: "Reply as billing@product-one.com",
  },
  {
    domain: "launch.dev",
    from: "Evan",
    subject: "Question before upgrading",
    mailbox: "hello@launch.dev",
    label: "Founder lead",
    status: "Reply as hello@launch.dev",
  },
  {
    domain: "studio.co",
    from: "Security researcher",
    subject: "Responsible disclosure",
    mailbox: "security@studio.co",
    label: "Security",
    status: "Reply as security@studio.co",
  },
];

const OPERATING_LOOP = [
  "Add the domain you already own",
  "Copy registrar-ready DNS records",
  "Create the first mailbox",
  "Send and receive a test message",
  "Export whenever you need to leave",
];

const EXPANSION_LANES = [
  {
    icon: Users,
    title: "Team lanes",
    body: "Bring teammates into the right mailbox or client domain when a solo inbox becomes shared work.",
  },
  {
    icon: Zap,
    title: "API lanes",
    body: "Use the same verified domains for app mail, webhooks, and lightweight SDKs on paid plans.",
  },
  {
    icon: Mail,
    title: "Audience lanes",
    body: "Send small launch notes and booking confirmations from domains customers already recognize.",
  },
  {
    icon: Lock,
    title: "Exit lanes",
    body: "Keep JSON backup and mailbox export available so the account never feels trapped.",
  },
];

const PRICING_PROFILES = [
  {
    id: "solo",
    profile: "Solo operator",
    bestFor: "A founder running several project domains alone.",
    decision: `${PLANS.solo.limits.mailboxes} mailboxes, ${PLANS.solo.limits.domains} domains, API included.`,
  },
  {
    id: "pro",
    profile: "Small product team",
    bestFor: "Support, billing, and founder mail split across a few people.",
    decision: `${PLANS.pro.limits.mailboxes} mailboxes, ${PLANS.pro.limits.team_seats} seats, higher sending room.`,
  },
  {
    id: "team",
    profile: "Studio or agency",
    bestFor: "Client domains, shared support addresses, and team-level access.",
    decision: `${PLANS.team.limits.mailboxes} mailboxes, ${PLANS.team.limits.team_seats} seats, studio capacity.`,
  },
] as const;

const FAQS = [
  {
    q: "Can I use multiple domains in one inbox?",
    a: `Yes. Free includes ${PLANS.free.limits.domains} domains to prove MX. Solo, Pro, Team, and Scale each include up to ${PLANS.solo.limits.domains} custom domains in one Flap inbox. Filter by domain or mailbox when you need focus.`,
  },
  {
    q: "When I reply, which email address does Flap send from?",
    a: "Reply uses the mailbox that received the message. Compose shows that From address before you send. You can change it for that reply without changing unrelated threads.",
  },
  {
    q: "Does Flap replace Google Workspace?",
    a: "For custom-domain email across many projects, yes. Flap is not a Docs, Drive, or Meet suite. If you need full collaboration tools, keep those and use Flap for multi-domain mail.",
  },
  {
    q: "Can I bring an existing domain?",
    a: "Yes. Keep DNS at Cloudflare, Namecheap, Porkbun, GoDaddy, Route 53, Vercel, or anywhere else. Add the domain in Flap, publish the records shown, then verify.",
  },
  {
    q: "Will changing MX records affect my website?",
    a: "No. MX only controls where email is delivered. Your website records are separate. Change MX only when you are ready for Flap to receive mail for that domain.",
  },
  {
    q: "Can I migrate my old email?",
    a: "Flap does not auto-import IMAP or full mailboxes today. Export from your old provider if needed, switch MX after you verify the domain and test send/receive, and use Settings for ongoing .mbox and JSON export.",
  },
  {
    q: "Can I export my email if I leave?",
    a: "Yes. Settings includes JSON workspace backup and per-mailbox .mbox download. Paid accounts keep an export window after cancel.",
  },
  {
    q: "Does Flap use Amazon SES?",
    a: "Yes. Customer mail runs on Amazon SES. The Flap app runs on Cloudflare. Your DNS stays at any registrar.",
  },
  {
    q: "Can teammates access individual mailboxes?",
    a: "Pro adds up to 5 seats. Team unlocks more seats plus shared mailboxes. Free and Solo are designed for solo founders.",
  },
  {
    q: "Does Flap support IMAP and SMTP?",
    a: "Not yet. Use the web app and PWA. IMAP/SMTP client access is planned but not available.",
  },
];

function AccentDot() {
  return <span className="text-[var(--accent)]">.</span>;
}

function ShellBand({
  children,
  tone = "light",
  id,
  className,
}: {
  children: ReactNode;
  tone?: "light" | "ink" | "soft" | "blue";
  id?: string;
  className?: string;
}) {
  const isDark = tone === "ink" || tone === "blue";
  return (
    <section
      id={id}
      data-nav-theme={isDark ? "dark" : "light"}
      className={cn(
        "relative overflow-hidden",
        tone === "light" && "bg-[var(--surface)] text-[var(--foreground)]",
        tone === "soft" && "bg-[#eef6ff] text-[var(--foreground)]",
        tone === "ink" &&
          "bg-[#07111f] text-white [--foreground:#fff] [--foreground-muted:#b8c6d9] [--foreground-faint:#7c8da5] [--line:rgba(255,255,255,0.16)] [--surface-raised:rgba(255,255,255,0.06)]",
        tone === "blue" &&
          "bg-[var(--accent)] text-white [--foreground:#fff] [--foreground-muted:rgba(255,255,255,0.78)] [--line:rgba(255,255,255,0.22)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 md:px-8">{children}</div>
    </section>
  );
}

function SectionTitle({ kicker, children, className }: { kicker?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[680px]", className)}>
      {kicker ? (
        <p className="mb-3 font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-text)]">
          {kicker}
        </p>
      ) : null}
      <h2 className="text-[clamp(30px,4.2vw,54px)] font-extrabold leading-[1.02] tracking-[-0.035em] text-[var(--foreground)]">
        {children}
        <AccentDot />
      </h2>
    </div>
  );
}

function CommandCenter() {
  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-raised)] p-3 shadow-[0_30px_90px_rgba(15,23,42,0.12)]">
      <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
        <aside className="rounded-[22px] bg-[#07111f] p-4 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#93c5fd]">Flap desk</span>
            <span className="h-2 w-2 rounded-full bg-[#34d399]" />
          </div>
          <div className="mt-7 space-y-4">
            {["All domains", "DNS health", "Mailboxes", "Exports"].map((item, index) => (
              <div key={item} className={cn("rounded-xl px-3 py-2 text-sm", index === 0 ? "bg-white text-[#07111f]" : "text-[#b8c6d9]")}>
                {item}
              </div>
            ))}
          </div>
        </aside>
        <div className="min-w-0 rounded-[22px] border border-[var(--line)] bg-[var(--surface)]">
          <div className="grid gap-3 border-b border-[var(--line)] p-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <p className="font-[family-name:var(--font-mono)] text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-faint)]">
                Today
              </p>
              <h3 className="mt-1 text-xl font-extrabold tracking-[-0.02em]">17 messages across 3 product domains</h3>
            </div>
            <div className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] opacity-80">Reply identity</p>
              <p className="mt-1 text-sm font-bold">Auto-matched</p>
            </div>
          </div>
          <div className="grid gap-0 lg:grid-cols-[1fr_240px]">
            <div className="divide-y divide-[var(--line)]">
              {TRIAGE_ROWS.map((row) => (
                <div key={row.subject} className="grid gap-3 px-4 py-4 sm:grid-cols-[128px_1fr]">
                  <span className="font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--accent-text)]">{row.domain}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <strong className="text-sm">{row.from}</strong>
                      <span className="rounded-full bg-[var(--accent-dim)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-text)]">{row.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--foreground)]">{row.subject}</p>
                    <p className="mt-1 font-[family-name:var(--font-mono)] text-[11px] text-[var(--foreground-faint)]">{row.status}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[var(--line)] p-4 lg:border-t-0 lg:border-l">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--foreground-faint)]">Domain health</p>
              <div className="mt-4 space-y-3">
                {["MX receiving", "DKIM signed", "SPF aligned", "Export ready"].map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3 text-sm">
                    <span>{item}</span>
                    <Check className="h-4 w-4 text-[var(--success-text)]" aria-hidden />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [auth, setAuth] = useState<"loading" | "setup" | "guest" | "user">("loading");

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
    trackOnce("homepage", "homepage_view");
    Promise.all([
      api.setupStatus().catch(() => ({ needs_setup: false })),
      api.me().then((me) => me.user.email_verified !== false).catch(() => false),
    ])
      .then(([setup, signedIn]) => {
        if (setup.needs_setup) setAuth("setup");
        else if (signedIn) setAuth("user");
        else setAuth("guest");
      })
      .catch(() => setAuth("guest"));
  }, []);

  const primaryHref = auth === "setup" ? "/setup" : auth === "user" ? "/app" : "/signup";
  const primaryLabel =
    auth === "setup" ? "Create your workspace" : auth === "user" ? "Open inbox" : "Connect your first domain";

  const onPrimary = (source: string) => {
    track("signup_clicked", { source });
    track("cta_connect_domain", { source });
    go(primaryHref);
  };

  return (
    <MarketingShell primaryHref={primaryHref} primaryLabel={auth === "guest" || auth === "loading" ? "Get started" : primaryLabel}>
      <ShellBand className="pt-[118px] pb-12 md:pt-[150px] md:pb-16 landing-hero-band">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div className="pb-2">
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-text)]">
              Domain operations for builders
            </p>
            <h1 className="mt-4 max-w-[12ch] text-[clamp(48px,7vw,92px)] font-black leading-[0.92] tracking-[-0.065em] text-[var(--foreground)]">
              Run every product email from one desk<AccentDot />
            </h1>
            <p className="mt-6 max-w-[560px] text-lg leading-[1.6] text-[var(--foreground-muted)] md:text-xl">
              Connect the domains you own, receive all mail in one operational inbox, and reply from the exact address your customer used.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="pill" className="h-11 rounded-full px-7 text-sm font-semibold" asChild>
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
              <Button size="pill" variant="outline" className="h-11 rounded-full px-6 text-sm font-semibold" asChild>
                <a
                  href="/demo"
                  onClick={(e) => {
                    e.preventDefault();
                    go("/demo");
                  }}
                >
                  Try demo
                </a>
              </Button>
            </div>
          </div>
          <CommandCenter />
        </div>
        <div className="mt-8 grid gap-3 border-y border-[var(--line)] py-4 md:grid-cols-4">
          {[
            ["Starts at", `$${PLANS.solo.price_monthly}/mo`],
            ["Paid domain room", `${PLANS.solo.limits.domains} domains`],
            ["Free proof", `${PLANS.free.limits.mailboxes} real mailboxes`],
            ["Infra", "Amazon SES + Cloudflare"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 md:block">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-faint)]">{label}</span>
              <strong className="text-sm md:mt-1 md:block md:text-lg">{value}</strong>
            </div>
          ))}
        </div>
      </ShellBand>

      <ShellBand tone="ink" id="map" className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-center">
          <SectionTitle kicker="Operating map">The product is the route from domain to reply</SectionTitle>
          <div className="grid gap-3 md:grid-cols-4">
            {DOMAIN_FLOW.map((item, index) => (
              <div key={item.label} className="relative rounded-3xl border border-[var(--line)] bg-[var(--surface-raised)] p-5">
                <item.icon className="h-5 w-5 text-[#93c5fd]" aria-hidden />
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--foreground-faint)]">{item.label}</p>
                <h3 className="mt-1 text-xl font-extrabold">{item.value}</h3>
                <p className="mt-2 text-sm leading-[1.5] text-[var(--foreground-muted)]">{item.detail}</p>
                {index < DOMAIN_FLOW.length - 1 ? (
                  <span className="absolute top-1/2 right-[-18px] hidden h-px w-8 bg-[rgba(147,197,253,0.5)] md:block" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </ShellBand>

      <ShellBand id="triage" className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionTitle kicker="Triage desk">Domain context should be visible before you open the email</SectionTitle>
            <p className="mt-5 max-w-[560px] text-base leading-[1.65] text-[var(--foreground-muted)]">
              The inbox is organized around the thing founders actually juggle: which product, which address, which reply identity, and whether the domain is healthy.
            </p>
            <ul className="mt-8 space-y-3">
              {OPERATING_LOOP.map((item) => (
                <li key={item} className="flex gap-3 text-sm font-medium">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success-text)]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[26px] border border-[var(--line)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow)]">
            <div className="rounded-[20px] bg-[var(--surface)]">
              {TRIAGE_ROWS.map((row) => (
                <article key={row.mailbox} className="border-b border-[var(--line)] p-5 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="rounded-full bg-[var(--accent-dim)] px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--accent-text)]">{row.mailbox}</span>
                    <span className="text-xs font-semibold text-[var(--foreground-faint)]">{row.domain}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{row.subject}</h3>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">From {row.from}</p>
                  <div className="mt-4 rounded-2xl border border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] px-4 py-3 text-sm font-semibold text-[var(--accent-text)]">
                    {row.status}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </ShellBand>

      <ShellBand tone="soft" id="expand" className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionTitle kicker="Expansion">Start with mail. Add lanes only when they help.</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {EXPANSION_LANES.map((lane) => (
              <div key={lane.title} className="rounded-[22px] border border-[rgba(37,99,235,0.18)] bg-white p-5">
                <lane.icon className="h-5 w-5 text-[var(--accent)]" aria-hidden />
                <h3 className="mt-5 text-base font-bold">{lane.title}</h3>
                <p className="mt-2 text-sm leading-[1.55] text-[var(--foreground-muted)]">{lane.body}</p>
              </div>
            ))}
          </div>
        </div>
      </ShellBand>

      <ShellBand id="pricing" className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.68fr_1.32fr] lg:items-start">
          <div>
            <SectionTitle kicker="Pricing">Choose by operating shape, then scale capacity</SectionTitle>
            <p className="mt-5 text-base leading-[1.65] text-[var(--foreground-muted)]">
              Paid plans keep the same core workflow: connect domains, receive mail, reply as the right address, export data. The difference is mailbox, seat, and sending capacity.
            </p>
            <Button className="mt-7 rounded-full" onClick={() => go("/pricing")}>
              See full pricing
              <ArrowRight />
            </Button>
          </div>
          <div className="overflow-hidden rounded-[26px] border border-[var(--line)] bg-[var(--surface-raised)]">
            {PRICING_PROFILES.map((profile) => (
              <div key={profile.id} className="grid gap-4 border-b border-[var(--line)] p-5 last:border-b-0 md:grid-cols-[150px_1fr_110px] md:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-text)]">{PLANS[profile.id].name}</p>
                  <h3 className="mt-1 text-base font-extrabold">{profile.profile}</h3>
                </div>
                <div>
                  <p className="text-sm font-medium">{profile.bestFor}</p>
                  <p className="mt-1 text-sm text-[var(--foreground-muted)]">{profile.decision}</p>
                </div>
                <p className="text-2xl font-black tracking-[-0.03em]">
                  ${PLANS[profile.id].price_monthly}
                  <span className="text-sm font-medium text-[var(--foreground-muted)]">/mo</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </ShellBand>

      <ShellBand tone="ink" id="trust" className="py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <SectionTitle kicker="Trust">No mystery mail system, no fake proof</SectionTitle>
            <p className="mt-5 max-w-[560px] text-base leading-[1.65] text-[var(--foreground-muted)]">
              Flap is built for domains you own or are authorized to operate. Every sending domain must be verified, customer mail runs through Amazon SES, and exports stay available from Settings.
            </p>
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">
              Built by {FOUNDER.name} for the very specific founder problem of too many product domains and not enough operational clarity.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {CREDIBILITY.slice(0, 3).map((c) => (
              <div key={c.title} className="rounded-[22px] border border-[var(--line)] bg-[var(--surface-raised)] p-5">
                <ShieldCheck className="h-5 w-5 text-[#93c5fd]" aria-hidden />
                <h3 className="mt-5 text-sm font-bold">{c.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.5] text-[var(--foreground-muted)]">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </ShellBand>

      <ShellBand id="faq" className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <SectionTitle kicker="Questions" className="mb-8">What founders ask before switching MX</SectionTitle>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ShellBand>

      <ShellBand tone="blue" className="py-14 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs font-bold uppercase tracking-[0.14em] text-white/75">Start clean</p>
            <h2 className="mt-3 max-w-[760px] text-[clamp(32px,5vw,64px)] font-black leading-[0.98] tracking-[-0.055em]">
              Bring one domain online, then add the rest when you are ready.
            </h2>
          </div>
          <Button
            size="pill"
            className="h-12 rounded-full bg-white px-8 text-sm font-semibold text-[var(--accent)] hover:bg-white hover:opacity-95"
            onClick={() => onPrimary("final_cta")}
          >
            {primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </ShellBand>
    </MarketingShell>
  );
}

function PLAN_ORDER_OFFERS() {
  return (["solo", "pro", "team"] as const).map((id) => ({
    "@type": "Offer",
    price: String(PLANS[id].price_monthly),
    priceCurrency: "USD",
    name: PLANS[id].name,
  }));
}
