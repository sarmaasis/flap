import { useEffect } from "react";
import BrandMark from "../components/BrandMark";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

type Doc = "terms" | "privacy" | "billing";

const TITLES: Record<Doc, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  billing: "Billing Terms",
};

const META: Record<Doc, { path: string; title: string; description: string }> = {
  terms: {
    path: "/terms",
    title: "Terms of Service | Flap",
    description: "Terms of Service for Flap custom-domain email at useflap.online.",
  },
  privacy: {
    path: "/privacy",
    title: "Privacy Policy | Flap",
    description: "Privacy Policy for Flap — how we handle account and mailbox data.",
  },
  billing: {
    path: "/billing-terms",
    title: "Billing Terms | Flap",
    description: "Billing Terms for Flap paid plans and renewals.",
  },
};

function Nav() {
  return (
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-6 md:px-0">
      <a
        href="/"
        className={cn("flex items-center gap-2 text-lg font-semibold", tw.brand)}
        onClick={(e) => {
          e.preventDefault();
          go("/");
        }}
      >
        <BrandMark /> Flap
      </a>
      <a href="mailto:support@useflap.online" className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">
        support@useflap.online
      </a>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mx-auto mt-16 flex max-w-3xl flex-col gap-3 border-t border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)] md:flex-row md:justify-between md:px-0">
      <span>© {new Date().getFullYear()} Flap · useflap.online</span>
      <span className="flex flex-wrap gap-4">
        <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms</a>
        <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy</a>
        <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing</a>
        <a href="mailto:support@useflap.online">Support</a>
      </span>
    </footer>
  );
}

function TermsBody() {
  return (
    <>
      <p className="mb-5 text-[13px] text-[var(--foreground-muted)]">Last updated: September 4, 2026</p>
      <p>
        These Terms of Service (“Terms”) govern your access to and use of Flap, the hosted custom-domain email
        product operated at useflap.online (the “Service”). By creating an account or using the Service, you agree
        to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        Flap provides a hosted mailbox for domains you control: inbound and outbound email, aliases, rules,
        storage, and related developer features (API keys and webhooks) according to your plan. Flap is not a
        law firm, not a postal carrier, and not a guaranteed spam filter. Delivery depends on DNS configuration,
        Cloudflare Workers (compute), D1, R2, optional Email Sending for system mail,
        Mailgun (legacy domains during migration), Amazon SES (customer-domain send/receive), recipient servers, and other subprocessors
        networks outside our control.
      </p>

      <h2>2. Accounts and eligibility</h2>
      <p>
        You must provide accurate account information and keep your credentials confidential. You are responsible
        for activity under your account. You must be able to enter a binding contract and must not use Flap if
        prohibited by applicable law.
      </p>

      <h2>3. Your domains and content</h2>
      <p>
        You retain ownership of your email content and domain-related configuration. You grant Flap a limited
        license to host, process, transmit, and display content solely to operate the Service. You represent that
        you have the right to receive and send mail for the domains and addresses you configure.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use Flap to:</p>
      <ul>
        <li>Send spam, phishing, malware, or unsolicited bulk email</li>
        <li>Impersonate others or forge headers</li>
        <li>Violate privacy, intellectual property, export, or other laws</li>
        <li>Probe, disrupt, or overload the Service or related infrastructure</li>
        <li>Resell access except as expressly allowed in writing</li>
      </ul>
      <p>
        We may suspend or terminate accounts that create abuse risk, legal risk, or material harm to other users
        or providers.
      </p>

      <h2>5. Plans, limits, and billing</h2>
      <p>
        Free and paid plans include usage limits (domains, mailboxes, aliases, storage including message bodies and
        attachments, outbound sends per UTC calendar month, API keys, webhooks, and related quotas). Exceeding limits
        may block inbound delivery, drafts, or sends until you upgrade or reduce usage. Paid
        subscriptions are billed through our payment processor (Dodo Payments). See{" "}
        <a href="/billing-terms" onClick={(e) => { e.preventDefault(); go("/billing-terms"); }}>Billing Terms</a>{" "}
        for charges, renewals, and cancellations.
      </p>

      <h2>6. Availability and changes</h2>
      <p>
        We aim for reliable uptime but do not guarantee uninterrupted Service. Features may change; we will not
        materially reduce core mailbox access for paying customers without notice where practical. Beta or
        Team features (invites, shared mailboxes, roles) require an active Team plan. Free and Pro workspaces remain solo.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLAP
        DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do
        not warrant that mail will always be delivered, free of spam, or free of third-party interference.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Flap’s total liability arising out of these Terms or the Service
        will not exceed the greater of (a) amounts you paid to Flap for the Service in the three months before
        the claim or (b) USD $50. Flap is not liable for indirect, incidental, special, consequential, or lost
        profits damages.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may stop using the Service at any time and cancel paid subscriptions as described in Billing Terms.
        We may suspend or terminate access for breach, non-payment, or risk to the Service. Upon termination,
        your right to use Flap ends; we may delete data after a reasonable retention window unless law requires
        longer retention. Export your data from Settings before canceling if you need a copy.
      </p>

      <h2>10. Privacy</h2>
      <p>
        Our collection and use of personal data is described in the{" "}
        <a href="/privacy" onClick={(e) => { e.preventDefault(); go("/privacy"); }}>Privacy Policy</a>.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:support@useflap.online">support@useflap.online</a>.
      </p>
    </>
  );
}

function PrivacyBody() {
  return (
    <>
      <p className="mb-5 text-[13px] text-[var(--foreground-muted)]">Last updated: September 4, 2026</p>
      <p>
        This Privacy Policy explains how Flap (“we”, “us”) collects, uses, and shares information when you use
        useflap.online and related APIs (the “Service”).
      </p>

      <h2>1. Who we are</h2>
      <p>
        Flap is a hosted email product. Contact:{" "}
        <a href="mailto:support@useflap.online">support@useflap.online</a>.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email address, display name if provided, plan and
          subscription identifiers.
        </li>
        <li>
          <strong>Mailbox content</strong> — messages, headers, attachments metadata and files (when storage is
          configured), drafts, signatures, templates, contacts, filters, aliases, and related settings you store
          in Flap.
        </li>
        <li>
          <strong>Technical data</strong> — IP address, user agent, timestamps, API usage, webhook delivery
          attempts, and diagnostic logs needed to operate and secure the Service.
        </li>
        <li>
          <strong>Billing data</strong> — plan selection and payment events processed by Dodo Payments. We do not
          store full card numbers on Flap servers; the processor holds payment credentials.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>Provide, secure, and improve the Service</li>
        <li>Route, store, and display mail you send and receive</li>
        <li>Enforce plan limits and process subscriptions</li>
        <li>Respond to support requests and abuse reports</li>
        <li>Comply with law and protect rights, safety, and integrity of the Service</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2>4. Processors and subprocessors</h2>
      <p>We rely on infrastructure and payment providers, including:</p>
      <ul>
        <li>Cloudflare (Workers, D1, R2, Email Sending when used for system mail, and related edge services)</li>
        <li>Amazon SES (inbound/outbound email for customer domains)</li>
        <li>Mailgun (legacy customer domains during migration, if any)</li>
        <li>Dodo Payments (checkout, subscriptions, invoices, customer portal)</li>
      </ul>
      <p>
        These providers process data under their own terms and solely as needed to deliver Flap. Webhooks you
        configure may send mail event payloads to URLs you control; you are responsible for those endpoints.
      </p>

      <h2>5. Retention</h2>
      <p>
        We retain account and mailbox data while your account is active. After deletion or prolonged inactivity,
        we may remove data from active systems within a reasonable period, subject to backups, legal holds, and
        fraud/abuse logs. You can export JSON backups from Settings while your account is active.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard controls appropriate to a hosted mailbox (encrypted transport, session cookies,
        session cookies, access controls). No method of transmission or storage is perfectly secure. Report
        suspected vulnerabilities to{" "}
        <a href="mailto:support@useflap.online">support@useflap.online</a>.
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>Update account settings and mailbox configuration in the app</li>
        <li>Export or delete content you control via Settings tools where available</li>
        <li>Cancel subscriptions via the billing portal or by contacting support</li>
        <li>Request account deletion by emailing support</li>
      </ul>

      <h2>8. International transfers</h2>
      <p>
        Flap may process data in regions where Cloudflare and our processors operate. By using the Service, you
        understand that processing may occur outside your country of residence subject to applicable safeguards.
      </p>

      <h2>9. Children</h2>
      <p>Flap is not directed to children under 16, and we do not knowingly collect their data.</p>

      <h2>10. Changes</h2>
      <p>
        We may update this Policy. Material changes will be posted on this page with an updated date. Continued
        use after changes constitutes acceptance where permitted by law.
      </p>

      <h2>11. Contact</h2>
      <p>
        Privacy questions: <a href="mailto:support@useflap.online">support@useflap.online</a>.
      </p>
    </>
  );
}

function BillingBody() {
  return (
    <>
      <p className="mb-5 text-[13px] text-[var(--foreground-muted)]">Last updated: September 4, 2026</p>
      <p>
        These Billing Terms supplement the{" "}
        <a href="/terms" onClick={(e) => { e.preventDefault(); go("/terms"); }}>Terms of Service</a> and apply to
        paid Flap plans.
      </p>

      <h2>1. Plans and prices</h2>
      <p>
        Current plan names, monthly prices, and limits are shown on useflap.online and in Settings → Billing.
        Prices are in USD unless stated otherwise. Taxes may apply depending on your location and processor
        configuration.
      </p>

      <h2>2. Payment processor</h2>
      <p>
        Payments are processed by Dodo Payments. By upgrading, you also agree to the processor’s applicable
        terms. Flap receives subscription status via secure webhooks; entitlements update when payment events are
        confirmed.
      </p>

      <h2>3. Renewals</h2>
      <p>
        Paid plans renew automatically each billing period until canceled. You authorize recurring charges to the
        payment method on file with the processor.
      </p>

      <h2>4. Upgrades and downgrades</h2>
      <p>
        Upgrades take effect after successful checkout and webhook confirmation. Downgrades or cancellations may
        apply at period end or immediately depending on portal/API options enabled for your subscription. Plan
        limits for Free apply after paid access ends; resources above Free limits may be blocked until reduced.
      </p>

      <h2>5. Cancellation</h2>
      <p>
        Manage or cancel from Settings → Billing (Customer Portal when available), or email{" "}
        <a href="mailto:support@useflap.online">support@useflap.online</a>. Cancellation stops future renewals;
        fees already paid for the current period are generally non-refundable except where required by law or
        expressly offered by us.
      </p>

      <h2>6. Failed payments</h2>
      <p>
        If a renewal fails, access may move to an on-hold or Free state after retries. Update your payment method
        in the customer portal or contact support to restore paid entitlements.
      </p>

      <h2>7. Free plan</h2>
      <p>
        The Free plan has no subscription charge and includes lower limits. We may modify Free limits with notice
        on the pricing page.
      </p>

      <h2>8. Contact</h2>
      <p>
        Billing help: <a href="mailto:support@useflap.online">support@useflap.online</a>.
      </p>
    </>
  );
}

export default function Legal({ doc }: { doc: Doc }) {
  useEffect(() => {
    const meta = META[doc];
    setPageMeta({ title: meta.title, description: meta.description, path: meta.path });
    setJsonLd(
      "flap-webpage",
      webPageLd({
        path: meta.path,
        title: meta.title,
        description: meta.description,
        dateModified: "2026-09-04",
      }),
    );
    return () => clearJsonLd("flap-webpage");
  }, [doc]);

  return (
    <div className="marketing-light relative min-h-screen text-[var(--foreground)]">
      <Nav />
      <article className="mx-auto max-w-3xl px-5 pb-8 md:px-0">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          {TITLES[doc]}
        </h1>
        <div className="mt-8 text-[15px] leading-[1.65] text-[var(--foreground-muted)] [&_a]:text-[var(--accent)] [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-7 [&_h2]:mb-2.5 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-[1.15rem] [&_h2]:font-semibold [&_h2]:text-[var(--foreground)] [&_p]:mb-3.5 [&_ul]:mb-3.5 [&_ul]:pl-5">
          {doc === "terms" ? <TermsBody /> : null}
          {doc === "privacy" ? <PrivacyBody /> : null}
          {doc === "billing" ? <BillingBody /> : null}
        </div>
      </article>
      <Footer />
    </div>
  );
}
