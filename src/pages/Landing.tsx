import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  Copy,
  Inbox,
  Lock,
  Mail,
  Newspaper,
  Sparkles,
  Star,
  Terminal,
  Users,
  Zap,
} from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { CREDIBILITY, MARKETING, SITE_URL } from "../content/marketing";
import { FOR_PAGES as HUB_FOR, VS_PAGES } from "../content/hubs";
import { API_SEND } from "../content/api-docs";
import { api } from "../lib/api";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, faqPageLd, setJsonLd, setPageMeta } from "../lib/seo";
import { PLANS } from "../../shared/plans";
import { cn } from "../lib/utils";

const MAILBOX_CARDS = [
  { initials: "HE", address: "hello@studio.example", role: "Active", tone: "active" as const },
  { initials: "SU", address: "support@launch.example", role: "Shared", tone: "shared" as const },
  { initials: "API", address: "api@ship.example", role: "API", tone: "api" as const },
];

const STATS = [
  {
    value: String(PLANS.solo.price_monthly),
    suffix: "$",
    prefix: true,
    label: "Solo starts",
    body: `${PLANS.solo.limits.mailboxes} mailboxes. Same stack as Pro and Team.`,
  },
  {
    value: "50",
    suffix: "+",
    label: "Domains",
    body: "Included on every paid plan. Mailbox count is the capacity dial.",
  },
  {
    value: "5",
    suffix: "-in-1",
    label: "One subscription",
    body: "Webmail, newsletters, bookings, calendar, and an email API.",
  },
  {
    value: "0",
    suffix: "",
    label: "Ads or scanning",
    body: "Customer mail on Amazon SES. App on Cloudflare.",
  },
];

const INBOX_FEATURES = [
  {
    title: "Many domains, one place",
    body: `Up to ${PLANS.solo.limits.domains} custom domains on every paid plan. Read and reply as each brand.`,
  },
  {
    title: "Shared inboxes when you grow",
    body: "Pro and Team add seats and shared mailboxes so support@ is a team surface, not a forwarding hack.",
  },
  {
    title: "Identity stays visible",
    body: "Domain chips and from-address clarity so you never reply as the wrong brand.",
  },
];

const CALENDAR_FEATURES = [
  {
    title: "Week calendar in the same app",
    body: "Events live next to mail, not a separate suite you forget to open.",
  },
  {
    title: "Booking pages on your domain",
    body: "Share a booking link that matches your brand, not a generic scheduler subdomain.",
  },
  {
    title: "CalDAV-friendly contacts",
    body: "Keep people and schedules in the same workspace as your aliases.",
  },
];

const NEWSLETTER_FEATURES = [
  {
    title: "Send from your domain",
    body: "Newsletters use the same custom-domain reputation as your day-to-day mail.",
  },
  {
    title: "Capped, intentional blasts",
    body: "Plan limits keep volume honest. Built for launches, not cold outbound.",
  },
  {
    title: "Drafts beside the inbox",
    body: "Write and review in the same product you already open for support mail.",
  },
];

const AI_FEATURES = [
  {
    title: "Ask your inbox in plain language",
    body: "Summarize threads and draft replies without leaving Flap.",
  },
  {
    title: "Confirm before send",
    body: "AI never silently delivers. You approve every outbound message.",
  },
  {
    title: "MCP for agents",
    body: "List domains and draft with confirm. Tools built for agent workflows.",
  },
];

const CAPABILITIES = [
  {
    icon: Mail,
    title: "Works with any client",
    body: "Webmail first. Keep your DNS at any registrar. Flap gives you the MX/SPF/DKIM to publish.",
  },
  {
    icon: Calendar,
    title: "CalDAV & CardDAV ready",
    body: "Calendars, bookings, and contacts sit beside mail so scheduling is not a bolt-on.",
  },
  {
    icon: Inbox,
    title: "Storage that scales with you",
    body: "Mailbox and send caps grow with Solo, Pro, Team, and Scale. No surprise seat taxes.",
  },
  {
    icon: Users,
    title: "Team access when you need it",
    body: "Shared inboxes and seats on Pro and Team. Free and Solo stay solo-friendly.",
  },
  {
    icon: Zap,
    title: "Automations & webhooks",
    body: "React to mail.received, send via API keys, and wire thin TypeScript or Python SDKs.",
  },
  {
    icon: Lock,
    title: "Privacy by architecture",
    body: MARKETING.architecture_line,
  },
];

const FAQS = [
  {
    q: "What is custom-domain email and why does Flap use it?",
    a: "Custom-domain email means sending and receiving as you@yourdomain.com instead of a generic Gmail or Outlook address. Flap hosts real mailboxes on your own domain, so every project has a professional identity without a separate Google Workspace account per launch.",
  },
  {
    q: "Who is Flap for?",
    a: "Indie hackers, serial founders, micro-SaaS builders, freelancers, and small studios who own multiple domains and do not want a separate Google Workspace (or similar) subscription for every project.",
  },
  {
    q: "Is Flap just cheap business email?",
    a: "No. Flap is built around one inbox for many startup domains, with fast setup and multiple sender identities. It does not compete solely on price with full productivity suites. It also includes AI drafts, newsletters, booking pages, a transactional API, and a calendar.",
  },
  {
    q: "How many domains can I connect?",
    a: `Free includes ${PLANS.free.limits.domains} domains to prove MX before you pay. Solo, Pro, and Team each include up to ${PLANS.solo.limits.domains} custom domains. Referrals can add permanent bonus domain slots.`,
  },
  {
    q: "Do you support teams and shared inboxes?",
    a: "Pro adds up to 5 seats. Team unlocks unlimited seats, shared mailboxes (e.g. support@, hello@), and delegation. Free and Solo are designed for solo founders.",
  },
  {
    q: "How does DNS and email delivery work?",
    a: "Customer mail runs on Amazon SES. The Flap app runs on Cloudflare. Your DNS stays at any registrar: Cloudflare, Namecheap, Porkbun, GoDaddy, Route 53, and more. You publish MX/SPF/DKIM records Flap shows you, then click Check DNS.",
  },
  {
    q: "Does Flap support IMAP and SMTP?",
    a: "Not yet. Use the web app and PWA. IMAP/SMTP client access is planned but not yet available.",
  },
  {
    q: "Can I send transactional email via API?",
    a: "Yes. Solo and above include API keys for transactional sends. POST to /api/v1/send with a Bearer key. TypeScript and Python SDKs plus a thin CLI are available.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Settings includes JSON backup, .mbox mailbox download, and workspace restore. Export anytime. No lock-in.",
  },
];

const COMPARISON_LINKS = [
  ...VS_PAGES.slice(0, 4).map((p) => ({ path: p.path, label: p.h1, body: p.description })),
  ...HUB_FOR.slice(0, 2).map((p) => ({ path: p.path, label: p.h1, body: p.description })),
];

const API_SAMPLES = {
  typescript: `const res = await fetch("https://useflap.online/api/v1/send", {
  method: "POST",
  headers: {
    Authorization: "Bearer flap_YOUR_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "customer@example.com",
    subject: "Thanks for signing up",
    text: "Welcome to the product.",
    from: "hello@yourdomain.com",
  }),
});`,
  python: `import requests

requests.post(
  "https://useflap.online/api/v1/send",
  headers={"Authorization": "Bearer flap_YOUR_KEY"},
  json={
    "to": "customer@example.com",
    "subject": "Thanks for signing up",
    "text": "Welcome to the product.",
    "from": "hello@yourdomain.com",
  },
)`,
  curl: `curl -X POST https://useflap.online/api/v1/send \\
  -H "Authorization: Bearer flap_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "customer@example.com",
    "subject": "Thanks for signing up",
    "text": "Welcome to the product.",
    "from": "hello@yourdomain.com"
  }'`,
} as const;

type ApiTab = keyof typeof API_SAMPLES;

function AccentPeriod() {
  return <span className="text-[var(--accent)]">.</span>;
}

function SectionHeading({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-[clamp(36px,5vw,64px)] font-extrabold leading-[1.05] tracking-[-1.6px] text-[var(--foreground)]", className)}>
      {children}
      <AccentPeriod />
    </h2>
  );
}

function Band({
  children,
  tone = "light",
  id,
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "compare" | "accent";
  id?: string;
  className?: string;
}) {
  const navTheme = tone === "dark" || tone === "accent" ? "dark" : "light";
  return (
    <section
      id={id}
      data-nav-theme={navTheme}
      className={cn(
        "relative overflow-hidden py-20 md:py-32",
        tone === "light" && "bg-[var(--surface)] text-[var(--foreground)]",
        tone === "dark" &&
          "bg-[var(--landing-dark)] text-[var(--landing-dark-fg)] [--fg:var(--landing-dark-fg)] [--foreground:var(--landing-dark-fg)] [--foreground-faint:var(--landing-dark-faint)] [--foreground-muted:var(--landing-dark-muted)] [--line:var(--landing-dark-line)] [--muted:var(--landing-dark-muted)] [--surface-raised:var(--landing-dark-raised)]",
        tone === "compare" && "bg-[var(--landing-compare)] text-[var(--foreground)]",
        tone === "accent" &&
          "bg-[var(--accent)] text-[var(--accent-fg)] [--foreground:var(--accent-fg)] [--foreground-muted:color-mix(in_srgb,var(--accent-fg)_80%,transparent)]",
        className,
      )}
    >
      <div
        className={cn("pointer-events-none absolute inset-0 z-0", tone === "accent" ? "opacity-[0.045]" : "opacity-[0.03]")}
        aria-hidden
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "180px 180px",
        }}
      />
      <div className="relative z-1 mx-auto w-full max-w-[1152px] px-5 md:px-8">{children}</div>
    </section>
  );
}

function ProductFrame({
  title,
  children,
  dark,
}: {
  title: string;
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-10 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]",
        dark && "border-[var(--landing-dark-line)] bg-[var(--landing-dark-raised)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-[var(--line)] px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-[var(--foreground-disabled)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--foreground-disabled)]" />
        <span className="h-2 w-2 rounded-full bg-[var(--foreground-disabled)]" />
        <em className="ml-2 font-[family-name:var(--font-mono)] text-xs not-italic text-[var(--foreground-faint)]">{title}</em>
      </div>
      {children}
    </div>
  );
}

function FeatureTrio({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="pt-1">
          <h3 className="text-base font-bold leading-normal">{item.title}</h3>
          <p className="mt-2 text-sm leading-[1.55] text-[var(--foreground-muted)]">{item.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [auth, setAuth] = useState<"loading" | "setup" | "guest" | "user">("loading");
  const [apiTab, setApiTab] = useState<ApiTab>("typescript");
  const [copied, setCopied] = useState(false);

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
  const primaryLabel = auth === "setup" ? "Create your workspace" : auth === "user" ? "Open inbox" : "Start free";
  const heroCta = auth === "guest" || auth === "loading" ? "Try free" : primaryLabel;

  const onPrimary = (source: string) => {
    track("signup_clicked", { source });
    go(primaryHref);
  };

  const copySample = async () => {
    try {
      await navigator.clipboard.writeText(API_SAMPLES[apiTab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <MarketingShell primaryHref={primaryHref} primaryLabel={auth === "guest" || auth === "loading" ? "Get started" : primaryLabel}>
      <Band tone="light" className="pt-[120px] md:pt-[148px] landing-hero-band">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
              Custom-domain email for every project you ship.
            </p>
            <h1 className="mt-4 max-w-[14ch] text-[clamp(40px,5vw,56px)] font-extrabold leading-[1.05] tracking-[-1.4px] text-[var(--foreground)]">
              <span className="inline box-decoration-clone rounded-[0.15em] bg-[rgba(var(--accent-rgb),0.18)] px-[0.12em] py-[0.04em] font-[family-name:var(--font-serif)] font-normal italic">
                Every project.
              </span>
              <br />
              One calm inbox
              <AccentPeriod />
            </h1>
            <p className="mt-6 max-w-[520px] text-lg leading-[1.6] text-[var(--foreground-muted)]">
              {MARKETING.hero_subheadline}{" "}
              <strong className="font-semibold text-[var(--foreground)]">From ${PLANS.solo.price_monthly}/mo.</strong>
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="pill" className="h-11 rounded-full px-7 text-sm font-semibold" asChild>
                <a
                  href={primaryHref}
                  onClick={(e) => {
                    e.preventDefault();
                    onPrimary("hero");
                  }}
                >
                  {heroCta}
                  <ArrowRight />
                </a>
              </Button>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-2 text-[13px] font-medium text-[var(--foreground-muted)]">
                <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" aria-hidden />
                Free plan includes real mailboxes
              </span>
            </div>
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">
              Start free with real custom-domain mailboxes. Upgrade as your projects grow. Up to 50 domains on every paid plan.
            </p>
          </div>

          <div className="relative flex min-h-[360px] items-center" aria-label="Example of Flap mailboxes and API">
            <div
              className="pointer-events-none absolute top-[8%] right-[-8%] bottom-[-12%] left-[-8%] bg-[radial-gradient(circle_at_50%_40%,rgba(var(--accent-rgb),0.16),transparent_65%)] blur-[28px]"
              aria-hidden
            />
            <div className="relative flex w-full flex-col gap-2.5">
              {MAILBOX_CARDS.map((card) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-3.5 py-3 shadow-[var(--shadow)]"
                  key={card.address}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-dim)] font-[family-name:var(--font-mono)] text-[11px] font-bold text-[var(--accent-text)]">
                    {card.initials}
                  </span>
                  <div>
                    <strong className="block text-sm font-semibold tracking-[-0.01em]">{card.address}</strong>
                    <small className="text-xs text-[var(--foreground-muted)]">Mailbox on your domain</small>
                  </div>
                  <span
                    className={cn(
                      "ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      card.tone === "active" && "bg-[var(--accent-dim)] text-[var(--accent-text)]",
                      card.tone === "shared" &&
                        "bg-[color-mix(in_srgb,var(--chart-expansion)_12%,transparent)] text-[var(--chart-expansion)]",
                      card.tone === "api" &&
                        "bg-[color-mix(in_srgb,var(--chart-new)_12%,transparent)] text-[var(--success-text)]",
                    )}
                  >
                    {card.role}
                  </span>
                </div>
              ))}
              <div className="mt-1 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--landing-dark)] px-4 py-3.5 font-[family-name:var(--font-mono)] text-xs leading-[1.55] text-[var(--landing-dark-fg)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]">
                <div className="mb-2.5 flex items-center gap-2 text-[11px] text-[var(--landing-dark-muted)]">
                  <Terminal className="h-3.5 w-3.5" aria-hidden />
                  <span>POST {API_SEND.path}</span>
                </div>
                <pre className="m-0 whitespace-pre-wrap break-words">{`{
  "to": "customer@example.com",
  "subject": "Thanks for signing up",
  "from": "hello@yourdomain.com"
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="light">
        <div className="grid grid-cols-2 gap-6 border-y border-[var(--line)] py-8 md:grid-cols-4 md:gap-0 md:[&>*+*]:border-l md:[&>*+*]:border-[var(--line)] md:[&>*+*]:pl-6 md:[&>*:not(:last-child)]:pr-6">
          {STATS.map((s) => (
            <div key={s.label}>
              <strong className="block font-[family-name:var(--font-serif)] text-[clamp(2rem,3vw,2.5rem)] font-extrabold leading-none tracking-[-0.02em]">
                {s.prefix ? (
                  <>
                    <span className="text-[var(--accent)]">{s.suffix}</span>
                    {s.value}
                  </>
                ) : (
                  <>
                    {s.value}
                    {s.suffix ? <span className="text-[var(--accent)]">{s.suffix}</span> : null}
                  </>
                )}
              </strong>
              <span className="mt-[0.45rem] block text-sm font-semibold">{s.label}</span>
              <p className="mt-[0.35rem] mb-0 text-[13px] leading-[1.45] text-[var(--foreground-muted)]">{s.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="dark" id="features">
        <div className="max-w-2xl">
          <SectionHeading>Custom-domain email across all your projects</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">{MARKETING.architecture_line}</p>
        </div>
        <ProductFrame title="Inbox · All domains" dark>
          <div className="py-2 pb-3">
            {[
              { name: "Alex Chen", subject: "The next chapter starts here", addr: "hello@studio.example", unread: true },
              { name: "Jamie Lee", subject: "A small update. A big milestone.", addr: "team@launch.example", unread: true },
              { name: "Morgan Reed", subject: "Thanks for the quick reply", addr: "support@studio.example", unread: false },
            ].map((row) => (
              <div
                key={row.addr}
                className={cn("grid gap-1 border-b border-[var(--line)] px-5 py-3.5", row.unread && "shadow-[inset_3px_0_var(--accent)]")}
              >
                <strong className="text-[13px] font-semibold">{row.name}</strong>
                <span className="text-[13px]">{row.subject}</span>
                <em className="font-[family-name:var(--font-mono)] text-[11px] not-italic text-[var(--foreground-faint)]">{row.addr}</em>
              </div>
            ))}
          </div>
        </ProductFrame>
        <FeatureTrio items={INBOX_FEATURES} />
      </Band>

      <Band tone="light" id="proof">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold tracking-[1.2px] text-[var(--accent)] uppercase">Built to be trusted</p>
          <SectionHeading>Email you can trust with your brand</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Your domain, your conversations, your data. Honest architecture, no invented reviews.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIBILITY.map((c) => (
            <blockquote key={c.title} className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-5">
              <div className="mb-3 flex gap-0.5" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                ))}
              </div>
              <p className="text-[13px] leading-[1.55] text-[var(--foreground)]">&ldquo;{c.body}&rdquo;</p>
              <footer className="mt-3.5 text-[13px] font-semibold">
                <strong>{c.title}</strong>
              </footer>
            </blockquote>
          ))}
        </div>
      </Band>

      <Band tone="dark" id="calendar">
        <div className="max-w-2xl">
          <SectionHeading>Calendar and bookings, same subscription</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Week views, booking pages, and mail share one Flap workspace, not three add-on silos.
          </p>
        </div>
        <ProductFrame title="Calendar · This week" dark>
          <div className="grid min-h-[180px] grid-cols-3 gap-2 p-4 md:grid-cols-5">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div
                key={d}
                className="min-h-[140px] rounded-[10px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface-raised)_80%,transparent)] px-2 py-2.5"
              >
                <span className="mb-2.5 block text-[11px] font-semibold tracking-[0.06em] text-[var(--foreground-faint)] uppercase">{d}</span>
                {d === "Tue" ? (
                  <div className="mt-1.5 rounded-lg border-l-[3px] border-[var(--cal-blue-border)] bg-[color-mix(in_srgb,var(--cal-blue-border)_22%,transparent)] px-2 py-2 text-[11px] font-semibold text-[var(--landing-dark-fg)]">
                    Demo call
                  </div>
                ) : null}
                {d === "Wed" ? (
                  <div className="mt-1.5 rounded-lg border-l-[3px] border-[var(--cal-green-border)] bg-[color-mix(in_srgb,var(--cal-green-border)_22%,transparent)] px-2 py-2 text-[11px] font-semibold text-[var(--landing-dark-fg)]">
                    Launch check
                  </div>
                ) : null}
                {d === "Thu" ? (
                  <div className="mt-1.5 rounded-lg border-l-[3px] border-[var(--cal-amber-border)] bg-[color-mix(in_srgb,var(--cal-amber-border)_22%,transparent)] px-2 py-2 text-[11px] font-semibold text-[var(--landing-dark-fg)]">
                    Booking open
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ProductFrame>
        <FeatureTrio items={CALENDAR_FEATURES} />
      </Band>

      <Band tone="light" id="newsletters">
        <div className="max-w-2xl">
          <SectionHeading>Newsletters from your domain</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Launch notes and product updates go out on the same custom-domain stack as hello@.
          </p>
        </div>
        <ProductFrame title="Newsletters · Drafts">
          <div className="mx-4 mt-3 mb-5 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            <div>
              <strong className="block text-sm">Ship week notes</strong>
              <p className="mt-0.5 mb-0 text-xs text-[var(--foreground-muted)]">From newsletter@yourdomain.com · Draft</p>
            </div>
            <Newspaper className="ml-auto h-4 w-4 text-[var(--foreground-faint)]" aria-hidden />
          </div>
        </ProductFrame>
        <FeatureTrio items={NEWSLETTER_FEATURES} />
      </Band>

      <Band tone="dark" id="ai">
        <div className="max-w-2xl">
          <SectionHeading>AI email assistant: confirm before send</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Summarize threads, draft replies in your voice, and approve every outbound message before it goes.
          </p>
        </div>
        <ProductFrame title="AI assistant" dark>
          <div className="flex flex-col gap-3 px-5 pt-4 pb-6">
            <div className="max-w-[85%] self-end rounded-[14px] bg-[var(--accent)] px-3.5 py-3 text-[13px] leading-normal text-[var(--accent-fg)]">
              Summarize unread support@ from today
            </div>
            <div className="max-w-[85%] self-start rounded-[14px] border border-[var(--line)] bg-[var(--surface-hover)] px-3.5 py-3 text-[13px] leading-normal">
              <Bot className="mb-2 h-4 w-4" aria-hidden />
              Three threads need a reply. Draft ready. Confirm to send.
            </div>
          </div>
        </ProductFrame>
        <FeatureTrio items={AI_FEATURES} />
      </Band>

      <Band tone="light" id="developers">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="max-w-xl">
              <SectionHeading>Transactional email API for developers</SectionHeading>
              <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
                Send transactional email with API keys, receive webhooks on mail.received, and use thin SDKs plus a CLI.
              </p>
            </div>
            <ul className="mt-8 space-y-3">
              {[
                `POST ${API_SEND.path} with Bearer API keys`,
                "Inbound webhooks with signature verification",
                "TypeScript & Python SDKs plus MCP confirm-before-send",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm text-[var(--foreground-muted)] md:text-[15px]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-8 rounded-full" onClick={() => go("/docs/api")}>
              Read API docs
              <ArrowRight />
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--landing-dark)] text-[var(--landing-dark-fg)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]">
            <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(255,255,255,0.08)] px-3 py-2.5">
              {(Object.keys(API_SAMPLES) as ApiTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "cursor-pointer rounded-full border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--landing-dark-muted)]",
                    apiTab === tab && "bg-[rgba(255,255,255,0.08)] text-[var(--landing-dark-fg)]",
                  )}
                  onClick={() => setApiTab(tab)}
                >
                  {tab === "typescript" ? "TypeScript" : tab === "python" ? "Python" : "cURL"}
                </button>
              ))}
              <button
                type="button"
                className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-[var(--landing-dark-muted)]"
                onClick={() => void copySample()}
                aria-label="Copy sample"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="m-0 overflow-x-auto px-[18px] pt-4 pb-5 font-[family-name:var(--font-mono)] text-xs leading-[1.55] whitespace-pre">
              {API_SAMPLES[apiTab]}
            </pre>
          </div>
        </div>
      </Band>

      <Band tone="light" id="capabilities">
        <div className="mb-10 max-w-2xl">
          <SectionHeading>Everything in one email subscription</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">{MARKETING.key_features.slice(0, 3).join(" · ")}.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-5">
              <div className="mb-3.5 grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-dim)] text-[var(--accent)]">
                <cap.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-base font-bold">{cap.title}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-[var(--foreground-muted)]">{cap.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="light" id="faq">
        <div className="mx-auto max-w-3xl">
          <SectionHeading className="mb-8">Questions</SectionHeading>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Band>

      <Band tone="compare" id="compare">
        <div className="mb-10 max-w-2xl">
          <SectionHeading>Compare Flap to Workspace and alternatives</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">Honest comparison pages for founders choosing custom-domain email hosting.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISON_LINKS.map((link) => (
            <a
              key={link.path}
              href={link.path}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-5 text-inherit no-underline transition-[border-color,background] duration-150 hover:border-[var(--line-strong)] hover:bg-[var(--surface)]"
              onClick={(e) => {
                e.preventDefault();
                go(link.path);
              }}
            >
              <strong className="text-[15px] font-bold">{link.label}</strong>
              <span className="text-[13px] leading-normal text-[var(--foreground-muted)]">{link.body}</span>
            </a>
          ))}
        </div>
        <p className="mt-8 text-sm text-[var(--foreground-muted)]">
          See all{" "}
          <a
            className="font-medium text-[var(--accent-text)] underline-offset-2 hover:underline"
            href="/vs"
            onClick={(e) => {
              e.preventDefault();
              go("/vs");
            }}
          >
            comparisons
          </a>{" "}
          and{" "}
          <a
            className="font-medium text-[var(--accent-text)] underline-offset-2 hover:underline"
            href="/for"
            onClick={(e) => {
              e.preventDefault();
              go("/for");
            }}
          >
            use cases
          </a>
          .
        </p>
      </Band>

      <Band tone="accent">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--accent-fg)]">
            Custom-domain email, set up in minutes
            <span className="text-[var(--accent-fg)]">.</span>
          </h2>
          <p className="mt-4 text-base text-[color-mix(in_srgb,var(--accent-fg)_80%,transparent)] md:text-lg">
            Add a domain, publish MX/SPF/DKIM, and receive your first email. Usually takes a few minutes. From ${PLANS.solo.price_monthly}/month. Free plan includes real mailboxes.
          </p>
          <Button
            size="pill"
            className="mt-8 h-11 rounded-full bg-[var(--surface)] px-8 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface)] hover:opacity-95"
            onClick={() => onPrimary("final_cta")}
          >
            {primaryLabel}
            <ArrowRight />
          </Button>
        </div>
      </Band>
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
