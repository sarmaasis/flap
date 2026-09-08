import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export function EmptyState({
  title,
  body,
  mockup,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  body: string;
  mockup?: ReactNode;
  icon?: ReactNode;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] px-6 py-10 text-center shadow-none",
        className,
      )}
    >
      {mockup ? (
        <div className="mb-6 w-full max-w-sm">{mockup}</div>
      ) : icon ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--foreground-muted)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h2>
      <p className="mt-2 max-w-[380px] text-[13px] text-[var(--foreground-muted)]">{body}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            <Button type="button" onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryAction ? (
            <Button type="button" variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
