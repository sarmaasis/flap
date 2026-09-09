import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  Inbox,
  Lock,
  Mail,
  Users,
  Zap,
} from "lucide-react";
import MarketingShell from "../components/MarketingShell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Button } from "../components/ui/button";
import { CREDIBILITY, MARKETING, SITE_URL } from "../content/marketing";
import { FOR_PAGES as HUB_FOR, VS_PAGES } from "../content/hubs";
import { api } from "../lib/api";
import { track, trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import { captureReferralFromUrl, faqPageLd, setJsonLd, setPageMeta } from "../lib/seo";
import { PLANS } from "../../shared/plans";
import { FOUNDER } from "../../shared/product-facts";
import { cn } from "../lib/utils";

const HERO_ADDRESSES = [
  "hello@product1.example",
  "support@product2.example",
  "billing@agency.example",
];

const HOW_STEPS = [
  { step: "1", title: "Add domain", body: "Enter the domain you already own. Flap provisions mail identity for it." },
  { step: "2", title: "Add DNS", body: "Publish the MX, SPF, and DKIM records Flap shows — at any registrar." },
  { step: "3", title: "Verify", body: "Click Check DNS. Precise errors when something is wrong; no vague failures." },
  { step: "4", title: "Receive & send", body: "Create hello@ / support@, then mail yourself to confirm the loop." },
];

const INBOX_ROWS = [
  { domain: "product-one.com", name: "Stripe", subject: "Invoice issue", addr: "support@product-one.com" },
  { domain: "agency.co", name: "John Smith", subject: "New project inquiry", addr: "hello@agency.co" },
  { domain: "product-two.dev", name: "Sarah", subject: "Support request", addr: "support@product-two.dev" },
];

const STATS = [
  {
    value: String(PLANS.solo.price_monthly),
    suffix: "$",
    prefix: true,
    label: "Solo starts",
    body: `${PLANS.solo.limits.mailboxes} mailboxes · up to ${PLANS.solo.limits.domains} domains.`,
  },
  {
    value: String(PLANS.solo.limits.domains),
    suffix: "",
    label: "Domains on paid plans",
    body: "Mailbox count and seats are the upgrade dial — not another Workspace per launch.",
  },
  {
    value: "1",
    suffix: "",
    label: "Inbox",
    body: "Every connected domain lands in one place with readable identity.",
  },
  {
    value: "0",
    suffix: "",
    label: "Ads or scanning",
    body: MARKETING.architecture_line,
  },
];

const ADJACENT = [
  {
    icon: Mail,
    title: "Transactional API",
    body: "Once a domain is connected, send via API keys, webhooks, and thin SDKs.",
  },
  {
    icon: Inbox,
    title: "Newsletters & bookings",
    body: "Launch notes and booking pages on the same custom-domain stack as hello@.",
  },
  {
    icon: Zap,
    title: "AI drafts (confirm first)",
    body: "Summarize and draft in-product. Flap never silently sends.",
  },
  {
    icon: Users,
    title: "Teams when you need them",
    body: "Pro and Team add seats and shared mailboxes. Free and Solo stay founder-friendly.",
  },
  {
    icon: Lock,
    title: "Export & leave",
    body: "JSON backup and .mbox downloads anytime. Being easy to leave is a trust feature.",
  },
];

const FAQS = [
  {
    q: "Can I use multiple domains in one inbox?",
    a: `Yes. Free includes ${PLANS.free.limits.domains} domains to prove MX. Solo, Pro, Team, and Scale each include up to ${PLANS.solo.limits.domains} custom domains in one Flap inbox. Filter by domain or mailbox when you need focus.`,
  },
  {
    q: "When I reply, which email address does Flap send from?",
    a: "Reply uses the mailbox that received the message (the inbound recipient). Compose shows that From address before you send. You can change it; the change does not silently stick to unrelated threads.",
  },
  {
    q: "Does Flap replace Google Workspace?",
    a: "For custom-domain email across many projects, yes — that is the core job. Flap is not a Docs/Drive/Meet suite. If you need full Google collaboration tools, keep Workspace for that and use Flap for multi-domain mail.",
  },
  {
    q: "Can I bring an existing domain?",
    a: "Yes. Keep DNS at Cloudflare, Namecheap, Porkbun, GoDaddy, Route 53, Vercel, or anywhere else. Add the domain in Flap, publish the records shown, then verify.",
  },
  {
    q: "Will changing MX records affect my website?",
    a: "No. MX only controls where email is delivered. Your website A/AAAA/CNAME records are separate. Change MX only when you are ready for Flap to receive mail for that domain.",
  },
  {
    q: "Can I migrate my old email?",
    a: "Flap does not auto-import IMAP or full mailboxes today. Export from your old provider if needed, switch MX after you verify the domain and test send/receive, and use Settings for ongoing .mbox / JSON export. See /migrate for the cutover narrative.",
  },
  {
    q: "Can I export my email if I leave?",
    a: "Yes. Settings includes JSON workspace backup and per-mailbox .mbox download. Paid accounts keep an export window after cancel. No lock-in.",
  },
  {
    q: "Does Flap use Amazon SES?",
    a: "Yes. Customer mail (inbound and outbound) runs on Amazon SES. The Flap app runs on Cloudflare. Your DNS stays at any registrar.",
  },
  {
    q: "Why wouldn't I use SES directly?",
    a: "SES is the mail pipe. Flap is the product layer: domain onboarding, mailboxes, inbox UI, threading, correct reply-from identity, aliases, shared workflows, and an application API. See /why-not-amazon-ses.",
  },
  {
    q: "Can teammates access individual mailboxes?",
    a: "Pro adds up to 5 seats. Team unlocks many seats plus shared mailboxes (e.g. support@, hello@). Free and Solo are designed for solo founders.",
  },
  {
    q: "Can I use Flap for transactional email?",
    a: "Yes on Solo and above: API keys, POST /api/v1/send, webhooks, and TypeScript/Python SDKs. Same verified domains as your inbox.",
  },
  {
    q: "Does Flap support newsletters?",
    a: "Yes on paid plans, with plan caps for intentional launches — not cold outbound. Sends use your connected custom domains.",
  },
  {
    q: "What happens if DNS verification fails?",
    a: "Flap shows which record failed and why (wrong value, conflicting MX, missing DKIM, and similar). Fix at your DNS host, wait for propagation, then Check DNS again.",
  },
  {
    q: "Does Flap support IMAP and SMTP?",
    a: "Not yet. Use the web app and PWA. IMAP/SMTP client access is planned but not available.",
  },
];

const COMPARISON_LINKS = [
  ...VS_PAGES.slice(0, 4).map((p) => ({ path: p.path, label: p.h1, body: p.description })),
  ...HUB_FOR.slice(0, 2).map((p) => ({ path: p.path, label: p.h1, body: p.description })),
];

const PLAN_TEASERS = [
  {
    id: "solo",
    who: "Solo founder",
    why: "Up to 50 domains, 3 mailboxes, API included — capacity without a suite per project.",
  },
  {
    id: "pro",
    who: "Small team",
    why: "More mailboxes, up to 5 seats, shared inboxes when support@ needs a team.",
  },
  {
    id: "team",
    who: "Studio / agency",
    why: "Higher mailbox and seat capacity for client domains in one account.",
  },
] as const;

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
  const heroCta = primaryLabel;

  const onPrimary = (source: string) => {
    track("signup_clicked", { source });
    track("cta_connect_domain", { source });
    go(primaryHref);
  };

  return (
    <MarketingShell primaryHref={primaryHref} primaryLabel={auth === "guest" || auth === "loading" ? "Get started" : primaryLabel}>
      {/* §1 Hero */}
      <Band tone="light" className="pt-[120px] md:pt-[148px] landing-hero-band">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-[var(--foreground-muted)]">
              Multi-domain email for founders
            </p>
            <h1 className="mt-4 max-w-[18ch] text-[clamp(40px,5vw,56px)] font-extrabold leading-[1.05] tracking-[-1.4px] text-[var(--foreground)]">
              One inbox for every{" "}
              <span className="inline box-decoration-clone rounded-[0.15em] bg-[rgba(var(--accent-rgb),0.18)] px-[0.12em] py-[0.04em] font-[family-name:var(--font-serif)] font-normal italic">
                product you build
              </span>
              <AccentPeriod />
            </h1>
            <p className="mt-6 max-w-[520px] text-lg leading-[1.6] text-[var(--foreground-muted)]">
              {MARKETING.hero_subheadline}
            </p>
            <p className="mt-3 max-w-[520px] text-sm font-medium text-[var(--foreground)]">{MARKETING.secondary_line}</p>
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
              <Button
                size="pill"
                variant="outline"
                className="h-11 rounded-full px-6 text-sm font-semibold"
                asChild
              >
                <a
                  href="/demo"
                  onClick={(e) => {
                    e.preventDefault();
                    go("/demo");
                  }}
                >
                  Try interactive demo
                </a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-[var(--foreground-muted)]">
              Free plan includes real mailboxes. From ${PLANS.solo.price_monthly}/mo · up to {PLANS.solo.limits.domains}{" "}
              domains on paid plans.
            </p>
          </div>

          <div className="relative" aria-label="Many domains into one inbox with correct reply identity">
            <div
              className="pointer-events-none absolute top-[8%] right-[-8%] bottom-[-12%] left-[-8%] bg-[radial-gradient(circle_at_50%_40%,rgba(var(--accent-rgb),0.16),transparent_65%)] blur-[28px]"
              aria-hidden
            />
            <div className="relative flex flex-col gap-3">
              {HERO_ADDRESSES.map((addr) => (
                <div
                  key={addr}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 font-[family-name:var(--font-mono)] text-sm font-semibold shadow-[var(--shadow)]"
                >
                  {addr}
                </div>
              ))}
              <div className="flex items-center justify-center py-1 text-xs font-semibold tracking-[0.14em] text-[var(--foreground-muted)] uppercase">
                ↓ One inbox
              </div>
              <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[var(--landing-dark)] px-4 py-4 text-[var(--landing-dark-fg)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)]">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--landing-dark-muted)] uppercase">
                  Reply to support@product2.example
                </p>
                <p className="mt-2 text-sm font-semibold">
                  From <span className="text-[var(--accent)]">support@product2.example</span>
                  <span className="ml-2 text-[var(--success-text)]">✓</span>
                </p>
                <p className="mt-1.5 text-xs text-[var(--landing-dark-muted)]">
                  Automatically selected from the address that received the message.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Band>

      <Band tone="light" className="!py-12 md:!py-16">
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

      {/* §2 Problem */}
      <Band tone="dark" id="problem">
        <div className="max-w-2xl">
          <SectionHeading>Five domains shouldn&apos;t mean five inboxes</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Portfolio founders and studios accumulate domains faster than headcount. A Workspace (or similar) seat per
            launch is the wrong unit of cost — and forwarding into personal Gmail breaks brand identity on reply.
          </p>
        </div>
      </Band>

      {/* §3 Signature workflow */}
      <Band tone="light" id="reply-from">
        <div className="max-w-2xl">
          <SectionHeading>Reply from the address that received the mail</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Customers email support@product-a.com. Flap selects that mailbox as From when you reply — so you do not
            answer Product A as Product B.
          </p>
        </div>
        <ProductFrame title="Compose · Reply">
          <div className="space-y-3 px-5 py-5">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--foreground-faint)] uppercase">
                Incoming
              </p>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-sm font-semibold">To: support@product-a.com</p>
            </div>
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] px-4 py-3 shadow-[inset_3px_0_var(--accent)]">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--foreground-faint)] uppercase">
                Sending as
              </p>
              <p className="mt-1 text-sm font-semibold">
                Ashish &lt;support@product-a.com&gt; <span className="text-[var(--success-text)]">✓</span>
              </p>
              <p className="mt-1 text-xs text-[var(--foreground-muted)]">
                Automatically selected because this message was sent to support@product-a.com. Change anytime for this
                reply.
              </p>
            </div>
          </div>
        </ProductFrame>
      </Band>

      {/* §4 How it works */}
      <Band tone="dark" id="how-it-works">
        <div className="max-w-2xl">
          <SectionHeading>Connect a domain in minutes</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Flap is the product. Amazon SES is the mail pipe — you never have to treat SES as the user-facing setup
            experience.
          </p>
        </div>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s) => (
            <li key={s.step} className="list-none">
              <span className="font-[family-name:var(--font-mono)] text-xs font-bold text-[var(--accent)]">{s.step}</span>
              <h3 className="mt-2 text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-[var(--foreground-muted)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </Band>

      {/* §5 Portfolio inbox */}
      <Band tone="light" id="inbox">
        <div className="max-w-2xl">
          <SectionHeading>One inbox. Domain context stays visible</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Domain labels and mailbox filters keep every project readable — not just colored avatars.
          </p>
        </div>
        <ProductFrame title="Inbox · All domains">
          <div className="py-2 pb-3">
            {INBOX_ROWS.map((row) => (
              <div key={row.addr} className="grid gap-1 border-b border-[var(--line)] px-5 py-3.5 md:grid-cols-[140px_1fr]">
                <span className="font-[family-name:var(--font-mono)] text-[11px] font-semibold text-[var(--accent-text)]">
                  [{row.domain}]
                </span>
                <div>
                  <strong className="text-[13px] font-semibold">{row.name}</strong>
                  <span className="mt-0.5 block text-[13px]">{row.subject}</span>
                  <em className="font-[family-name:var(--font-mono)] text-[11px] not-italic text-[var(--foreground-faint)]">
                    {row.addr}
                  </em>
                </div>
              </div>
            ))}
          </div>
        </ProductFrame>
      </Band>

      {/* §6–7 Use cases */}
      <Band tone="compare" id="who">
        <div className="mb-10 max-w-2xl">
          <SectionHeading>Built for portfolio founders and agencies</SectionHeading>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-6">
            <h3 className="text-lg font-bold">Founders with side projects</h3>
            <p className="mt-3 text-sm leading-[1.55] text-[var(--foreground-muted)]">
              Multiple SaaS domains, one operational email home. Launch another product without another email
              subscription.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-6">
            <h3 className="text-lg font-bold">Agencies & studios</h3>
            <p className="mt-3 text-sm leading-[1.55] text-[var(--foreground-muted)]">
              Client domains and shared support@ in one account when you grow into Pro or Team — without a suite seat
              tax per client.
            </p>
          </div>
        </div>
      </Band>

      {/* §8 More than webmail (secondary) */}
      <Band tone="light" id="more">
        <div className="mb-10 max-w-2xl">
          <SectionHeading>Once domains are connected</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Adjacent tools reinforce the inbox — they are not the headline. Transactional mail, newsletters, bookings,
            calendar, automation, and AI drafts sit on the same verified domains.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ADJACENT.map((cap) => (
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

      {/* §9 Pricing clarity */}
      <Band tone="dark" id="pricing">
        <div className="mb-10 max-w-2xl">
          <SectionHeading>Upgrade for capacity, not a different product</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Every paid plan includes up to {PLANS.solo.limits.domains} domains. You upgrade for mailboxes, seats, and
            send volume — the reason is unmistakable.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_TEASERS.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[var(--landing-dark-line)] bg-[var(--landing-dark-raised)] px-5 py-5">
              <p className="text-xs font-semibold tracking-[0.1em] text-[var(--accent)] uppercase">{PLANS[p.id].name}</p>
              <h3 className="mt-2 text-base font-bold">{p.who}</h3>
              <p className="mt-2 text-sm leading-[1.55] text-[var(--foreground-muted)]">{p.why}</p>
              <p className="mt-4 text-2xl font-extrabold">
                ${PLANS[p.id].price_monthly}
                <span className="text-sm font-normal text-[var(--foreground-muted)]">/mo</span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            className="rounded-full"
            onClick={() => {
              track("content_to_pricing", { source: "landing_pricing" });
              go("/pricing");
            }}
          >
            See full pricing
            <ArrowRight />
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-[var(--landing-dark-line)] bg-transparent text-[var(--landing-dark-fg)] hover:bg-[var(--landing-dark-raised)]"
            onClick={() => go("/tools/google-workspace-cost-calculator")}
          >
            Workspace cost calculator
          </Button>
          <Button
            variant="outline"
            className="rounded-full border-[var(--landing-dark-line)] bg-transparent text-[var(--landing-dark-fg)] hover:bg-[var(--landing-dark-raised)]"
            onClick={() => go("/migrate")}
          >
            Migration guide
          </Button>
        </div>
      </Band>

      {/* §10 Trust */}
      <Band tone="light" id="trust">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold tracking-[1.2px] text-[var(--accent)] uppercase">Trust</p>
          <SectionHeading>Architecture you can verify</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Flap provides custom-domain business email for founders, agencies, and teams managing domains they own or
            are authorized to operate. Every sending domain must be verified. Honest infrastructure — no invented
            reviews or fake metrics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {CREDIBILITY.slice(0, 3).map((c) => (
            <div key={c.title} className="rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-[22px] py-5">
              <h3 className="text-[15px] font-bold">{c.title}</h3>
              <p className="mt-2 text-[13px] leading-[1.55] text-[var(--foreground-muted)]">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {[
            { href: "/security", label: "Security" },
            { href: "/status", label: "Status" },
            { href: "/docs", label: "Docs" },
            { href: "/about", label: "About" },
            { href: "/why-not-amazon-ses", label: "Why not SES alone?" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
            { href: "/acceptable-use", label: "Acceptable Use" },
            { href: "/abuse", label: "Abuse" },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-medium text-[var(--accent-text)] underline-offset-2 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                go(l.href);
              }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </Band>

      {/* Founder */}
      <Band tone="compare" id="founder">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[1.2px] text-[var(--accent)] uppercase">Founder</p>
          <h2 className="mt-3 text-[clamp(28px,3.5vw,40px)] font-extrabold tracking-[-0.03em]">
            Built by {FOUNDER.name}
            <AccentPeriod />
          </h2>
          <p className="mt-4 text-base leading-[1.6] text-[var(--foreground-muted)]">
            Flap exists because serial founders accumulate domains faster than headcount. Support and security reports go
            to the same operator — not a faceless ticket queue.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" className="rounded-full" onClick={() => go("/about")}>
              About Flap
            </Button>
            <a
              className="text-sm font-medium text-[var(--accent-text)] underline-offset-2 hover:underline"
              href={FOUNDER.xUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{FOUNDER.xHandle} on X
            </a>
          </div>
        </div>
      </Band>

      {/* §11 FAQ */}
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
          <SectionHeading>Compare Flap honestly</SectionHeading>
          <p className="mt-5 max-w-[540px] text-base leading-[1.6] text-[var(--foreground-muted)] md:text-lg">
            Comparison pages for founders choosing custom-domain email — no fabricated competitor prices.
          </p>
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
      </Band>

      {/* Final CTA */}
      <Band tone="accent">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--accent-fg)]">
            Connect your first domain
            <span className="text-[var(--accent-fg)]">.</span>
          </h2>
          <p className="mt-4 text-base text-[color-mix(in_srgb,var(--accent-fg)_80%,transparent)] md:text-lg">
            Add a domain, publish DNS, verify, and receive your first email. Free includes real mailboxes.
          </p>
          <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2 text-left text-sm text-[color-mix(in_srgb,var(--accent-fg)_85%,transparent)]">
            {[
              "Many domains → one inbox",
              "Replies use the receiving address",
              "No separate email account per project",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
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
