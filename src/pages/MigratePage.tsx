import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { ArticleCtas, DefinitionBox, FaqBlock, LastUpdated } from "../components/MarketingArticle";
import { track, trackOnce } from "../lib/analytics";
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
import { setupStepsShort } from "../../shared/product-facts";

const PATH = "/migrate";
const UPDATED = "2026-09-08";

const STEPS = [
  {
    title: "1. Add and verify the domain in Flap first",
    body: "Create the domain in Settings, publish MX/SPF/DKIM at your current DNS host, and wait until Flap shows the domain as verified / receiving-ready. Do not flip MX away from your old provider until this works.",
  },
  {
    title: "2. Create addresses and test outbound",
    body: "Create the mailboxes you need (hello@, support@). Send a test from Flap to an external account to confirm SES sending and DKIM look correct.",
  },
  {
    title: "3. Optional: keep old mail available",
    body: "Flap does not auto-import IMAP, Google Takeout, or full mailbox history today. If you need archives, export .mbox / EML from your current provider and keep that copy offline. Ongoing Flap mail can be exported later as .mbox or JSON from Settings.",
  },
  {
    title: "4. Switch MX at the cutover point",
    body: "When verification and outbound tests pass, change MX to the Flap-provided Amazon SES values. Propagation can take minutes to hours. Website A/AAAA records are unrelated — MX only moves email delivery.",
  },
  {
    title: "5. Rollback if needed",
    body: "If something looks wrong, restore the previous MX records at your DNS host. Keep Flap DNS guidance open so you can re-apply when ready. Domains that previously used Cloudflare Email Routing can migrate to the current SES path from Settings when prompted.",
  },
  {
    title: "6. Leave path",
    body: "Export JSON workspace backup and per-mailbox .mbox anytime. After cancel, paid accounts keep an export window. Being easy to leave is intentional.",
  },
];

const FAQS = [
  {
    q: "Can Flap import my Gmail or Workspace archive?",
    a: "Not automatically. Export from Google Takeout or your provider if you need historical mail, then use Flap for new mail after MX cutover.",
  },
  {
    q: "Will switching MX break my website?",
    a: "No. MX controls mail delivery only. Keep your existing website DNS records.",
  },
  {
    q: "What about Cloudflare Email Routing?",
    a: "Routing is a forwarder. When you need a real inbox and reply-from identity, migrate to Flap’s SES path: verify in Flap, then point MX as shown. Legacy Routing domains can migrate from Settings.",
  },
  {
    q: "Can I export if I leave Flap?",
    a: "Yes — JSON backup and .mbox from Settings. Restore merges contacts, templates, signatures, and rules; message history is export-oriented.",
  },
];

export default function MigratePage() {
  useEffect(() => {
    setPageMeta({
      title: "Migrate to Flap | Custom-domain email cutover",
      description:
        "How to move custom-domain email to Flap: verify DNS first, test send, switch MX, rollback, and export. Honest about what is (and is not) automated.",
      path: PATH,
    });
    trackOnce("migrate_page", "migration_page_view", { path: PATH });
    setJsonLdBundle(
      entityGraphLd([
        webPageLd({
          path: PATH,
          title: "Migrate to Flap",
          description: "Domain-first migration narrative for custom-domain email cutover.",
          dateModified: UPDATED,
        }),
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Migrate", path: PATH },
        ]),
      ]),
    );
    return () => clearJsonLdHelpers();
  }, []);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--cta)]">Migration</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight md:text-4xl">
          Migrate to Flap without guessing the MX cutover
        </h1>
        <LastUpdated date={UPDATED} />
        <DefinitionBox>
          Verify the domain in Flap and test send/receive before you change MX. Flap exports .mbox and JSON; it does not
          silently IMAP-import your old provider today.
        </DefinitionBox>

        <p className="mt-8 text-[15px] leading-relaxed text-[var(--muted)]">{setupStepsShort()}</p>

        <ol className="mt-10 space-y-8">
          {STEPS.map((s) => (
            <li key={s.title} className="list-none">
              <h2 className="text-xl font-semibold text-[var(--fg)]">{s.title}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{s.body}</p>
            </li>
          ))}
        </ol>

        <FaqBlock faqs={FAQS} />

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            onClick={() => {
              track("cta_connect_domain", { source: "migrate" });
              track("signup_clicked", { source: "migrate" });
              go("/signup");
            }}
          >
            Connect your first domain
          </Button>
          <Button variant="outline" onClick={() => go("/guides")}>
            DNS guides
          </Button>
          <Button variant="outline" onClick={() => go("/security")}>
            Security & export
          </Button>
        </div>

        <ArticleCtas source="migrate" />
      </article>
    </MarketingShell>
  );
}
