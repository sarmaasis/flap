import { useEffect, useState, type ReactNode } from "react";
import BrandMark from "./BrandMark";
import { Button } from "./ui/button";
import { go } from "../lib/nav";
import { track } from "../lib/analytics";
import { MARKETING, SITE_URL, SUPPORT_EMAIL } from "../content/marketing";
import { cn } from "../lib/utils";
import { tw } from "../lib/tw";

type Props = {
  children: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
};

const FOOTER_TOOLS = [
  { path: "/tools", label: "All tools" },
  { path: "/tools/mx-checker", label: "MX checker" },
  { path: "/tools/spf-checker", label: "SPF checker" },
  { path: "/tools/dmarc-checker", label: "DMARC checker" },
  { path: "/tools/dkim-checker", label: "DKIM checker" },
  { path: "/tools/header-analyzer", label: "Header analyzer" },
  { path: "/tools/deliverability-scorecard", label: "Scorecard" },
];

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/for", label: "Use cases" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/security", label: "Security" },
      { href: "/migrate", label: "Migrate" },
      { href: "/demo", label: "Demo" },
      { href: "/why-not-amazon-ses", label: "Why not SES?" },
      { href: "/about", label: "About" },
      { href: "/changelog", label: "Changelog" },
      { href: "/status", label: "Status" },
      { href: "/for", label: "Who it's for" },
      { href: "/vs", label: "Compare" },
    ],
  },
  {
    title: "Compare",
    links: [
      { href: "/vs/google-workspace", label: "vs Google Workspace" },
      { href: "/vs/shipmail", label: "vs Shipmail" },
      { href: "/vs/microsoft-365", label: "vs Microsoft 365" },
      { href: "/vs/zoho-mail", label: "vs Zoho Mail" },
      { href: "/vs/fastmail", label: "vs Fastmail" },
      { href: "/vs/cloudflare-email-routing", label: "vs CF Routing" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/docs", label: "Docs" },
      { href: "/docs/api", label: "API overview" },
      { href: "/docs/webhooks", label: "Webhooks" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/research", label: "Research" },
      { href: "/guides", label: "Guides" },
      { href: "/email-for-multiple-domains", label: "Multi-domain email" },
      { href: "/email-for-indie-hackers", label: "Indie hackers" },
      { href: "/email-for-founders", label: "Founders" },
      { href: "/email-for-multiple-saas-products", label: "Multi-SaaS email" },
      { href: "/how-to-manage-email-for-multiple-domains", label: "Manage multi-domain email" },
    ],
  },
  {
    title: "Tools",
    links: FOOTER_TOOLS.map((t) => ({ href: t.path, label: t.label })),
  },
  {
    title: "Account",
    links: [
      { href: "/signup", label: "Start free", trackSignup: true },
      { href: "/login", label: "Sign in" },
      { href: "/support", label: "Support" },
      { href: `mailto:${SUPPORT_EMAIL}`, label: "Email support", external: true },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;

function FooterLink({
  href,
  label,
  trackSignup,
  external,
}: {
  href: string;
  label: string;
  trackSignup?: boolean;
  external?: boolean;
}) {
  if (external) {
    return (
      <a href={href} className="text-[13px] text-[var(--landing-dark-muted)] no-underline hover:text-[var(--landing-dark-fg)]">
        {label}
      </a>
    );
  }
  return (
    <a
      href={href}
      className="text-[13px] text-[var(--landing-dark-muted)] no-underline hover:text-[var(--landing-dark-fg)]"
      onClick={(e) => {
        e.preventDefault();
        if (trackSignup) track("signup_clicked", { source: "footer" });
        go(href);
      }}
    >
      {label}
    </a>
  );
}

export default function MarketingShell({ children, primaryHref = "/signup", primaryLabel = "Get started" }: Props) {
  const [navOverDark, setNavOverDark] = useState(false);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-theme]"));
    if (!sections.length) {
      setNavOverDark(false);
      return;
    }

    const ratios = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        let best: { theme: string; ratio: number } | null = null;
        for (const el of sections) {
          const ratio = ratios.get(el) ?? 0;
          if (!best || ratio > best.ratio) {
            best = { theme: el.dataset.navTheme || "light", ratio };
          }
        }
        setNavOverDark(Boolean(best && best.ratio > 0.2 && best.theme === "dark"));
      },
      { root: null, threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1], rootMargin: "-72px 0px -55% 0px" },
    );

    for (const el of sections) observer.observe(el);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="marketing-light min-h-screen overflow-x-clip bg-[var(--surface)] text-[var(--foreground)]">
      <a className={tw.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className="pointer-events-none fixed top-6 right-0 left-0 z-40 flex justify-center bg-transparent px-4">
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-[1152px] min-h-14 items-center justify-between gap-3 rounded-full border px-[18px] py-2 shadow-[0_8px_28px_rgba(20,18,17,0.06)] backdrop-blur-[12px] backdrop-saturate-150",
            navOverDark
              ? "border-[var(--landing-nav-border-dark)] bg-[var(--landing-nav-bg-dark)] text-[var(--landing-dark-fg)] shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
              : "border-[var(--landing-nav-border)] bg-[var(--landing-nav-bg)]",
          )}
        >
          <a
            href="/"
            className={cn(
              "flex items-center gap-2 text-[15px] font-semibold tracking-tight no-underline",
              tw.brand,
              navOverDark ? "text-[var(--landing-dark-fg)]" : "text-[#141211]",
            )}
            onClick={(e) => {
              e.preventDefault();
              go("/");
            }}
          >
            <BrandMark />
            flap
          </a>
          <nav className="hidden items-center gap-0.5 min-[900px]:inline-flex" aria-label="Primary">
            {[...NAV_LINKS, { href: "/login", label: "Sign in" }].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium no-underline transition-colors duration-150",
                  navOverDark
                    ? "text-[var(--landing-dark-muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--landing-dark-fg)]"
                    : "text-[#64615a] hover:bg-[rgba(20,18,17,0.05)] hover:text-[#141211]",
                )}
                onClick={(e) => {
                  e.preventDefault();
                  go(link.href);
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <details className="relative ml-auto text-sm min-[900px]:hidden">
            <summary className={cn("cursor-pointer list-none p-2 [&::-webkit-details-marker]:hidden", navOverDark ? "text-[var(--landing-dark-fg)]" : "text-[#141211]")}>
              Menu
            </summary>
            <nav
              aria-label="Mobile navigation"
              className={cn(
                "absolute top-[calc(100%+10px)] right-0 z-50 min-w-[200px] rounded-xl border p-3 shadow-[var(--shadow)]",
                navOverDark
                  ? "border-[var(--landing-dark-line)] bg-[var(--landing-dark-raised)]"
                  : "border-[var(--line)] bg-[var(--surface-overlay)]",
              )}
            >
              {[...NAV_LINKS, { href: "/login", label: "Sign in" }].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block rounded-lg px-2.5 py-2.5 text-sm font-medium no-underline",
                    navOverDark
                      ? "text-[var(--landing-dark-muted)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--landing-dark-fg)]"
                      : "text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    go(link.href);
                  }}
                >
                  {link.label}
                </a>
              ))}
              <a
                href={primaryHref}
                className="mt-3 block rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--accent-fg)] no-underline hover:opacity-90"
                onClick={(e) => {
                  e.preventDefault();
                  track("signup_clicked", { source: "mobile_nav" });
                  go(primaryHref);
                }}
              >
                {primaryLabel}
              </a>
            </nav>
          </details>
          <div className="flex items-center gap-2">
            <Button
              size="pill"
              variant={navOverDark ? "inverse" : "primary"}
              className={cn(
                "hidden sm:inline-flex",
                navOverDark
                  ? "bg-[var(--surface)] text-[var(--landing-dark)] hover:opacity-90"
                  : "rounded-full px-5 font-semibold",
              )}
              asChild
            >
              <a
                href={primaryHref}
                onClick={(e) => {
                  e.preventDefault();
                  track("signup_clicked", { source: "nav" });
                  go(primaryHref);
                }}
              >
                {primaryLabel}
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="[&:has(.landing-hero-band)]:pt-0 pt-[104px]">
        {children}
      </main>

      <footer className="relative overflow-hidden bg-[var(--landing-dark)] pt-[72px] text-[var(--landing-dark-muted)]" data-nav-theme="dark">
        <div className="relative z-1 mx-auto max-w-[1152px] px-5 pb-7 md:px-8 md:pb-8">
          <div
            className="pointer-events-none absolute bottom-[-0.18em] left-1/2 z-0 -translate-x-1/2 select-none text-[clamp(96px,22vw,220px)] font-extrabold leading-[0.8] tracking-[-0.06em] text-transparent [-webkit-text-stroke:1px_rgba(250,249,246,0.04)]"
            aria-hidden
          >
            flap
          </div>
          <div className="mb-10 max-w-[360px]">
            <div className={cn(tw.brand, "mb-3 gap-2 text-[var(--landing-dark-fg)]")}>
              <BrandMark /> flap
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--landing-dark-muted)]">
              {MARKETING.short_description}
            </p>
            <a
              href="/status"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--landing-dark-line)] px-3 py-1.5 text-[13px] text-[var(--landing-dark-fg)] no-underline"
              onClick={(e) => {
                e.preventDefault();
                go("/status");
              }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34d399]" aria-hidden />
              All systems operational
            </a>
          </div>
          <div className="grid grid-cols-1 gap-7 min-[480px]:grid-cols-2 min-[900px]:grid-cols-5 min-[900px]:gap-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-2.5 text-left min-[900px]:text-right">
                <span className="mb-1 text-[11px] font-semibold tracking-[0.1em] text-[var(--landing-dark-fg)] uppercase">
                  {col.title}
                </span>
                {col.links.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--landing-dark-line)] pt-5 text-[12px]">
            <p>
              © {new Date().getFullYear()} Flap · {SITE_URL.replace("https://", "")}
            </p>
            <div className="flex gap-4">
              <a href="/llms.txt" className="text-[var(--landing-dark-muted)] no-underline hover:text-[var(--landing-dark-fg)]">llms.txt</a>
              <a
                href="/blog"
                className="text-[var(--landing-dark-muted)] no-underline hover:text-[var(--landing-dark-fg)]"
                onClick={(e) => {
                  e.preventDefault();
                  go("/blog");
                }}
              >
                Blog
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
