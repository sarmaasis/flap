import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { go } from "../lib/nav";
import { MAIL_ARCHITECTURE, SUPPORT_EMAIL } from "../../shared/product-facts";

const PATH = "/security";
const UPDATED = "2026-09-09";

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
    title: "Inbound and outbound architecture",
    body: `${MAIL_ARCHITECTURE.inbound_flow}. ${MAIL_ARCHITECTURE.outbound_flow}. ${MAIL_ARCHITECTURE.system_mail_note}`,
  },
  {
    title: "Encryption in transit and at rest",
    body: "TLS in transit to the Flap app and to Amazon SES. Encryption at rest via Cloudflare D1/R2 and SES-managed storage. Flap does not claim end-to-end encryption of mailbox contents (Proton-style E2EE is not offered).",
  },
  {
    title: "Mailbox storage",
    body: "Message bodies and attachments for customer mail are stored in Flap’s Cloudflare-backed app storage after SES inbound ingest. Retention follows your active account and export windows described below.",
  },
  {
    title: "Authentication and sessions",
    body: "Sign-in is handled by Clerk. Use Account → Security in Clerk for 2FA when enabled on the instance. Auth email codes are rate-limited. Session cookies follow Clerk’s session model.",
  },
  {
    title: "Access controls",
    body: "Mailboxes and domains are scoped to the signed-in workspace. Team seats (Pro/Team) share workspace access according to plan; there is no public mailbox URL.",
  },
  {
    title: "Secrets and webhooks",
    body: "API keys are shown once at creation. Inbound and outbound webhooks use HMAC signatures. Do not commit keys to public repos.",
  },
  {
    title: "DNS / deliverability configuration",
    body: "You publish MX, SPF, and DKIM for Amazon SES at your DNS host. DMARC is recommended. Flap shows exact records in the DNS wizard with per-record status.",
  },
  {
    title: "AI assistant behavior",
    body: "AI features are opt-in where offered. Summaries and drafts never silently send — you confirm every outbound message. Do not assume mailbox contents are used for advertising models.",
  },
  {
    title: "Operator access",
    body: "Flap is founder-operated. Support may access account metadata to debug DNS or billing when you contact us. We do not market “zero-knowledge” mailboxes.",
  },
  {
    title: "Backups, export, deletion",
    body: "You can export JSON workspace backups and per-mailbox .mbox from Settings anytime. After cancel, paid accounts keep a documented export window. We may delete account data after a reasonable retention period unless law requires longer retention — export before you leave.",
  },
  {
    title: "Built for verified custom domains",
    body: "Every sending domain connected to Flap must complete verification before outbound email can be enabled. Flap does not operate as an open relay and users cannot send from arbitrary unverified domains.",
  },
  {
    title: "Email abuse and reputation protection",
    body: "Outbound email is restricted to authenticated Flap workspaces and verified custom domains. Flap applies sending limits and domain-readiness checks before dispatch. Delivery, bounce, complaint, rejection, and suppression signals are processed to support deliverability monitoring and abuse controls. Repeated delivery failures or abusive activity may cause sending to be restricted or suspended.",
  },
  {
    title: "Bounce and complaint handling",
    body: "Flap processes delivery feedback and uses bounce, complaint, suppression, and account/domain controls to protect sending reputation. Soft bounces expire after 72 hours. Hard bounces and complaints create workspace-scoped suppressions only.",
  },
  {
    title: "Inbound security",
    body: "Inbound mail arrives via SES receipt processing, private S3 raw-message storage, queue/retry, and HMAC-signed ingest into Flap. SNS configuration-set events verify native SNS signatures when present.",
  },
  {
    title: "Email HTML sanitization and remote images",
    body: "Rendered HTML mail is sanitized. Remote images are privacy-controlled so tracking pixels are not loaded by default unless the user allows them.",
  },
  {
    title: "Abuse and incidents",
    body: `Report abuse, phishing from Flap domains, or suspected account compromise via /abuse or ${SUPPORT_EMAIL}. We do not claim SOC 2, ISO 27001, or similar certifications we have not obtained.`,
  },
  {
    title: "Portability",
    body: "Today: webmail, PWA, JSON export, and .mbox. IMAP/SMTP client access is planned but not yet available — we will not market those protocols as live before they ship.",
  },
  {
    title: "Infrastructure honesty",
    body: `${MAIL_ARCHITECTURE.app_host}. Customer mail: ${MAIL_ARCHITECTURE.inbound_provider} inbound and outbound. ${MAIL_ARCHITECTURE.dns_note} Flap is not an EU Rust MTA.`,
  },
];

export default function SecurityPage() {
  useEffect(() => {
    setPageMeta({
      title: "Security & privacy | Flap custom-domain email",
      description:
        "How Flap protects your email: TLS in transit, SES mail delivery, Cloudflare app hosting, Clerk auth, export, AI confirm-before-send. No ads, no invented certifications.",
      path: PATH,
    });
    setJsonLd("security-page", [
      webPageLd({
        title: "Security & privacy | Flap custom-domain email",
        description: "Honest security and privacy commitments for Flap custom-domain email hosting.",
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
          Precise statements we can keep. No “bank-grade” vagueness. Amazon SES for your domains. Cloudflare for the app.
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
          Questions:{" "}
          <a className="text-[var(--cta)] underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          {" · "}
          <a
            className="text-[var(--cta)] underline"
            href="/status"
            onClick={(e) => {
              e.preventDefault();
              go("/status");
            }}
          >
            Status
          </a>
          {" · "}
          <a
            className="text-[var(--cta)] underline"
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              go("/privacy");
            }}
          >
            Privacy
          </a>
        </p>
      </article>
    </MarketingShell>
  );
}
