import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  Check,
  Globe2,
  Inbox,
  Lock,
  Mail,
  Megaphone,
  Rocket,
} from "lucide-react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";
import { tw } from "../lib/tw";
import { cn } from "../lib/utils";

type StepId = "domain" | "dns" | "mailbox" | "test" | "calendar" | "newsletters" | "api";

type StepState = "recommended" | "ready" | "blocked" | "done";

type Progress = {
  domain: boolean;
  dns: boolean;
  mailbox: boolean;
  test: boolean;
  activated: boolean;
};

type ChecklistItem = {
  id: StepId;
  group: string;
  label: string;
  help: string;
  href: string;
  cta: string;
  icon: typeof Globe2;
  needs?: Array<"domain" | "mailbox">;
  recommendedWhen?: (p: Progress) => boolean;
};

const ITEMS: ChecklistItem[] = [
  {
    id: "domain",
    group: "Set up your email",
    label: "Add a domain",
    help: "Connect any domain you already own. Flap does not sell domains.",
    href: "/app/domains?onboarding=1",
    cta: "Add domain",
    icon: Globe2,
    recommendedWhen: (p) => !p.domain,
  },
  {
    id: "dns",
    group: "Set up your email",
    label: "Publish DNS records",
    help: "Copy MX, SPF, and DKIM into your registrar.",
    href: "/app/domains?onboarding=1",
    cta: "Open DNS checklist",
    icon: Rocket,
    needs: ["domain"],
    recommendedWhen: (p) => p.domain && !p.dns,
  },
  {
    id: "mailbox",
    group: "Set up your email",
    label: "Create an address",
    help: "Try you@, hello@, or support@ — no extra DNS after the domain is live.",
    href: "/app/mailboxes",
    cta: "Create address",
    icon: Mail,
    needs: ["domain"],
    recommendedWhen: (p) => p.domain && !p.mailbox,
  },
  {
    id: "test",
    group: "Set up your email",
    label: "Send & receive a test",
    help: "Mail yourself from another account, then reply from Flap.",
    href: "/app",
    cta: "Open inbox",
    icon: Inbox,
    needs: ["domain", "mailbox"],
    recommendedWhen: (p) => p.mailbox && !p.test,
  },
  {
    id: "calendar",
    group: "Automate your replies",
    label: "Open calendar",
    help: "See your week alongside mail once an address exists.",
    href: "/app/calendar",
    cta: "Open calendar",
    icon: CalendarDays,
    needs: ["mailbox"],
  },
  {
    id: "newsletters",
    group: "Automate your replies",
    label: "Draft a newsletter",
    help: "Audiences and queued sends are MVP — domain required.",
    href: "/app/newsletters",
    cta: "Open newsletters",
    icon: Megaphone,
    needs: ["domain"],
  },
  {
    id: "api",
    group: "For developers",
    label: "Create an API key",
    help: "Live and test keys live under Developer. Test mode never sends externally.",
    href: "/app/developer",
    cta: "Open developer",
    icon: BookOpen,
    needs: ["mailbox"],
  },
];

const EXPLORE = [
  {
    title: "Bookings",
    body: "Share a scheduling page for calls and demos.",
    href: "/app/bookings",
    icon: CalendarDays,
  },
  {
    title: "AI assistant",
    body: "Opt-in drafts and summaries — you stay in control of send.",
    href: "/app/ai",
    icon: Bot,
  },
] as const;

function emptyProgress(): Progress {
  return { domain: false, dns: false, mailbox: false, test: false, activated: false };
}

function resolveState(item: ChecklistItem, progress: Progress): StepState {
  if (item.id === "domain" || item.id === "dns" || item.id === "mailbox" || item.id === "test") {
    if (progress[item.id]) return "done";
  }
  const missing = (item.needs || []).filter((n) => !progress[n]);
  if (missing.length) return "blocked";
  if (item.recommendedWhen?.(progress)) return "recommended";
  return "ready";
}

function needsChip(need: "domain" | "mailbox"): string {
  return need === "domain" ? "needs domain" : "needs mailbox";
}

export default function GetStartedAppPage() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [domainCount, setDomainCount] = useState(0);
  const [mailboxCount, setMailboxCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.me().catch(() => null),
      api.domains().catch(() => ({ domains: [] })),
      api.activation().catch(() => null),
    ])
      .then(([me, domainsRes, activation]) => {
        if (cancelled) return;
        const domains = domainsRes.domains;
        const domain = domains.length > 0;
        const dns = domains.some((d) => Boolean(d.mx_verified_at && d.identity_verified_at));
        const mailbox = (me?.mailboxes || []).length > 0;
        const test = Boolean(
          activation?.steps?.first_email_sent || activation?.steps?.first_email_received,
        );
        setDomainCount(domains.length);
        setMailboxCount((me?.mailboxes || []).length);
        setProgress({
          domain,
          dns,
          mailbox,
          test,
          activated: Boolean(activation?.activated) || (domain && test),
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enriched = useMemo(
    () => ITEMS.map((item) => ({ item, state: resolveState(item, progress) })),
    [progress],
  );

  const coreDone = useMemo(
    () => (["domain", "dns", "mailbox", "test"] as const).filter((id) => progress[id]).length,
    [progress],
  );

  const recommendedCount = enriched.filter((e) => e.state === "recommended").length;
  const groups = useMemo(() => {
    const order = ["Set up your email", "Automate your replies", "For developers"];
    return order.map((name) => ({
      name,
      rows: enriched.filter((e) => e.item.group === name),
    }));
  }, [enriched]);

  const headerStatus = loading
    ? "Checking your setup…"
    : `${recommendedCount} recommended · ${coreDone} of 4 done`;

  return (
    <AppFeaturePage
      current="get-started"
      title="Get started"
      subtitle="Steps unlock as dependencies clear."
      actions={
        !loading && recommendedCount > 0 ? (
          <Button
            type="button"
            onClick={() => {
              const next = enriched.find((e) => e.state === "recommended");
              if (next) go(next.item.href);
            }}
          >
            Continue setup
          </Button>
        ) : !loading ? (
          <Button type="button" onClick={() => go("/app")}>
            Go to inbox
          </Button>
        ) : null
      }
    >
      <section className={tw.appFeatureCard} aria-live="polite">
        <div className="flex items-start justify-between gap-4 max-md:flex-col">
          <div>
            <p className={cn("mb-1 text-xs tracking-wide uppercase", tw.muted)}>Setup progress</p>
            <p className="m-0 text-[1.05rem] font-medium">{headerStatus}</p>
            {!loading ? (
              <p className={cn("mt-1 text-xs", tw.muted)}>
                {domainCount} domain{domainCount === 1 ? "" : "s"} · {mailboxCount} mailbox
                {mailboxCount === 1 ? "" : "es"}
              </p>
            ) : null}
          </div>
          <div aria-hidden={loading}>
            <span className="font-mono text-xl font-semibold text-[var(--foreground)]">{loading ? "—" : `${coreDone}/4`}</span>
          </div>
        </div>
        <div
          className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-hover)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={loading ? 0 : coreDone}
          aria-label="Core setup steps completed"
        >
          <span className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${loading ? 0 : (coreDone / 4) * 100}%` }} />
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.name} className="mt-8" aria-labelledby={`gs-${group.name}`}>
          <h2 id={`gs-${group.name}`} className="m-0 text-[1.1rem] font-semibold">
            {group.name}
          </h2>
          <ul className="mt-3 grid list-none gap-2.5 p-0" aria-label={group.name}>
            {group.rows.map(({ item, state }) => {
              const Icon = state === "blocked" ? Lock : item.icon;
              const missing = (item.needs || []).filter((n) => !progress[n]);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-[18px] py-4",
                    state === "done" && "opacity-90",
                    state === "recommended" && "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] shadow-[inset_3px_0_0_var(--accent)]",
                    state === "blocked" && "bg-[color-mix(in_srgb,var(--surface-hover)_55%,var(--surface))] opacity-70",
                  )}
                >
                  <div
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-[7px] bg-[var(--surface-hover)] font-mono text-xs font-bold text-[var(--foreground-muted)]",
                      state === "recommended" && "bg-[var(--accent)] text-[var(--accent-fg)]",
                      state === "done" && "bg-[rgb(var(--accent-rgb)/0.18)] text-[var(--accent)]",
                    )}
                    aria-hidden
                  >
                    {state === "done" ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} strokeWidth={2} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-2 [&_strong]:text-[0.98rem] [&_strong]:font-semibold">
                        <strong>{item.label}</strong>
                      </div>
                      <Badge
                        variant={
                          state === "recommended"
                            ? "default"
                            : state === "done"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {state === "recommended"
                          ? "Recommended"
                          : state === "ready"
                            ? "Ready"
                            : state === "blocked"
                              ? "Blocked"
                              : "Done"}
                      </Badge>
                    </div>
                    <p className={tw.muted}>{loading ? "…" : item.help}</p>
                    {missing.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {missing.map((n) => (
                          <span key={n} className="inline-flex items-center rounded-md border border-[var(--line)] bg-[var(--surface-hover)] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--foreground-muted)]">
                            {needsChip(n)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {state === "recommended" && !loading ? (
                      <Button className="mt-3" type="button" onClick={() => go(item.href)}>
                        {item.cta}
                      </Button>
                    ) : null}
                    {state === "ready" && !loading ? (
                      <Button className="mt-3" type="button" variant="secondary" onClick={() => go(item.href)}>
                        {item.cta}
                      </Button>
                    ) : null}
                    {state === "done" ? (
                      <button type="button" className="mt-2 cursor-pointer border-0 bg-transparent p-0 text-[13px] text-[var(--accent)] underline" onClick={() => go(item.href)}>
                        Review
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-8" aria-labelledby="get-started-explore-title">
        <h2 id="get-started-explore-title" className="m-0 text-[1.1rem] font-semibold">
          Explore your workspace
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
          {EXPLORE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-4 text-left text-inherit hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:bg-[var(--surface-hover)]"
                onClick={() => go(item.href)}
              >
                <span className="mb-1 grid h-8 w-8 place-items-center rounded-[7px] bg-[var(--surface-hover)] text-[var(--foreground)]" aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <strong>{item.title}</strong>
                <span className={tw.muted}>{item.body}</span>
              </button>
            );
          })}
        </div>
      </section>
    </AppFeaturePage>
  );
}
