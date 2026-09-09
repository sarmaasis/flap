import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { go } from "../lib/nav";
import { SUPPORT_EMAIL } from "../../shared/product-facts";

const PATH = "/abuse";
const UPDATED = "2026-09-09";

export default function AbusePage() {
  useEffect(() => {
    setPageMeta({
      title: "Report abuse | Flap",
      description: `Report spam, phishing, or abusive sending involving Flap to ${SUPPORT_EMAIL}.`,
      path: PATH,
    });
    setJsonLd("abuse-page", [
      webPageLd({
        title: "Report abuse | Flap",
        description: "How to report abuse involving Flap-hosted email.",
        path: PATH,
        dateModified: UPDATED,
      }),
    ]);
    return () => clearJsonLd("abuse-page");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Trust</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Report abuse</h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 text-lg text-[var(--muted)]">
          Use this page to report phishing, spam, malware, impersonation, or other abuse involving a Flap-hosted
          mailbox or domain.
        </p>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="mt-2 text-[var(--muted)]">
            Email{" "}
            <a className="text-[var(--cta)] underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>{" "}
            with the sending address, approximate time, and headers or a sample if you have them. Do not send
            passwords or private keys.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            This is the monitored abuse path. We do not publish additional mailboxes that are not staffed.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Anti-spam</h2>
          <p className="mt-2 text-[var(--muted)]">
            Flap does not permit purchased, scraped, harvested, or unsolicited recipient lists. Outbound sending
            requires an authenticated workspace and a verified custom domain. Bounce and complaint events are
            attributed to the sending workspace so suppressions do not cross tenants.
          </p>
        </section>
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Complaints and enforcement</h2>
          <p className="mt-2 text-[var(--muted)]">
            If you received unwanted mail from a Flap-hosted domain, include headers when possible. We investigate
            and may suppress recipients, restrict sending, or suspend the tenant. We do this to protect recipients
            and Amazon SES reputation — not to keep a high-volume sender online at all costs.
          </p>
        </section>
        <p className="mt-12 text-sm text-[var(--muted)]">
          <a className="text-[var(--cta)] underline" href="/acceptable-use" onClick={(e) => { e.preventDefault(); go("/acceptable-use"); }}>
            Acceptable use
          </a>
          {" · "}
          <a className="text-[var(--cta)] underline" href="/how-we-send-email" onClick={(e) => { e.preventDefault(); go("/how-we-send-email"); }}>
            How we send email
          </a>
          {" · "}
          <a className="text-[var(--cta)] underline" href="/security" onClick={(e) => { e.preventDefault(); go("/security"); }}>
            Security
          </a>
        </p>
      </article>
    </MarketingShell>
  );
}
