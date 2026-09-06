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
    <div className={cn("calc-root", compact && "calc-compact", className)}>
      <div className="calc-inputs">
        <label className="calc-field">
          <span>Domains / projects</span>
          <input
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={domains}
            onChange={(e) => onChangeDomains(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
        <label className="calc-field">
          <span>Users per domain</span>
          <input
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={users}
            onChange={(e) => onChangeUsers(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
          />
        </label>
      </div>

      <div className="calc-results" aria-live="polite">
        <div>
          <small>Google Workspace</small>
          <strong>${result.google_monthly}/mo</strong>
        </div>
        <div>
          <small>Flap ({result.flap_plan_name})</small>
          <strong>${result.flap_monthly}/mo</strong>
        </div>
        <div className="calc-save">
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

      <p className="calc-disclaimer">
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
