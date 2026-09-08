import { cn } from "../../lib/utils";

export function StatCard({
  label,
  value,
  period = "Last 30d",
  comparison,
  comparisonTone = "neutral",
  className,
}: {
  label: string;
  value: string | number;
  period?: string;
  comparison?: string | null;
  comparisonTone?: "up" | "down" | "neutral";
  className?: string;
}) {
  const tone =
    comparisonTone === "up"
      ? "text-[var(--success-text)]"
      : comparisonTone === "down"
        ? "text-[var(--error-text)]"
        : "text-[var(--foreground-faint)]";

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] p-5 shadow-none",
        className,
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-faint)]">
        {label}
      </div>
      <div className="mt-2 font-mono text-[28px] font-bold leading-none text-[var(--foreground)]">
        {value}
      </div>
      <div className="mt-3 text-xs text-[var(--foreground-muted)]">{period}</div>
      <div className={cn("mt-1 text-xs", tone)}>
        {comparison ?? "Comparison unavailable"}
      </div>
    </div>
  );
}
