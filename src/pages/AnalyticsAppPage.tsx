import { useEffect, useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { api, type BillingSubscription, type Domain } from "../lib/api";
import { go } from "../lib/nav";
import { PLANS, type PlanId } from "../../shared/plans";

function pct(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function UsageRow({
  label,
  used,
  limit,
  format = (n) => n.toLocaleString(),
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const p = pct(used, limit);
  const unlimited = !Number.isFinite(limit) || limit >= 1_000_000_000;
  return (
    <div className="analytics-usage-row">
      <div className="analytics-usage-head">
        <strong>{label}</strong>
        <span className="muted">
          {unlimited ? format(used) : `${format(used)} / ${format(limit)}`}
        </span>
      </div>
      {!unlimited ? (
        <progress className="usage-progress" aria-label={`${label} usage`} value={used} max={Math.max(1, limit)} />
      ) : null}
      {!unlimited ? <p className="muted text-sm mt-2">{p}% used</p> : null}
    </div>
  );
}

export default function AnalyticsAppPage() {
  const [bill, setBill] = useState<BillingSubscription | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxCount, setMailboxCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.billingSubscription(),
      api.domains().catch(() => ({ domains: [] as Domain[] })),
      api.me().catch(() => null),
    ])
      .then(([subscription, domainRes, me]) => {
        setBill(subscription);
        setDomains(domainRes.domains || []);
        setMailboxCount((me?.mailboxes || []).length);
      })
      .catch(() => setError("Usage could not be loaded. Refresh the page to try again."))
      .finally(() => setLoading(false));
  }, []);

  const planId = (bill?.plan_id || "free") as PlanId;
  const plan = PLANS[planId] || PLANS.free;
  const usage = bill?.usage || {};
  const sendsUsed = Number(usage.sends_this_month ?? usage.sends ?? 0);
  const domainsUsed = Number(usage.domains ?? domains.length);
  const mailboxesUsed = Number(usage.mailboxes ?? mailboxCount);
  const aliasesUsed = Number(usage.aliases ?? 0);
  const storageUsed = Number(usage.storage_bytes ?? 0);
  const readyDomains = domains.filter((d) => d.receiving_ready_at).length;

  return (
    <AppFeaturePage
      current="analytics"
      title="Analytics"
      subtitle="Plan capacity, sending, and workspace footprint for the current month."
      actions={
        <Button type="button" variant="secondary" onClick={() => go("/app/billing")}>
          Manage billing
        </Button>
      }
    >
      {error ? <p role="alert" className="error mb-4">{error}</p> : null}
      {loading ? <p className="muted mb-4">Loading usage…</p> : null}

      <div className="app-feature-stats">
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Plan</p>
          <p className="text-2xl font-semibold">{plan.name}</p>
          <p className="muted text-sm mt-1 capitalize">{bill?.status || "—"}</p>
        </div>
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Sends this month</p>
          <p className="text-2xl font-semibold">
            {sendsUsed.toLocaleString()}
            <span className="muted text-base font-normal"> / {plan.limits.send_per_month.toLocaleString()}</span>
          </p>
        </div>
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Domains ready</p>
          <p className="text-2xl font-semibold">
            {readyDomains}
            <span className="muted text-base font-normal"> / {domains.length}</span>
          </p>
        </div>
        <div className="app-feature-card">
          <p className="muted text-xs uppercase tracking-wide">Mailboxes</p>
          <p className="text-2xl font-semibold">{mailboxesUsed.toLocaleString()}</p>
        </div>
      </div>

      <section className="app-feature-card mt-6">
        <h2>Monthly allowance</h2>
        <p className="muted mb-4">
          Send counters reset each UTC calendar month
          {bill?.quota_reset === "utc_calendar_month" ? "" : ""}.
        </p>
        <div className="analytics-usage-stack">
          <UsageRow label="Outbound sends" used={sendsUsed} limit={plan.limits.send_per_month} />
          <UsageRow label="Domains" used={domainsUsed} limit={plan.limits.domains} />
          <UsageRow label="Mailboxes" used={mailboxesUsed} limit={plan.limits.mailboxes} />
          <UsageRow label="Aliases" used={aliasesUsed} limit={plan.limits.aliases} />
          <UsageRow
            label="Storage"
            used={storageUsed}
            limit={plan.limits.storage_bytes}
            format={formatBytes}
          />
        </div>
      </section>

      <section className="app-feature-card mt-6">
        <h2>Quick links</h2>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button type="button" variant="secondary" onClick={() => go("/app/newsletters")}>
            Newsletters
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/app/domains")}>
            Domains
          </Button>
          <Button type="button" variant="secondary" onClick={() => go("/app/mailboxes")}>
            Mailboxes
          </Button>
          <Button type="button" variant="outline" onClick={() => go("/app/billing")}>
            Upgrade plan
          </Button>
        </div>
      </section>
    </AppFeaturePage>
  );
}
