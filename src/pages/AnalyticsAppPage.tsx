import { useEffect, useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { PLANS } from "../../shared/plans";

export default function AnalyticsAppPage() {
  const [planName, setPlanName] = useState("—");
  const [error, setError] = useState("");
  const [sends, setSends] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    api
      .billingSubscription()
      .then((bill) => {
        const id = (bill.plan_id || "free") as keyof typeof PLANS;
        const plan = PLANS[id] || PLANS.free;
        setPlanName(plan.name);
        setSends({
          used: Number(bill.usage?.sends_this_month ?? bill.usage?.sends ?? 0),
          limit: plan.limits.send_per_month,
        });
      })
      .catch(() => setError("Usage could not be loaded. Refresh the page to try again."));
  }, []);

  return (
    <AppFeaturePage
      current="analytics"
      title="Analytics"
      subtitle="Keep an eye on your monthly email usage and plan capacity."
      actions={
        <Button type="button" variant="secondary" onClick={() => go("/app/billing")}>
          Billing
        </Button>
      }
    >
      {error && <p role="alert" className="error mb-4">{error}</p>}
      <div className="app-feature-stats">
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Plan</p>
          <p className="text-2xl font-semibold">{planName}</p>
        </div>
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Sends this month</p>
          <p className="text-2xl font-semibold">
            {sends ? `${sends.used.toLocaleString()} / ${sends.limit.toLocaleString()}` : "—"}
          </p>
        </div>
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Newsletters</p>
          <p className="text-2xl font-semibold">Your campaigns</p>
          <Button className="mt-3" size="sm" type="button" onClick={() => go("/app/newsletters")}>
            View newsletters
          </Button>
        </div>
      </div>
      {sends && <section className="app-feature-card mt-6"><h2>Monthly sending allowance</h2><p className="muted">{Math.max(0, sends.limit - sends.used).toLocaleString()} sends remaining this month</p><progress className="usage-progress" aria-label="Monthly sending allowance used" value={sends.used} max={Math.max(1, sends.limit)} /><p className="muted text-sm mt-3">{Math.round(sends.used / Math.max(1, sends.limit) * 100)}% used</p></section>}
    </AppFeaturePage>
  );
}
