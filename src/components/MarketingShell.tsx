import type { ReactNode } from "react";
import BrandMark from "./BrandMark";
import { Button } from "./ui/button";
import { go } from "../lib/nav";
import { track } from "../lib/analytics";
import { MARKETING, SITE_URL, SUPPORT_EMAIL } from "../content/marketing";

type Props = {
  children: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
};

const FOOTER_TOOLS = [
  { path: "/tools", label: "All tools" },
  { path: "/tools/google-workspace-cost-calculator", label: "Cost calculator" },
  { path: "/tools/mx-checker", label: "MX checker" },
  { path: "/tools/spf-checker", label: "SPF checker" },
  { path: "/tools/dmarc-checker", label: "DMARC checker" },
  { path: "/tools/email-setup-checker", label: "Setup checker" },
  { path: "/tools/header-analyzer", label: "Header analyzer" },
  { path: "/tools/deliverability-scorecard", label: "Scorecard" },
];

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/for", label: "Use cases" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export default function MarketingShell({ children, primaryHref = "/signup", primaryLabel = "Get started" }: Props) {
  return (
    <div className="landing-root min-h-screen overflow-x-clip">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="landing-nav mx-auto max-w-6xl px-5 md:px-8">
        <div className="landing-nav-bar">
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
          <details className="marketing-mobile-menu"><summary>Menu</summary><nav aria-label="Mobile navigation">{[...NAV_LINKS, { href: "/login", label: "Sign in" }].map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></details>
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="hidden text-sm font-medium text-[var(--muted)] hover:text-[var(--fg)] sm:inline md:hidden"
              onClick={(e) => {
                e.preventDefault();
                go("/login");
              }}
            >
              Sign in
            </a>
            <Button
              size="sm"
              asChild
              onClick={() => track("signup_clicked", { source: "nav" })}
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

      <main id="main-content">{children}</main>

      <footer className="landing-footer mx-auto grid max-w-6xl gap-10 border-t border-[var(--line)] px-5 py-14 text-sm text-[var(--muted)] md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:gap-8 md:px-8 md:py-16">
        <div>
          <div className="brand mb-3 flex items-center gap-2 text-[var(--fg)]">
            <BrandMark /> flap
          </div>
          <p className="max-w-xs text-sm leading-relaxed">{MARKETING.short_description}</p>
          <p className="mt-5 text-xs">© {new Date().getFullYear()} Flap · {SITE_URL.replace("https://", "")}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Product</span>
          <a href="/pricing" onClick={(e) => { e.preventDefault(); go("/pricing"); }}>Pricing</a>
          <a href="/security" onClick={(e) => { e.preventDefault(); go("/security"); }}>Security</a>
          <a href="/about" onClick={(e) => { e.preventDefault(); go("/about"); }}>About</a>
          <a href="/for" onClick={(e) => { e.preventDefault(); go("/for"); }}>Who it&apos;s for</a>
          <a href="/vs" onClick={(e) => { e.preventDefault(); go("/vs"); }}>Compare</a>
          <a href="/vs/shipmail" onClick={(e) => { e.preventDefault(); go("/vs/shipmail"); }}>vs Shipmail</a>
          <a href="/vs/google-workspace" onClick={(e) => { e.preventDefault(); go("/vs/google-workspace"); }}>vs Google Workspace</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Learn</span>
          <a href="/blog" onClick={(e) => { e.preventDefault(); go("/blog"); }}>Blog</a>
          <a href="/docs" onClick={(e) => { e.preventDefault(); go("/docs"); }}>Docs</a>
          <a href="/research" onClick={(e) => { e.preventDefault(); go("/research"); }}>Research</a>
          <a href="/guides" onClick={(e) => { e.preventDefault(); go("/guides"); }}>Guides</a>
          <a href="/status" onClick={(e) => { e.preventDefault(); go("/status"); }}>Status</a>
          <a href="/email-for-indie-hackers" onClick={(e) => { e.preventDefault(); go("/email-for-indie-hackers"); }}>Indie hackers</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Tools</span>
          {FOOTER_TOOLS.map((t) => (
            <a
              key={t.path}
              href={t.path}
              onClick={(e) => {
                e.preventDefault();
                go(t.path);
              }}
            >
              {t.label}
            </a>
          ))}
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Account</span>
          <a href="/signup" onClick={(e) => { e.preventDefault(); track("signup_clicked", { source: "footer" }); go("/signup"); }}>Start free</a>
          <a href="/login" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
          <a href="/support" onClick={(e) => { e.preventDefault(); go("/support"); }}>Support</a>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Email support</a>
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
}
