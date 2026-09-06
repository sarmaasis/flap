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

export default function MarketingShell({ children, primaryHref = "/signup", primaryLabel = "Start free" }: Props) {
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
        <nav className="hidden items-center gap-5 text-sm text-[var(--muted)] md:flex">
          <a href="/#pricing" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/#pricing"); }}>Pricing</a>
          <a href="/docs/api" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/docs/api"); }}>Docs</a>
          <a href="/tools" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/tools"); }}>Tools</a>
          <a href="/guides/cloudflare-custom-domain-email" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/guides/cloudflare-custom-domain-email"); }}>Guides</a>
          <a href="/blog" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/blog"); }}>Blog</a>
          <a href="/login" className="hover:text-[var(--fg)]" onClick={(e) => { e.preventDefault(); go("/login"); }}>Sign in</a>
          <Button
            size="sm"
            onClick={() => {
              track("signup_clicked", { source: "nav" });
              go(primaryHref);
            }}
          >
            {primaryLabel}
          </Button>
        </nav>
        <Button
          className="md:hidden"
          size="sm"
          onClick={() => {
            track("signup_clicked", { source: "nav_mobile" });
            go(primaryHref);
          }}
        >
          {primaryLabel}
        </Button>
      </header>

      {children}

      <footer className="landing-footer mx-auto grid max-w-6xl gap-10 border-t border-[var(--line)] px-5 py-14 text-sm text-[var(--muted)] md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:gap-8 md:px-8 md:py-16">
        <div>
          <div className="brand mb-3 flex items-center gap-2 text-[var(--fg)]">
            <BrandMark /> Flap
          </div>
          <p className="max-w-xs text-sm leading-relaxed">{MARKETING.short_description}</p>
          <p className="mt-5 text-xs">© {new Date().getFullYear()} Flap · {SITE_URL.replace("https://", "")}</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Product</span>
          <a href="/#pricing" onClick={(e) => { e.preventDefault(); go("/#pricing"); }}>Pricing</a>
          <a href="/multiple-domains-one-inbox" onClick={(e) => { e.preventDefault(); go("/multiple-domains-one-inbox"); }}>Multiple domains</a>
          <a href="/custom-domain-email" onClick={(e) => { e.preventDefault(); go("/custom-domain-email"); }}>Custom domain email</a>
          <a href="/flap-vs-google-workspace" onClick={(e) => { e.preventDefault(); go("/flap-vs-google-workspace"); }}>vs Google Workspace</a>
          <a href="/flap-vs-zoho" onClick={(e) => { e.preventDefault(); go("/flap-vs-zoho"); }}>vs Zoho Mail</a>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--fg)]">Learn</span>
          <a href="/blog" onClick={(e) => { e.preventDefault(); go("/blog"); }}>Blog</a>
          <a href="/docs/api" onClick={(e) => { e.preventDefault(); go("/docs/api"); }}>API & webhooks</a>
          <a href="/guides/cloudflare-custom-domain-email" onClick={(e) => { e.preventDefault(); go("/guides/cloudflare-custom-domain-email"); }}>Cloudflare guide</a>
          <a href="/google-workspace-alternative" onClick={(e) => { e.preventDefault(); go("/google-workspace-alternative"); }}>Workspace alternative</a>
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
          <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
          <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy</a>
        </div>
      </footer>
    </div>
  );
}
