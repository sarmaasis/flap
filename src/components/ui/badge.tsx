import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent-dim)] text-[var(--accent-text)]",
        secondary:
          "border-[var(--line-strong)] bg-[var(--surface-hover)] text-[var(--foreground-muted)]",
        outline: "border-[var(--line-strong)] text-[var(--foreground)]",
        success:
          "border-transparent bg-[color-mix(in_srgb,var(--success-text)_12%,transparent)] text-[var(--success-text)]",
        warn:
          "border-transparent bg-[color-mix(in_srgb,var(--warning-text)_12%,transparent)] text-[var(--warning-text)]",
        danger:
          "border-transparent bg-[color-mix(in_srgb,var(--error-text)_12%,transparent)] text-[var(--error-text)]",
        accent:
          "border-transparent bg-[var(--accent-dim)] text-[var(--accent-text)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
