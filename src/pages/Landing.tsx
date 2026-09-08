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
    body: "Events live next to mail — not a separate suite you forget to open.",
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
    body: "Plan limits keep volume honest — built for launches, not cold outbound.",
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
    body: "List domains and draft with confirm — tools built for agent workflows.",
  },
];

const CAPABILITIES = [
  {
    icon: Mail,
    title: "Works with any client",
    body: "Webmail first. Keep your DNS at any registrar — Flap gives you the MX/SPF/DKIM to publish.",
  },
  {
    icon: Calendar,
    title: "CalDAV & CardDAV ready",
    body: "Calendars, bookings, and contacts sit beside mail so scheduling is not a bolt-on.",
  },
  {
    icon: Inbox,
    title: "Storage that scales with you",
    body: "Mailbox and send caps grow with Solo, Pro, Team, and Scale — not a surprise seat tax.",
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
    <h2 className={cn("landing-h2", className)}>
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
        "landing-band",
        tone === "dark" && "landing-band-dark",
        tone === "compare" && "landing-band-compare",
        tone === "accent" && "landing-band-accent",
        className,
      )}
    >
      <div className="landing-grain" aria-hidden />
      <div className="landing-container">{children}</div>
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
    <div className={cn("landing-product-frame", dark && "landing-product-frame-dark")}>
      <div className="landing-product-frame-bar">
        <span />
        <span />
        <span />
        <em>{title}</em>
      </div>
      {children}
    </div>
  );
}

function FeatureTrio({ items }: { items: Array<{ title: string; body: string }> }) {
  return (
    <div className="mt-12 grid gap-6 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="landing-feature-card">
          <h3>{item.title}</h3>
          <p>{item.body}</p>
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
      <Band tone="light" className="landing-hero-band">
        <div className="landing-hero grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="landing-hero-copy">
            <p className="flap-eyebrow">A little less switching. A lot more focus.</p>
            <h1 className="landing-h1">
              <span className="landing-hero-mark">Every project</span>
              <br />
              One calm inbox
              <AccentPeriod />
            </h1>
            <p className="landing-lede">
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
              <span className="landing-rating-chip">
                <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" aria-hidden />
                Free includes real mailboxes
              </span>
            </div>
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">
              Start with real mailboxes for free. Add room as your projects grow.
            </p>
          </div>

          <div className="landing-stage" aria-label="Example of Flap mailboxes and API">
            <div className="landing-stage-glow" aria-hidden />
            <div className="landing-stack">
              {MAILBOX_CARDS.map((card) => (
                <div className="landing-stack-card" key={card.address}>
                  <span className="landing-stack-avatar">{card.initials}</span>
                  <div>
                    <strong>{card.address}</strong>
                    <small>Mailbox on your domain</small>
                  </div>
                  <span className={cn("landing-badge", card.tone)}>{card.role}</span>
                </div>
              ))}
              <div className="landing-code">
                <div className="landing-code-meta">
                  <Terminal className="h-3.5 w-3.5" aria-hidden />
                  <span>POST {API_SEND.path}</span>
                </div>
                <pre>{`{
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
        <div className="landing-stats">
          {STATS.map((s) => (
            <div key={s.label}>
              <strong>
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
              <span>{s.label}</span>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="dark" id="features">
        <div className="landing-section-head max-w-2xl">
          <SectionHeading>All your email in one place</SectionHeading>
          <p className="landing-section-lede">{MARKETING.architecture_line}</p>
        </div>
        <ProductFrame title="Inbox · All domains" dark>
          <div className="landing-mock-inbox">
            {[
              { name: "Alex Chen", subject: "The next chapter starts here", addr: "hello@studio.example", unread: true },
              { name: "Jamie Lee", subject: "A small update. A big milestone.", addr: "team@launch.example", unread: true },
              { name: "Morgan Reed", subject: "Thanks for the quick reply", addr: "support@studio.example", unread: false },
            ].map((row) => (
              <div key={row.addr} className={cn("landing-mock-row", row.unread && "unread")}>
                <strong>{row.name}</strong>
                <span>{row.subject}</span>
                <em>{row.addr}</em>
              </div>
            ))}
          </div>
        </ProductFrame>
        <FeatureTrio items={INBOX_FEATURES} />
      </Band>

      <Band tone="light" id="proof">
        <div className="landing-section-head mb-10 max-w-2xl">
          <p className="landing-eyebrow-accent">Built to be trusted</p>
          <SectionHeading>Know what goes into your email</SectionHeading>
          <p className="landing-section-lede">
            Your domain, your conversations, your choice — credibility before invented reviews.
          </p>
        </div>
        <div className="landing-testimonial-grid">
          {CREDIBILITY.map((c) => (
            <blockquote key={c.title} className="landing-quote-card">
              <div className="landing-stars" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />
                ))}
              </div>
              <p>&ldquo;{c.body}&rdquo;</p>
              <footer>
                <strong>{c.title}</strong>
              </footer>
            </blockquote>
          ))}
        </div>
      </Band>

      <Band tone="dark" id="calendar">
        <div className="landing-section-head max-w-2xl">
          <SectionHeading>Calendar and bookings, same subscription</SectionHeading>
          <p className="landing-section-lede">
            Week views, booking pages, and mail share one Flap workspace — not three add-on silos.
          </p>
        </div>
        <ProductFrame title="Calendar · This week" dark>
          <div className="landing-mock-cal">
            {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d) => (
              <div key={d} className="landing-mock-cal-col">
                <span>{d}</span>
                {d === "Tue" ? <div className="landing-cal-event blue">Demo call</div> : null}
                {d === "Wed" ? <div className="landing-cal-event green">Launch check</div> : null}
                {d === "Thu" ? <div className="landing-cal-event amber">Booking open</div> : null}
              </div>
            ))}
          </div>
        </ProductFrame>
        <FeatureTrio items={CALENDAR_FEATURES} />
      </Band>

      <Band tone="light" id="newsletters">
        <div className="landing-section-head max-w-2xl">
          <SectionHeading>Newsletters from your domain</SectionHeading>
          <p className="landing-section-lede">
            Launch notes and product updates go out on the same custom-domain stack as hello@.
          </p>
        </div>
        <ProductFrame title="Newsletters · Drafts">
          <div className="landing-mock-newsletter">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden />
            <div>
              <strong>Ship week notes</strong>
              <p>From newsletter@yourdomain.com · Draft</p>
            </div>
            <Newspaper className="ml-auto h-4 w-4 text-[var(--foreground-faint)]" aria-hidden />
          </div>
        </ProductFrame>
        <FeatureTrio items={NEWSLETTER_FEATURES} />
      </Band>

      <Band tone="dark" id="ai">
        <div className="landing-section-head max-w-2xl">
          <SectionHeading>AI that waits for your OK</SectionHeading>
          <p className="landing-section-lede">
            Ask your inbox, draft in your voice, and confirm before anything sends.
          </p>
        </div>
        <ProductFrame title="AI assistant" dark>
          <div className="landing-mock-ai">
            <div className="landing-mock-ai-bubble user">Summarize unread support@ from today</div>
            <div className="landing-mock-ai-bubble bot">
              <Bot className="mb-2 h-4 w-4" aria-hidden />
              Three threads need a reply. Draft ready — confirm to send.
            </div>
          </div>
        </ProductFrame>
        <FeatureTrio items={AI_FEATURES} />
      </Band>

      <Band tone="light" id="developers">
        <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="landing-section-head max-w-xl">
              <SectionHeading>Built for developers</SectionHeading>
              <p className="landing-section-lede">
                Send transactional mail with API keys, react to mail.received, and use thin SDKs plus a CLI.
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
          <div className="landing-code-card">
            <div className="landing-code-tabs">
              {(Object.keys(API_SAMPLES) as ApiTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(apiTab === tab && "active")}
                  onClick={() => setApiTab(tab)}
                >
                  {tab === "typescript" ? "TypeScript" : tab === "python" ? "Python" : "cURL"}
                </button>
              ))}
              <button type="button" className="landing-copy-btn" onClick={() => void copySample()} aria-label="Copy sample">
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre>{API_SAMPLES[apiTab]}</pre>
          </div>
        </div>
      </Band>

      <Band tone="light" id="capabilities">
        <div className="landing-section-head mb-10 max-w-2xl">
          <SectionHeading>Everything in one stack</SectionHeading>
          <p className="landing-section-lede">{MARKETING.key_features.slice(0, 3).join(" · ")}.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className="landing-cap-card">
              <div className="landing-cap-icon">
                <cap.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3>{cap.title}</h3>
              <p>{cap.body}</p>
            </div>
          ))}
        </div>
      </Band>

      <Band tone="light" id="faq">
        <div className="mx-auto max-w-3xl">
          <SectionHeading className="mb-8">Questions</SectionHeading>
          <Accordion type="single" collapsible className="w-full landing-faq">
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
        <div className="landing-section-head mb-10 max-w-2xl">
          <SectionHeading>Compare and find your fit</SectionHeading>
          <p className="landing-section-lede">Honest /vs and /for pages for founders choosing multi-domain email.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISON_LINKS.map((link) => (
            <a
              key={link.path}
              href={link.path}
              className="landing-compare-card"
              onClick={(e) => {
                e.preventDefault();
                go(link.path);
              }}
            >
              <strong>{link.label}</strong>
              <span>{link.body}</span>
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

      <Band tone="accent" className="landing-final-cta">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="landing-cta-h2">
            Your email, set up in minutes
            <span className="text-[var(--accent-fg)]">.</span>
          </h2>
          <p className="mt-4 text-base text-[color-mix(in_srgb,var(--accent-fg)_80%,transparent)] md:text-lg">
            First receive usually takes a few minutes depending on DNS. From ${PLANS.solo.price_monthly}/month. Free
            includes real mailboxes.
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
