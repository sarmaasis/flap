import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function Toast({
  eyebrow,
  title,
  body,
  action,
  onDismiss,
  className,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto relative max-w-[380px] rounded-xl border border-[var(--line)] bg-[var(--surface-overlay)] p-4 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2)]",
        className,
      )}
    >
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss notification"
          className="absolute right-3 top-3 rounded-md p-1 text-[var(--foreground-faint)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          onClick={onDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {eyebrow ? (
        <div className="pr-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-faint)]">
          {eyebrow}
        </div>
      ) : null}
      <div className={cn("pr-6 text-[13px] font-semibold text-[var(--foreground)]", eyebrow && "mt-1")}>
        {title}
      </div>
      {body ? <p className="mt-1 text-xs text-[var(--foreground-muted)]">{body}</p> : null}
      {action ? <div className="mt-2 text-[13px] text-[var(--accent-text)]">{action}</div> : null}
    </div>
  );
}
