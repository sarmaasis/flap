import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

const variants = {
  info: {
    bg: "bg-[color-mix(in_srgb,var(--chart-expansion)_8%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--chart-expansion)_20%,transparent)]",
    icon: "text-[var(--chart-expansion)]",
  },
  success: {
    bg: "bg-[color-mix(in_srgb,var(--success-text)_8%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--success-text)_20%,transparent)]",
    icon: "text-[var(--success-text)]",
  },
  warning: {
    bg: "bg-[color-mix(in_srgb,var(--warning-text)_8%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--warning-text)_20%,transparent)]",
    icon: "text-[var(--warning-text)]",
  },
  error: {
    bg: "bg-[color-mix(in_srgb,var(--error-text)_8%,transparent)]",
    border: "border-[color-mix(in_srgb,var(--error-text)_20%,transparent)]",
    icon: "text-[var(--error-text)]",
  },
} as const;

export function Callout({
  variant = "info",
  icon,
  children,
  className,
}: {
  variant?: keyof typeof variants;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const v = variants[variant];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] text-[var(--foreground)]",
        v.bg,
        v.border,
        className,
      )}
      role="status"
    >
      {icon ? <span className={cn("mt-0.5 shrink-0", v.icon)}>{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
