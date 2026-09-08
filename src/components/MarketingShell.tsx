import { useEffect, useState, type ReactNode } from "react";
import BrandMark from "./BrandMark";
import { Button } from "./ui/button";
import { go } from "../lib/nav";
import { track } from "../lib/analytics";
import { MARKETING, SITE_URL, SUPPORT_EMAIL } from "../content/marketing";
import { cn } from "../lib/utils";

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
      { href: "/about", label: "About" },
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
      { href: "/email-for-indie-hackers", label: "Indie hackers" },
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
    return <a href={href}>{label}</a>;
  }
  return (
    <a
      href={href}
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
    <div className="landing-root min-h-screen overflow-x-clip">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <div className={cn("landing-nav-bar", navOverDark && "landing-nav-bar-dark")}>
          <a
            href="/"
            className="brand flex items-center gap-2 text-[15px] font-semibold tracking-tight"
            onClick={(e) => {
              e.preventDefault();
              go("/");
            }}
          >
            <BrandMark />
            flap
          </a>
          <nav className="landing-nav-links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  go(link.href);
                }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                go("/login");
              }}
            >
              Sign in
            </a>
          </nav>
          <details className="marketing-mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Mobile navigation">
              {[...NAV_LINKS, { href: "/login", label: "Sign in" }].map((link) => (
                <a key={link.href} href={link.href}>
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

      <main id="main-content" className="landing-main">
        {children}
      </main>

      <footer className="landing-footer" data-nav-theme="dark">
        <div className="landing-footer-inner">
          <div className="landing-footer-watermark" aria-hidden>
            flap
          </div>
          <div className="landing-footer-brand">
            <div className="brand mb-3 flex items-center gap-2 text-[var(--landing-dark-fg)]">
              <BrandMark /> flap
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--landing-dark-muted)]">
              {MARKETING.short_description}
            </p>
            <a
              href="/status"
              className="landing-status-pill mt-5 inline-flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault();
                go("/status");
              }}
            >
              <span className="landing-status-dot" aria-hidden />
              All systems operational
            </a>
          </div>
          <div className="landing-footer-grid">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="landing-footer-col">
                <span className="landing-footer-heading">{col.title}</span>
                {col.links.map((link) => (
                  <FooterLink key={link.href} {...link} />
                ))}
              </div>
            ))}
          </div>
          <div className="landing-footer-bottom">
            <p>
              © {new Date().getFullYear()} Flap · {SITE_URL.replace("https://", "")}
            </p>
            <div className="landing-footer-bottom-links">
              <a href="/llms.txt">llms.txt</a>
              <a href="/blog">Blog</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
