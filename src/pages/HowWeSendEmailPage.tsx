import { useEffect, type ReactNode } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { go } from "../lib/nav";
import { FOUNDER, SITE_URL, SUPPORT_EMAIL } from "../../shared/product-facts";

const PATH = "/how-we-send-email";
const UPDATED = "2026-09-09";

function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  const internal = href.startsWith("/");
  return (
    <a
      className="text-[var(--cta)] underline"
      href={href}
      onClick={
        internal
          ? (e) => {
              e.preventDefault();
              go(href);
            }
          : undefined
      }
    >
      {children}
    </a>
  );
}

export default function HowWeSendEmailPage() {
  useEffect(() => {
    setPageMeta({
      title: "How we send email | Flap",
      description:
        "How Flap uses Amazon SES for customer mailboxes: recipient acquisition, domain verification, bounces, complaints, opt-out, and sending limits.",
      path: PATH,
    });
    setJsonLd("how-we-send-email", [
      webPageLd({
        title: "How we send email | Flap",
        description:
          "Flap sending practices for Amazon SES: mailbox product, opt-in, bounce handling, and abuse controls.",
        path: PATH,
        dateModified: UPDATED,
      }),
    ]);
    return () => clearJsonLd("how-we-send-email");
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Sending practices</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">How we send email</h1>
        <LastUpdated date={UPDATED} />
        <p className="mt-5 text-lg text-[var(--muted)]">
          This page explains what Flap is, how Amazon SES is used, where recipients come from, and how bounces,
          complaints, and opt-out are handled. It is written for customers and for mail-provider reviewers.
        </p>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What Flap is</h2>
          <p className="mt-2 text-[var(--muted)]">
            Flap is a hosted <strong className="text-[var(--fg)]">custom-domain mailbox</strong> product at{" "}
            <PolicyLink href={SITE_URL}>{SITE_URL.replace("https://", "")}</PolicyLink>
            . Customers connect domains they own (or are authorized to operate) and use one inbox for those
            identities. It is founder-operated by {FOUNDER.name} (
            <PolicyLink href="/about">About</PolicyLink>
            ).
          </p>
          <p className="mt-3 text-[var(--muted)]">
            Flap is not an anonymous bulk ESP, not a public “send as anyone” SMTP relay, and not a purchased-list
            blasting service.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What Amazon SES is used for</h2>
          <p className="mt-2 text-[var(--muted)]">
            Amazon SES carries <strong className="text-[var(--fg)]">inbound and outbound customer mail</strong> for
            verified Flap domains: mailbox receive, replies, and application/transactional sends initiated from an
            authenticated workspace. System mail for useflap.online itself (sign-in, billing notices) uses a
            separate Cloudflare Email Sending path, not the customer SES identity.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            There is no public unauthenticated send API that accepts arbitrary From domains.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">How recipients are acquired</h2>
          <p className="mt-2 text-[var(--muted)]">Recipients come from the customer’s own relationships:</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[var(--muted)]">
            <li>
              People who email a customer mailbox (and replies in that correspondence). That is ordinary business
              mail, not a marketing blast list.
            </li>
            <li>
              Transactional events from the customer’s own app or users (for example account, billing, support, or
              purchase messages) sent through Flap compose or the authenticated send API as a mailbox on a verified
              domain.
            </li>
            <li>
              Newsletter subscribers who signed up on the customer’s public Flap form. Those public forms require{" "}
              <strong className="text-[var(--fg)]">double opt-in</strong>: the address stays pending until the
              subscriber confirms via email.
            </li>
          </ol>
          <p className="mt-3 text-[var(--muted)]">
            Flap does <strong className="text-[var(--fg)]">not</strong> sell lists. Customers may not send to
            purchased, rented, scraped, harvested, or otherwise improperly obtained addresses. Workspace operators who
            add addresses in the dashboard attest they have permission to contact those people; that path is still
            subject to acceptable use and can be suspended.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Not an open relay</h2>
          <p className="mt-2 text-[var(--muted)]">Outbound send requires all of the following:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>an authenticated Flap workspace;</li>
            <li>
              a custom domain that has completed verification (MX, SPF, and DKIM as shown in the DNS wizard). Flap
              does not enable outbound sending until those checks pass;
            </li>
            <li>
              a From address that matches a mailbox on that workspace. You cannot send as an arbitrary address on a
              domain you have not verified.
            </li>
          </ul>
          <p className="mt-3 text-[var(--muted)]">
            Bounce and complaint feedback currently uses Amazon SES default return-path handling. Customers are not
            asked to publish a separate MAIL FROM subdomain.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            Details: <PolicyLink href="/docs/domain-verification">domain verification</PolicyLink>.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Bounces and complaints</h2>
          <p className="mt-2 text-[var(--muted)]">
            Amazon SES delivery notifications (sent, delivered, bounced, complained, or rejected) are processed by
            Flap and attributed to the workspace that sent the message. Other customers&apos; workspaces are not
            affected by that feedback.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--muted)]">
            <li>
              <strong className="text-[var(--fg)]">Hard bounce:</strong> workspace-scoped suppression; that workspace
              will not keep sending to the address. Newsletter subscribers on that workspace are marked unsubscribed.
            </li>
            <li>
              <strong className="text-[var(--fg)]">Soft bounce:</strong> recorded temporarily and expires after 72
              hours; not a permanent suppression.
            </li>
            <li>
              <strong className="text-[var(--fg)]">Complaint:</strong> workspace-scoped suppression only. Workspace A
              never writes suppressions for Workspace B.
            </li>
          </ul>
          <p className="mt-3 text-[var(--muted)]">
            Flap suppressions are tenant-scoped. An empty Flap suppression list does not mean Amazon SES will accept
            every recipient at the account level.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            See <PolicyLink href="/docs/bounces-and-complaints">bounces and complaints</PolicyLink> and{" "}
            <PolicyLink href="/docs/deliverability">deliverability</PolicyLink>.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Opt-out</h2>
          <p className="mt-2 text-[var(--muted)]">
            Ordinary mailbox users do not need a marketing unsubscribe header: they can reply, filter, or stop
            writing. Newsletter (marketing) sends include a visible unsubscribe link, one-click unsubscribe where
            the recipient’s mail client supports it, and the customer’s physical mailing address in the footer.
            A newsletter cannot be sent until that address is set.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Limits and suspension</h2>
          <p className="mt-2 text-[var(--muted)]">
            Each plan has a monthly outbound send room and newsletter caps. There is no unlimited bulk send. Flap can
            suspend a domain or workspace from sending if bounce or complaint rates, abuse, or policy violations
            threaten recipients or Amazon SES reputation.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            See <PolicyLink href="/docs/sending-limits">sending limits</PolicyLink> and{" "}
            <PolicyLink href="/pricing">pricing</PolicyLink>.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Expected volume</h2>
          <p className="mt-2 text-[var(--muted)]">
            Customer mail currently sends in the Amazon SES sandbox. Production access is requested at the standard
            SES production default of 50,000 messages per 24 hours (with a conservative send rate).{" "}
            <strong className="text-[var(--fg)]">Actual</strong> initial volume will be far lower — hundreds to low
            thousands of messages per day as paying customers onboard — and will ramp with verified workspaces, not
            as a sudden blast.
          </p>
          <p className="mt-3 text-[var(--muted)]">
            Mail type is transactional first: mailbox correspondence and application events. Marketing is a
            constrained, opt-in newsletter feature on eligible plans, not the primary product.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Abuse reporting</h2>
          <p className="mt-2 text-[var(--muted)]">
            Report spam, phishing, or abusive sending at <PolicyLink href="/abuse">/abuse</PolicyLink> or{" "}
            <a className="text-[var(--cta)] underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            . We will suspend abusive tenants to protect recipients and Amazon SES reputation.
          </p>
        </section>

        <p className="mt-12 text-sm text-[var(--muted)]">
          <PolicyLink href="/acceptable-use">Acceptable use</PolicyLink>
          {" · "}
          <PolicyLink href="/privacy">Privacy</PolicyLink>
          {" · "}
          <PolicyLink href="/terms">Terms</PolicyLink>
          {" · "}
          <PolicyLink href="/security">Security</PolicyLink>
          {" · "}
          <PolicyLink href="/docs">Docs</PolicyLink>
          {" · "}
          <PolicyLink href="/about">About</PolicyLink>
          {" · "}
          <PolicyLink href="/pricing">Pricing</PolicyLink>
        </p>
      </article>
    </MarketingShell>
  );
}
