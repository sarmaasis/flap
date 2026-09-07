import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { MAIL_ARCHITECTURE } from "../../shared/product-facts";

const PATH = "/security";
const UPDATED = "2026-09-07";

const SECTIONS = [
  {
    title: "We do not read your email for ads",
    body: "Flap does not scan customer mail to sell ads or build advertising profiles.",
  },
  {
    title: "We do not sell behavioral mail data",
    body: "Message content is not sold. Product analytics use aggregate product events, not inbox contents.",
  },
  {
    title: "Your data stays yours",
    body: "Export JSON or .mbox anytime from Settings. After cancel, paid accounts keep a 30-day export window.",
  },
  {
    title: "How deliverability is configured",
    body: "You publish MX, SPF, and DKIM for Amazon SES at your DNS host. DMARC is recommended. Flap shows exact records in the DNS wizard.",
  },
  {
    title: "Portability",
    body: "Today: webmail, PWA, and export. IMAP/SMTP app passwords are scheduled for 2026-10-15. We will not market client protocols as live before they ship.",
  },
  {
    title: "Concrete controls",
    body: "TLS in transit to the app and to SES. Encryption at rest via Cloudflare D1/R2 and SES storage. Auth rate limits on email codes. HMAC-signed inbound and outbound webhooks.",
  },
  {
    title: "Infrastructure honesty",
    body: `${MAIL_ARCHITECTURE.app_host}. Customer mail: ${MAIL_ARCHITECTURE.inbound_provider} inbound and outbound. System mail for useflap.online uses Cloudflare Email Sending. Flap is not an EU Rust MTA and does not claim Proton-style end-to-end encryption.`,
  },
];

export default function SecurityPage() {
  useEffect(() => {
    setPageMeta({
      title: "Security | Flap",
      description:
        "How Flap handles privacy, export, TLS, and mail infrastructure. Amazon SES for your domains. Cloudflare for the app.",
      path: PATH,
    });
    setJsonLd("security-page", [
      webPageLd({
        title: "Security | Flap",
        description: "Honest security and privacy commitments for Flap custom-domain email.",
        path: PATH,
        dateModified: UPDATED,
      }),
    ]);
    return () => clearJsonLd("security-page");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Security</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Privacy and security</h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 text-lg text-[var(--muted)]">
          Short promises we can keep. Amazon SES for your domains. Cloudflare for the app.
        </p>
        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              <p className="mt-2 text-[var(--muted)]">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-[var(--muted)]">
          Questions: <a className="text-[var(--cta)] underline" href="mailto:support@useflap.online">support@useflap.online</a>
        </p>
      </article>
    </MarketingShell>
  );
}
