import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--cta-dim)] text-[var(--cta)]",
        secondary: "border-[var(--line-strong)] bg-[var(--surface-2)] text-[var(--muted)]",
        outline: "border-[var(--line-strong)] text-[var(--fg)]",
        warn: "border-transparent bg-[rgba(var(--warn-rgb),0.15)] text-[var(--warn)]",
        danger: "border-transparent bg-[rgba(var(--danger-rgb),0.15)] text-[var(--danger)]",
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
