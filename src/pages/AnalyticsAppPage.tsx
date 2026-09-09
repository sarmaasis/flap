import { useEffect, useMemo, useState } from "react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Button } from "../components/ui/button";
import { SegmentedControl } from "../components/ui/segmented-control";
import { StatCard } from "../components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { api, type BillingSubscription, type DeliveryEventLogRow, type Domain } from "../lib/api";
import { go } from "../lib/nav";
import { PLANS, type PlanId } from "../../shared/plans";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

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

function formatRate(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDay(key: string) {
  const [, m, d] = key.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function UsageBar({
  label,
  used,
  limit,
  format = (n) => n.toLocaleString(),
  color = "var(--accent)",
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
  color?: string;
}) {
  const unlimited = !Number.isFinite(limit) || limit >= 1_000_000_000;
  const p = unlimited ? 0 : pct(used, limit);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <strong className="font-medium text-[var(--foreground)]">{label}</strong>
        <span className="font-mono text-xs text-[var(--foreground-muted)]">
          {unlimited ? format(used) : `${format(used)} / ${format(limit)}`}
          {!unlimited ? <span className="ml-2 text-[var(--foreground-faint)]">{p}%</span> : null}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-hover)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${unlimited ? 8 : Math.max(p, used > 0 ? 3 : 0)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function EventsTrendChart({ events }: { events: DeliveryEventLogRow[] }) {
  const series = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(dayKey(d.getTime()));
    }
    const bounce = Object.fromEntries(days.map((k) => [k, 0]));
    const complaint = Object.fromEntries(days.map((k) => [k, 0]));
    const soft = Object.fromEntries(days.map((k) => [k, 0]));
    const delivered = Object.fromEntries(days.map((k) => [k, 0]));
    for (const ev of events) {
      const k = dayKey(ev.created_at);
      if (!(k in bounce)) continue;
      if (ev.kind === "complaint") complaint[k] += 1;
      else if (ev.kind === "soft_bounce") soft[k] += 1;
      else if (ev.kind === "bounce" || ev.kind === "reject") bounce[k] += 1;
      else if (ev.kind === "delivery" || ev.kind === "send") delivered[k] += 1;
    }
    const totals = days.map((k) => bounce[k] + complaint[k] + soft[k] + delivered[k]);
    const max = Math.max(1, ...totals);
    return { days, bounce, complaint, soft, delivered, max, totals };
  }, [events]);

  const w = 560;
  const h = 180;
  const pad = { t: 16, r: 8, b: 28, l: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const gap = 4;
  const barW = (innerW - gap * (series.days.length - 1)) / series.days.length;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-w-[420px]" role="img" aria-label="Delivery events over the last 14 days">
        {[0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.t + innerH * (1 - t);
          return (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 3} textAnchor="end" className="fill-[var(--foreground-faint)]" fontSize="10">
                {Math.round(series.max * t)}
              </text>
            </g>
          );
        })}
        {series.days.map((day, i) => {
          const x = pad.l + i * (barW + gap);
          const b = series.bounce[day];
          const c = series.complaint[day];
          const s = series.soft[day];
          const d = series.delivered[day];
          const total = b + c + s + d;
          const scale = (n: number) => (n / series.max) * innerH;
          let y = pad.t + innerH;
          const segments = [
            { n: d, fill: "var(--chart-new)" },
            { n: b, fill: "var(--chart-churned)" },
            { n: s, fill: "var(--chart-contraction)" },
            { n: c, fill: "var(--chart-reactivation)" },
          ];
          return (
            <g key={day}>
              {segments.map((seg) => {
                if (!seg.n) return null;
                const hh = scale(seg.n);
                y -= hh;
                return <rect key={seg.fill} x={x} y={y} width={barW} height={Math.max(hh, 1)} rx={2} fill={seg.fill} opacity={0.9} />;
              })}
              {i % 2 === 0 || i === series.days.length - 1 ? (
                <text x={x + barW / 2} y={h - 8} textAnchor="middle" className="fill-[var(--foreground-faint)]" fontSize="9">
                  {shortDay(day)}
                </text>
              ) : null}
              {total > 0 ? (
                <title>{`${shortDay(day)}: ${d} delivered/sent, ${b} bounce, ${s} soft, ${c} complaint`}</title>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--foreground-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-new)]" /> Sent / delivered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-churned)]" /> Bounce
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-contraction)]" /> Soft
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-reactivation)]" /> Complaint
        </span>
      </div>
    </div>
  );
}

function ReputationDonut({
  bounceRate,
  complaintRate,
}: {
  bounceRate: number;
  complaintRate: number;
}) {
  const bounce = Math.min(100, bounceRate * 100);
  const complaint = Math.min(100, complaintRate * 100);
  const healthy = Math.max(0, 100 - bounce - complaint);
  const r = 54;
  const c = 2 * Math.PI * r;
  const parts = [
    { value: healthy, color: "var(--chart-new)" },
    { value: bounce, color: "var(--chart-churned)" },
    { value: complaint, color: "var(--chart-reactivation)" },
  ];
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="shrink-0" role="img" aria-label="Sending health mix">
        <g transform="translate(70 70) rotate(-90)">
          {parts.map((part) => {
            const len = (part.value / 100) * c;
            const el = (
              <circle
                key={part.color}
                r={r}
                fill="none"
                stroke={part.color}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="fill-[var(--foreground)]" fontSize="20" fontWeight="700">
          {(healthy).toFixed(0)}%
        </text>
        <text x="70" y="86" textAnchor="middle" className="fill-[var(--foreground-muted)]" fontSize="11">
          clean
        </text>
      </svg>
      <ul className="m-0 list-none space-y-2 p-0 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-new)]" />
          Clean sends <span className="text-[var(--foreground-muted)]">{healthy.toFixed(2)}%</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-churned)]" />
          Bounce <span className="text-[var(--foreground-muted)]">{formatRate(bounceRate)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-reactivation)]" />
          Complaint <span className="text-[var(--foreground-muted)]">{formatRate(complaintRate)}</span>
        </li>
      </ul>
    </div>
  );
}

export default function AnalyticsAppPage() {
  const [bill, setBill] = useState<BillingSubscription | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [mailboxCount, setMailboxCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<DeliveryEventLogRow[]>([]);
  const [allEvents, setAllEvents] = useState<DeliveryEventLogRow[]>([]);
  const [eventKind, setEventKind] = useState("all");
  const [reputation, setReputation] = useState<{
    bounce_rate: number;
    complaint_rate: number;
    suppressed_count: number;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.billingSubscription(),
      api.domains().catch(() => ({ domains: [] as Domain[] })),
      api.me().catch(() => null),
      api.sendingReputation().catch(() => null),
      api.deliveryEvents().catch(() => ({ events: [] as DeliveryEventLogRow[], retention_days: 30 })),
    ])
      .then(([subscription, domainRes, me, rep, deliv]) => {
        setBill(subscription);
        setDomains(domainRes.domains || []);
        setMailboxCount((me?.mailboxes || []).length);
        if (rep) {
          setReputation({
            bounce_rate: rep.bounce_rate,
            complaint_rate: rep.complaint_rate,
            suppressed_count: rep.suppressed_count,
          });
        }
        const list = deliv.events || [];
        setAllEvents(list);
        setEvents(list);
      })
      .catch(() => setError("Usage could not be loaded. Refresh the page to try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void api
      .deliveryEvents(eventKind === "all" ? undefined : eventKind)
      .then((r) => setEvents(r.events || []))
      .catch(() => undefined);
  }, [eventKind]);

  const planId = (bill?.plan_id || "free") as PlanId;
  const plan = PLANS[planId] || PLANS.free;
  const usage = bill?.usage || {};
  const sendsUsed = Number(usage.sends_this_month ?? usage.send_per_month ?? usage.sends ?? 0);
  const domainsUsed = Number(usage.domains ?? domains.length);
  const mailboxesUsed = Number(usage.mailboxes ?? mailboxCount);
  const aliasesUsed = Number(usage.aliases ?? 0);
  const storageUsed = Number(usage.storage_bytes ?? 0);
  const readyDomains = domains.filter((d) => d.receiving_ready_at).length;

  return (
    <AppFeaturePage
      current="analytics"
      title="Analytics"
      subtitle="Capacity, reputation, and delivery trends for this workspace."
      actions={
        <Button type="button" variant="secondary" onClick={() => go("/app/billing")}>
          Manage billing
        </Button>
      }
    >
      {error ? <p role="alert" className={cn("mb-4", tw.error)}>{error}</p> : null}
      {loading ? <p className={cn("mb-4", tw.muted)}>Loading usage…</p> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sent" value={sendsUsed.toLocaleString()} period="This month" />
        <StatCard
          label="Bounce rate"
          value={reputation ? formatRate(reputation.bounce_rate) : "—"}
          period="Last 30d"
          comparisonTone={reputation && reputation.bounce_rate > 0.02 ? "down" : "neutral"}
        />
        <StatCard
          label="Complaint rate"
          value={reputation ? formatRate(reputation.complaint_rate) : "—"}
          period="Last 30d"
        />
        <StatCard
          label="Suppressed"
          value={reputation ? reputation.suppressed_count.toLocaleString() : "—"}
          period="Active addresses"
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <section className={cn(tw.appFeatureCard, "lg:col-span-3")}>
          <div className="mb-4">
            <h2>Delivery trend</h2>
            <p className={tw.muted}>Events by day · last 14 days</p>
          </div>
          <EventsTrendChart events={allEvents} />
        </section>
        <section className={cn(tw.appFeatureCard, "lg:col-span-2")}>
          <div className="mb-4">
            <h2>Sending health</h2>
            <p className={tw.muted}>Share of clean vs problem rates</p>
          </div>
          {reputation ? (
            <ReputationDonut bounceRate={reputation.bounce_rate} complaintRate={reputation.complaint_rate} />
          ) : (
            <p className={tw.muted}>Reputation data unavailable yet.</p>
          )}
        </section>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className={tw.appFeatureCard}>
          <div className="mb-4">
            <h2>Plan capacity</h2>
            <p className={tw.muted}>
              {plan.name} · {bill?.status || "—"} · counters reset each UTC month
            </p>
          </div>
          <div className="space-y-5">
            <UsageBar label="Outbound sends" used={sendsUsed} limit={plan.limits.send_per_month} color="var(--accent)" />
            <UsageBar label="Domains" used={domainsUsed} limit={plan.limits.domains} color="var(--chart-expansion)" />
            <UsageBar label="Mailboxes" used={mailboxesUsed} limit={plan.limits.mailboxes} color="var(--chart-new)" />
            <UsageBar label="Aliases" used={aliasesUsed} limit={plan.limits.aliases} color="var(--chart-contraction)" />
            <UsageBar
              label="Storage"
              used={storageUsed}
              limit={plan.limits.storage_bytes}
              format={formatBytes}
              color="var(--chart-reactivation)"
            />
          </div>
        </section>

        <section className={tw.appFeatureCard}>
          <div className="mb-4">
            <h2>Workspace snapshot</h2>
            <p className={tw.muted}>Ready domains and active mailboxes</p>
          </div>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs text-[var(--foreground-muted)]">Domains ready</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {readyDomains}
                <span className="text-base font-normal text-[var(--foreground-faint)]"> / {domains.length}</span>
              </p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs text-[var(--foreground-muted)]">Mailboxes</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{mailboxesUsed.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs text-[var(--foreground-muted)]">Storage used</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{formatBytes(storageUsed)}</p>
            </div>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <p className="text-xs text-[var(--foreground-muted)]">Plan</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{plan.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => go("/app/domains")}>
              Domains
            </Button>
            <Button type="button" variant="secondary" onClick={() => go("/app/newsletters")}>
              Newsletters
            </Button>
            <Button type="button" variant="outline" onClick={() => go("/app/billing")}>
              Upgrade plan
            </Button>
          </div>
        </section>
      </div>

      <section className={tw.appFeatureCard}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2>Delivery events</h2>
            <p className={tw.muted}>One row per recipient. Kept for 30 days.</p>
          </div>
          <SegmentedControl
            className="w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
            aria-label="Filter delivery events"
            value={eventKind}
            onChange={setEventKind}
            options={[
              { value: "all", label: "All" },
              { value: "bounce", label: "Bounce" },
              { value: "complaint", label: "Complaint" },
              { value: "soft_bounce", label: "Soft" },
            ]}
          />
        </div>
        {events.length === 0 ? (
          <p className={tw.muted}>No delivery events in this range.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recipient</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <TableRow key={ev.id}>
                  <TableCell className="font-mono text-xs">{ev.recipient_email}</TableCell>
                  <TableCell>{ev.kind}</TableCell>
                  <TableCell>{ev.provider || "—"}</TableCell>
                  <TableCell className="text-[var(--foreground-muted)]">
                    {new Date(ev.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </AppFeaturePage>
  );
}
