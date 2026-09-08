import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { ArticleCtas, ComparisonTable, DefinitionBox, FaqBlock, LastUpdated } from "../components/MarketingArticle";
import { trackOnce } from "../lib/analytics";
import { go } from "../lib/nav";
import {
  breadcrumbLd,
  clearJsonLdHelpers,
  entityGraphLd,
  setJsonLdBundle,
  setPageMeta,
  webPageLd,
} from "../lib/seo";
import { Button } from "../components/ui/button";
import { MAIL_ARCHITECTURE } from "../../shared/product-facts";

const PATH = "/why-not-amazon-ses";
const UPDATED = "2026-09-08";

const PRODUCT_LAYER = [
  "Guided domain onboarding with copyable MX/SPF/DKIM and precise verification errors",
  "Inbound processing into real mailboxes (not raw SES receipts alone)",
  "Webmail inbox UI with threading and search",
  "Aliases and per-domain sender identities",
  "Reply-from mapped to the receiving mailbox",
  "Storage, contacts, and shared team workflows on Pro/Team",
  "Application API, webhooks, and thin SDKs on top of the same domains",
  "Export (.mbox / JSON) and operational UX founders expect",
];

const FAQS = [
  {
    q: "Does Flap hide that it uses SES?",
    a: "No. Customer mail runs on Amazon SES; the app runs on Cloudflare. We document that on Security and About.",
  },
  {
    q: "When should I use SES directly?",
    a: "When you are building your own mail product or already have inbox, identity, and onboarding infrastructure. For “many domains → one inbox → correct From,” Flap is the buy side of build-vs-buy.",
  },
  {
    q: "Is Flap attacking AWS?",
    a: "No. SES is excellent mail infrastructure. Flap is the product layer on top for multi-domain founders.",
  },
];

export default function WhyNotSesPage() {
  useEffect(() => {
    setPageMeta({
      title: "Why not Amazon SES alone? | Flap",
      description:
        "Flap uses Amazon SES for customer mail. Here is what the Flap product layer adds: inbox, identities, reply-from, onboarding, and API — without attacking AWS.",
      path: PATH,
    });
    trackOnce("why_not_ses", "seo_page_view", { path: PATH });
    setJsonLdBundle(
      entityGraphLd([
        webPageLd({
          path: PATH,
          title: "Why not Amazon SES alone?",
          description: "Build-vs-buy: SES as the pipe, Flap as multi-domain inbox product.",
          dateModified: UPDATED,
        }),
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Why not Amazon SES", path: PATH },
        ]),
      ]),
    );
    return () => clearJsonLdHelpers();
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cta)]">Build vs buy</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Why not use Amazon SES directly?
        </h1>
        <LastUpdated date={UPDATED} />
        <DefinitionBox>
          SES is the mail pipe. Flap is the product: many domains, one inbox, correct sender identity, and founder-ready
          setup. We use SES on purpose — we do not pretend to replace AWS.
        </DefinitionBox>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">What SES gives you</h2>
          <p>
            Amazon SES is excellent at delivering and receiving mail at scale once identities, DNS, and bounce handling
            are configured. Technical founders can absolutely wire SES themselves.
          </p>
          <p>
            What SES does not give you out of the box is a multi-domain founder inbox: mailboxes, threading, reply-from
            safety, shared inboxes, and a coherent UI across every project domain.
          </p>
        </section>

        <section className="mt-10 space-y-4 text-[15px] leading-relaxed text-[var(--muted)]">
          <h2 className="text-xl font-semibold text-[var(--fg)]">What Flap adds on top</h2>
          <ul className="list-disc space-y-2 pl-5">
            {PRODUCT_LAYER.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <ComparisonTable
          caption="SES alone vs Flap (honest)"
          headers={["Capability", "SES alone", "Flap"]}
          rows={[
            ["DNS onboarding UX", "Console / DIY", "Guided records + Check DNS"],
            ["Unified inbox UI", "Build it", "Included webmail"],
            ["Reply-from identity", "DIY mapping", "Receiving mailbox selected"],
            ["Team / shared mailboxes", "DIY", "Pro / Team plans"],
            ["App hosting", "Your stack", MAIL_ARCHITECTURE.app_host],
            ["Customer mail transport", "SES", MAIL_ARCHITECTURE.inbound_provider],
          ]}
        />

        <FaqBlock faqs={FAQS} />

        <div className="mt-10 flex flex-wrap gap-3">
          <Button onClick={() => go("/signup")}>Start free</Button>
          <Button variant="outline" onClick={() => go("/security")}>
            Security & architecture
          </Button>
          <Button variant="outline" onClick={() => go("/migrate")}>
            Migration guide
          </Button>
        </div>

        <ArticleCtas source="why_not_ses" />
      </article>
    </MarketingShell>
  );
}
