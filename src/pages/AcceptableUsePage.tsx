import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { go } from "../lib/nav";
import { SUPPORT_EMAIL } from "../../shared/product-facts";

const PATH = "/acceptable-use";
const UPDATED = "2026-09-09";

export default function AcceptableUsePage() {
  useEffect(() => {
    setPageMeta({
      title: "Acceptable Use | Flap",
      description:
        "Flap is for legitimate business and application email from domains you own. Purchased lists, spam, and unverified sender domains are prohibited.",
      path: PATH,
    });
    setJsonLd("aup-page", [
      webPageLd({
        title: "Acceptable Use | Flap",
        description: "Acceptable use and anti-spam rules for Flap custom-domain email.",
        path: PATH,
        dateModified: UPDATED,
      }),
    ]);
    return () => clearJsonLd("aup-page");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Policy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Acceptable use</h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 text-lg text-[var(--muted)]">
          Flap is intended for legitimate business and application email sent from domains that the customer owns or is
          authorized to manage.
        </p>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">You may not use Flap to send</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>unsolicited bulk email;</li>
            <li>messages to purchased, rented, scraped, harvested, or otherwise improperly obtained recipient lists;</li>
            <li>phishing or deceptive messages;</li>
            <li>malware or harmful content;</li>
            <li>impersonation messages;</li>
            <li>fraudulent content;</li>
            <li>spam or abusive automated mail;</li>
            <li>messages from domains you do not control or have permission to use.</li>
          </ul>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Domain verification</h2>
          <p className="mt-2 text-[var(--muted)]">
            All outbound domains must complete the verification requirements shown in Flap before sending is enabled.
            You cannot add an arbitrary hostname and immediately send as that domain.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Anti-spam</h2>
          <p className="mt-2 text-[var(--muted)]">
            Flap does not permit purchased, scraped, harvested, or unsolicited recipient lists. Business email is
            intended for direct communications between a Flap customer and people with whom they have an existing or
            legitimate business relationship. Transactional messages must relate to the recipient&apos;s use of the
            customer&apos;s service, account, purchase, support interaction, billing relationship, or another
            legitimate application event. Marketing or broadcast messages must only be sent to recipients who have
            appropriately requested or consented to those messages.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            Flap processes bounce and complaint feedback when SES delivery events are delivered to the product
            handler. Hard bounces and complaints create workspace-scoped suppressions. Soft bounces expire after 72
            hours. We will suspend or restrict tenants whose sending threatens Amazon SES or Flap reputation.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Opt-in and marketing mail</h2>
          <p className="mt-2 text-[var(--muted)]">
            Public newsletter signup forms require double opt-in (email confirmation) before the address is active.
            Newsletter sends must include the customer&apos;s physical mailing address and an unsubscribe mechanism
            (token link plus List-Unsubscribe). Mailbox replies and transactional application mail are not treated as
            marketing lists.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Enforcement</h2>
          <p className="mt-2 text-[var(--muted)]">
            Flap may restrict or suspend accounts, domains, API access, or sending capabilities if activity creates
            excessive bounce or complaint rates, indicates abuse, violates applicable law, or threatens platform or
            Amazon SES reputation. Sending limits depend on your plan and account status. Operators can disable
            outbound send for a workspace when needed.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            Users are responsible for having a lawful and appropriate basis to contact recipients. Purchased, rented,
            scraped, and harvested lists are prohibited even if a dashboard import would technically accept addresses.
          </p>
        </section>
        <p className="mt-12 text-sm text-[var(--muted)]">
          Report abuse:{" "}
          <a className="text-[var(--cta)] underline" href="/abuse" onClick={(e) => { e.preventDefault(); go("/abuse"); }}>
            /abuse
          </a>
          {" · "}
          <a className="text-[var(--cta)] underline" href="/how-we-send-email" onClick={(e) => { e.preventDefault(); go("/how-we-send-email"); }}>
            How we send email
          </a>
          {" · "}
          <a className="text-[var(--cta)] underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
      </article>
    </MarketingShell>
  );
}
