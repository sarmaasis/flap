import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

export type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  label?: React.ReactNode;
};

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, disabled, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;

    const control = (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          className={cn(
            "peer absolute inset-0 z-0 m-0 h-4 w-4 cursor-pointer appearance-none rounded-[5px] border border-[var(--line-strong)] bg-[var(--surface-input)]",
            "checked:border-[var(--accent)] checked:bg-[var(--accent)]",
            "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <Check
          aria-hidden
          className="pointer-events-none relative z-10 h-3 w-3 text-[var(--accent-fg)] opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
    );

    if (label == null) return control;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex max-w-full cursor-pointer items-start gap-3 text-sm font-medium leading-snug text-[var(--foreground)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className="mt-0.5">{control}</span>
        <span className="min-w-0 pt-px">{label}</span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
