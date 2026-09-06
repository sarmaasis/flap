import { useEffect } from "react";
import MarketingShell from "../components/MarketingShell";
import { LastUpdated } from "../components/MarketingArticle";
import { PLANS } from "../../shared/plans";
import { go } from "../lib/nav";
import { setPageMeta } from "../lib/seo";
import { Button } from "../components/ui/button";

export default function ResearchPage({ path }: { path: string }) {
  useEffect(() => {
    setPageMeta({
      title: "Business email cost research | Flap",
      description: "Methodology and 2026 cost table for Workspace, Shipmail sticker prices, and Flap plans.",
      path: path.startsWith("/research") ? path : "/research",
    });
  }, [path]);

  return (
    <MarketingShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-10 md:px-8 md:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--cta)]">Research</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Business email cost, 2026</h1>
        <LastUpdated date="2026-09-07" />
        <p className="mt-5 text-[var(--muted)]">
          Illustrative USD list prices for founders comparing suites vs email-only hosts. Shipmail figures cited
          from shipmail.to/pricing (verified 2026-09-07). Flap figures from shared/plans.ts.
        </p>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Entry paid</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-[var(--muted)]">
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-3">Google Workspace</td>
                <td className="py-2 pr-3">~$7/user/mo</td>
                <td className="py-2">Scales by seats × environments</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-3">Shipmail Solo</td>
                <td className="py-2 pr-3">$4/mo</td>
                <td className="py-2">2 mailboxes; up to 50 domains</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-3">Flap Solo</td>
                <td className="py-2 pr-3">${PLANS.solo.price_monthly}/mo</td>
                <td className="py-2">{PLANS.solo.limits.domains} domains, {PLANS.solo.limits.mailboxes} mailboxes</td>
              </tr>
              <tr className="border-b border-[var(--line)]">
                <td className="py-2 pr-3">Flap Pro</td>
                <td className="py-2 pr-3">${PLANS.pro.price_monthly}/mo</td>
                <td className="py-2">Highlighted; {PLANS.pro.limits.team_seats} seats</td>
              </tr>
              <tr>
                <td className="py-2 pr-3">Flap Team</td>
                <td className="py-2 pr-3">${PLANS.team.price_monthly}/mo</td>
                <td className="py-2">{PLANS.team.limits.domains} domains, shared inboxes</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2 className="mt-10 text-xl font-semibold">Methodology</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Compare sticker prices only. Deliverability, protocol support, and suite apps change total cost of ownership.
          Flap does not claim Shipmail's IMAP/newsletter surface until those flags flip.
        </p>
        <Button className="mt-8" variant="outline" onClick={() => go("/tools/google-workspace-cost-calculator")}>
          Open cost calculator
        </Button>
      </article>
    </MarketingShell>
  );
}
