import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-[13px] text-[var(--foreground-muted)]">{description}</p>
      ) : null}
      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)]">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  helper,
  children,
  className,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--foreground)]">{label}</div>
        {helper ? <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">{helper}</p> : null}
      </div>
      <div className="w-full max-w-[280px] shrink-0 sm:w-auto">{children}</div>
    </div>
  );
}
