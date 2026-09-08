import * as React from "react";
import { cn } from "../../lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--surface-input)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";
