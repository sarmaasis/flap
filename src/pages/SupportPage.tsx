import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { SUPPORT_EMAIL } from "../content/marketing";
import { go } from "../lib/nav";
import { clearJsonLd, setJsonLd, setPageMeta, webPageLd } from "../lib/seo";
import { Button } from "../components/ui/button";

const PATH = "/support";

export default function SupportPage() {
  useEffect(() => {
    setPageMeta({
      title: "Support | Flap",
      description: `Contact Flap support at ${SUPPORT_EMAIL}. Billing, DNS setup, and account help for useflap.online.`,
      path: PATH,
    });
    setJsonLd(
      "support-page",
      webPageLd({
        title: "Support | Flap",
        description: `Email ${SUPPORT_EMAIL} for Flap help.`,
        path: PATH,
      }),
    );
    return () => clearJsonLd("support-page");
  }, []);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Support</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
          Get help
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)]">
          Email us for billing, DNS cutover, or account issues. We do not market “priority support” as a Free-plan
          feature — Studio includes priority handling in the plan card.
        </p>
        <p className="mt-6 text-base">
          <a className="font-semibold text-[var(--cta)] hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Email support</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/docs" onClick={(e) => { e.preventDefault(); go("/docs"); }}>Docs</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/guides" onClick={(e) => { e.preventDefault(); go("/guides"); }}>Guides</a>
          </Button>
        </div>
      </main>
    </MarketingShell>
  );
}
