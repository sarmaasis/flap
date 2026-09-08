import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { track } from "../lib/analytics";
import { go } from "../lib/nav";
import { savingsVsGoogle, GOOGLE_WORKSPACE_USD_PER_USER } from "../../shared/plans";
import { cn } from "../lib/utils";

type Props = {
  compact?: boolean;
  className?: string;
  ctaHref?: string;
  shareMode?: boolean;
};

export default function WorkspaceCalculator({ compact, className, ctaHref = "/signup", shareMode }: Props) {
  const [domains, setDomains] = useState(5);
  const [users, setUsers] = useState(1);
  const [started, setStarted] = useState(false);

  const result = useMemo(() => savingsVsGoogle(domains, users), [domains, users]);

  useEffect(() => {
    if (!started) return;
    const t = window.setTimeout(() => {
      const props = {
        tool: "google-workspace-cost-calculator",
        domains: result.domains,
        users: result.users_per_domain,
        google_monthly: result.google_monthly,
        flap_monthly: result.flap_monthly,
        savings_annual: result.savings_annual,
      };
      track("calculator_completed", props);
      track("tool_completed", props);
    }, 400);
    return () => window.clearTimeout(t);
  }, [started, result]);

  function onChangeDomains(n: number) {
    if (!started) {
      setStarted(true);
      track("calculator_started", { domains: n, users });
      track("tool_started", { tool: "google-workspace-cost-calculator", domains: n, users });
    }
    setDomains(n);
  }

  function onChangeUsers(n: number) {
    if (!started) {
      setStarted(true);
      track("calculator_started", { domains, users: n });
      track("tool_started", { tool: "google-workspace-cost-calculator", domains, users: n });
    }
    setUsers(n);
  }

  return (
    <div className={cn("rounded-xl border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] p-5", compact && "p-4", className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-[var(--foreground-muted)]">
          <span>Domains / projects</span>
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--foreground)]"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={domains}
            onChange={(e) => onChangeDomains(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-[var(--foreground-muted)]">
          <span>Users per domain</span>
          <input
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-base text-[var(--foreground)]"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={users}
            onChange={(e) => onChangeUsers(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_1fr_1.2fr] [&_small]:mb-0.5 [&_small]:block [&_small]:text-xs [&_small]:text-[var(--foreground-muted)] [&_strong]:text-[1.15rem]" aria-live="polite">
        <div>
          <small>Google Workspace</small>
          <strong>${result.google_monthly}/mo</strong>
        </div>
        <div>
          <small>Flap ({result.flap_plan_name})</small>
          <strong>${result.flap_monthly}/mo</strong>
        </div>
        <div className="[&_strong]:text-[var(--accent)]">
          <small>You save</small>
          <strong>${result.savings_monthly}/mo · ${result.savings_annual}/yr</strong>
        </div>
      </div>

      {shareMode ? (
        <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--cta-dim)] p-4 text-sm">
          <p className="font-semibold">Share card</p>
          <p className="mt-2">
            {result.domains} domains on Google Workspace ≈ ${result.google_monthly}/mo.
            Flap {result.flap_plan_name} is ${result.flap_monthly}/mo
            {result.flap_yearly ? ` (or $${result.flap_yearly}/yr billed annually)` : ""}.
            Save about ${result.savings_monthly}/mo.
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={async () => {
              const text = `Flap vs Workspace: ${result.domains} domains → save ~$${result.savings_monthly}/mo with Flap ${result.flap_plan_name}. https://useflap.online/tools/flap-vs-workspace-share`;
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                /* ignore */
              }
              track("calculator_share_copied", { domains: result.domains });
            }}
          >
            Copy share text
          </Button>
        </div>
      ) : null}

      <p className="mt-4 mb-0 text-xs leading-[1.45] text-[var(--foreground-muted)]">
        Assumes Google Workspace at ${GOOGLE_WORKSPACE_USD_PER_USER}/user/domain/month. Estimates are illustrative and may
        vary by provider, region, taxes, billing cycle, and plan.
      </p>

      <Button
        className="mt-4 w-full sm:w-auto"
        onClick={() => {
          track("signup_clicked", { source: "calculator" });
          track("signup_cta_clicked", { source: "calculator" });
          go(ctaHref);
        }}
      >
        Host all your domains with Flap
      </Button>
    </div>
  );
}
