import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { ArticleCtas, DefinitionBox, LastUpdated } from "../components/MarketingArticle";
import { trackOnce } from "../lib/analytics";
import {
  breadcrumbLd,
  clearJsonLdHelpers,
  entityGraphLd,
  setJsonLdBundle,
  setPageMeta,
  softwareApplicationLd,
  webPageLd,
} from "../lib/seo";
import {
  FOUNDER,
  MAIL_ARCHITECTURE,
  PRODUCT_ONE_PARAGRAPH,
  SUPPORT_EMAIL,
  TARGET_CUSTOMER,
} from "../../shared/product-facts";
import { go } from "../lib/nav";

const PATH = "/about";
const UPDATED = "2026-09-07";

export default function AboutPage() {
  useEffect(() => {
    setPageMeta({
      title: "About Flap — custom-domain email for founders",
      description:
        "What Flap is, who builds it, how mail runs on Amazon SES, and how to contact support@useflap.online.",
      path: PATH,
    });
    trackOnce("about_view", "organic_landing", { path: PATH });
    setJsonLdBundle(
      entityGraphLd([
        webPageLd({
          path: PATH,
          title: "About Flap",
          description: PRODUCT_ONE_PARAGRAPH,
          dateModified: UPDATED,
        }),
        softwareApplicationLd(),
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "About", path: PATH },
        ]),
      ]),
    );
    return () => clearJsonLdHelpers();
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cta)]">About</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          About Flap
        </h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-2 text-sm text-[var(--muted)]">
          By{" "}
          <a href="/about#founder" className="text-[var(--cta)] hover:underline">
            {FOUNDER.name}
          </a>
          , {FOUNDER.role}
        </p>

        <DefinitionBox>{PRODUCT_ONE_PARAGRAPH}</DefinitionBox>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">What Flap is</h2>
          <p>
            Flap hosts custom-domain email so you can send and receive as you@yourstartup.com across
            every project domain from one inbox. It is email infrastructure — not Docs, Drive, Meet,
            or Calendar.
          </p>
          <p>
            <strong className="text-[var(--fg)]">Who it is for:</strong> {TARGET_CUSTOMER}
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Why it was built</h2>
          <p>
            Serial founders accumulate domains faster than headcount. Paying for a full productivity
            suite (or a forgotten forward into personal Gmail) for every launch is the wrong unit of
            cost. Flap prices primarily by domain count and keeps identities in one place.
          </p>
        </section>

        <section id="founder" className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Who operates Flap</h2>
          <p>
            Flap is founded and operated by{" "}
            <strong className="text-[var(--fg)]">{FOUNDER.name}</strong>.
          </p>
          <p>
            On X:{" "}
            <a
              className="text-[var(--cta)] hover:underline"
              href={FOUNDER.xUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              @{FOUNDER.xHandle}
            </a>
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Infrastructure (high level)</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-[var(--fg)]">Inbound:</strong> {MAIL_ARCHITECTURE.inbound_flow}
            </li>
            <li>
              <strong className="text-[var(--fg)]">Outbound:</strong> {MAIL_ARCHITECTURE.outbound_flow}
            </li>
            <li>
              <strong className="text-[var(--fg)]">App:</strong> {MAIL_ARCHITECTURE.app_host}
            </li>
            <li>
              <strong className="text-[var(--fg)]">System mail:</strong> {MAIL_ARCHITECTURE.system_mail_note}
            </li>
            <li>{MAIL_ARCHITECTURE.dns_note}</li>
          </ul>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">Contact & policies</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Support:{" "}
              <a className="text-[var(--cta)] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/support" onClick={(e) => { e.preventDefault(); go("/support"); }}>
                Support page
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/status" onClick={(e) => { e.preventDefault(); go("/status"); }}>
                Status
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/docs" onClick={(e) => { e.preventDefault(); go("/docs"); }}>
                Documentation
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>
                Privacy Policy
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>
                Terms of Service
              </a>
            </li>
            <li>
              <a className="text-[var(--cta)] hover:underline" href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>
                Billing Terms
              </a>
            </li>
          </ul>
        </section>

        <ArticleCtas source="about" />
      </article>
    </MarketingShell>
  );
}
