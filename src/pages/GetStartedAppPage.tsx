import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  CalendarDays,
  Check,
  Globe2,
  Inbox,
  Mail,
  Megaphone,
  Rocket,
} from "lucide-react";
import AppFeaturePage from "../components/AppFeaturePage";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { api } from "../lib/api";
import { go } from "../lib/nav";

type StepId = "domain" | "dns" | "mailbox" | "test";

type Progress = {
  domain: boolean;
  dns: boolean;
  mailbox: boolean;
  test: boolean;
  activated: boolean;
};

const STEPS: Array<{
  id: StepId;
  label: string;
  help: string;
  href: string;
  cta: string;
  icon: typeof Globe2;
}> = [
  {
    id: "domain",
    label: "Add a domain",
    help: "Connect any domain you already own. Flap does not sell domains.",
    href: "/app/domains?onboarding=1",
    cta: "Add domain",
    icon: Globe2,
  },
  {
    id: "dns",
    label: "Publish DNS records",
    help: "Copy MX, SPF, and DKIM into your registrar. UI takes ~3 minutes; DNS usually 5–15.",
    href: "/app/domains?onboarding=1",
    cta: "Open DNS checklist",
    icon: Rocket,
  },
  {
    id: "mailbox",
    label: "Create an address",
    help: "Try you@, hello@, or support@ — no extra DNS after the domain is live.",
    href: "/app/mailboxes",
    cta: "Create address",
    icon: Mail,
  },
  {
    id: "test",
    label: "Send & receive a test",
    help: "Mail yourself from your phone or another account, then reply from Flap.",
    href: "/app",
    cta: "Open inbox",
    icon: Inbox,
  },
];

const EXPLORE = [
  {
    title: "Calendar",
    body: "See your week alongside mail and book focused blocks.",
    href: "/app/calendar",
    icon: CalendarDays,
  },
  {
    title: "Newsletters",
    body: "Draft campaigns and send from your verified domain.",
    href: "/app/newsletters",
    icon: Megaphone,
  },
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
  {
    title: "API docs",
    body: "Send mail, manage domains, and wire webhooks programmatically.",
    href: "/docs/api",
    icon: BookOpen,
  },
] as const;

function emptyProgress(): Progress {
  return { domain: false, dns: false, mailbox: false, test: false, activated: false };
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

  const completedCount = useMemo(
    () => STEPS.filter((s) => progress[s.id]).length,
    [progress],
  );

  const currentStepId = useMemo(() => {
    for (const s of STEPS) {
      if (!progress[s.id]) return s.id;
    }
    return null;
  }, [progress]);

  const statusLabel = loading
    ? "Checking your setup…"
    : progress.activated || completedCount === STEPS.length
      ? "You're set — mail is ready to use."
      : `${completedCount} of ${STEPS.length} complete`;

  function stepDetail(id: StepId): string {
    if (id === "domain" && progress.domain) {
      return `${domainCount} domain${domainCount === 1 ? "" : "s"} connected`;
    }
    if (id === "dns" && progress.dns) return "Identity and MX verified";
    if (id === "mailbox" && progress.mailbox) {
      return `${mailboxCount} address${mailboxCount === 1 ? "" : "es"} ready`;
    }
    if (id === "test" && progress.test) return "First send or receive recorded";
    return STEPS.find((s) => s.id === id)?.help ?? "";
  }

  function stepBadge(id: StepId): { label: string; variant: "default" | "secondary" | "outline" } {
    if (progress[id]) return { label: "Done", variant: "secondary" };
    if (id === currentStepId) return { label: "Next", variant: "default" };
    return { label: "Waiting", variant: "outline" };
  }

  return (
    <AppFeaturePage
      current="get-started"
      title="Get started"
      subtitle="Copy DNS in about three minutes. First successful mail usually takes 5–15 minutes while records propagate — then explore the rest of your workspace."
      actions={
        !loading && currentStepId ? (
          <Button type="button" onClick={() => go(STEPS.find((s) => s.id === currentStepId)!.href)}>
            Continue setup
          </Button>
        ) : !loading ? (
          <Button type="button" onClick={() => go("/app")}>
            Go to inbox
          </Button>
        ) : null
      }
    >
      <section className="get-started-progress app-feature-card" aria-live="polite">
        <div className="get-started-progress-row">
          <div>
            <p className="muted text-xs uppercase tracking-wide mb-1">Setup progress</p>
            <p className="get-started-progress-label">{statusLabel}</p>
          </div>
          <div className="get-started-progress-meta" aria-hidden={loading}>
            <span className="get-started-progress-count">
              {loading ? "—" : `${completedCount}/${STEPS.length}`}
            </span>
          </div>
        </div>
        <div
          className="get-started-progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={loading ? 0 : completedCount}
          aria-label="Setup steps completed"
        >
          <span style={{ width: `${loading ? 0 : (completedCount / STEPS.length) * 100}%` }} />
        </div>
      </section>

      {(progress.activated || completedCount === STEPS.length) && !loading ? (
        <section className="get-started-done app-feature-card mt-6" role="status">
          <div className="get-started-done-icon" aria-hidden>
            <Check size={18} strokeWidth={2.5} />
          </div>
          <div>
            <h2>Mail is live</h2>
            <p className="muted">
              Domain, DNS, and addresses are in place. Jump into your inbox or explore what else Flap can do.
            </p>
            <Button className="mt-4" type="button" onClick={() => go("/app")}>
              Open inbox
            </Button>
          </div>
        </section>
      ) : null}

      <ol className="get-started-steps mt-6" aria-label="Setup steps">
        {STEPS.map((step, index) => {
          const complete = progress[step.id];
          const current = step.id === currentStepId;
          const badge = stepBadge(step.id);
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              className={[
                "get-started-step",
                complete ? "is-complete" : "",
                current ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="get-started-step-num" aria-hidden>
                {complete ? <Check size={14} strokeWidth={2.5} /> : index + 1}
              </div>
              <div className="get-started-step-body">
                <div className="get-started-step-head">
                  <div className="get-started-step-title">
                    <Icon size={16} strokeWidth={2} aria-hidden />
                    <strong>{step.label}</strong>
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <p className="muted">{loading ? "…" : stepDetail(step.id)}</p>
                {current && !loading ? (
                  <Button className="mt-3" type="button" onClick={() => go(step.href)}>
                    {step.cta}
                  </Button>
                ) : null}
                {complete && !current ? (
                  <button
                    type="button"
                    className="get-started-step-link"
                    onClick={() => go(step.href)}
                  >
                    Review
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <section className="mt-8" aria-labelledby="get-started-explore-title">
        <h2 id="get-started-explore-title" className="get-started-section-title">
          Explore your workspace
        </h2>
        <p className="muted get-started-section-sub">
          Email is the foundation. These tools unlock once your domain is connected.
        </p>
        <div className="get-started-explore">
          {EXPLORE.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                className="get-started-explore-card"
                onClick={() => go(item.href)}
              >
                <span className="get-started-explore-icon" aria-hidden>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <strong>{item.title}</strong>
                <span className="muted">{item.body}</span>
              </button>
            );
          })}
        </div>
      </section>
    </AppFeaturePage>
  );
}
