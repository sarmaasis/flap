import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]",
        primary: "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]",
        secondary:
          "bg-[var(--surface-raised)] text-[var(--foreground)] border border-[var(--line-strong)] hover:bg-[var(--surface-hover)]",
        outline:
          "border border-[var(--line-strong)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        ghost: "bg-transparent text-[var(--foreground-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
        danger:
          "bg-transparent text-[var(--error-text)] border border-[color-mix(in_srgb,var(--error-text)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--error-text)_8%,transparent)]",
        inverse: "bg-[var(--foreground)] text-[var(--surface)] hover:opacity-90",
        link: "text-[var(--accent-text)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded-xl px-4 py-2",
        sm: "h-8 rounded-xl px-3.5 text-sm",
        lg: "h-10 rounded-xl px-5",
        icon: "h-9 w-9 rounded-xl",
        pill: "h-9 rounded-full px-5 font-semibold",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
