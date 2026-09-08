import { cn } from "../../lib/utils";

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[10px] bg-[var(--surface-input)] p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "h-7 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
              active
                ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]",
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
