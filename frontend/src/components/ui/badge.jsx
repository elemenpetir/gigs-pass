import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-canvas text-ink border-foreground",
  inverse: "bg-foreground text-background border-foreground",
  pink: "bg-gigs-pink text-foreground border-foreground",
  purple: "bg-gigs-purple text-ink border-foreground",
  yellow: "bg-gigs-yellow text-ink border-foreground",
  teal: "bg-gigs-teal text-ink border-foreground",
  dark: "bg-gigs-dark text-background border-foreground",
  success: "bg-success text-foreground border-foreground",
  warning: "bg-warning text-ink border-foreground",
  error: "bg-error text-background border-foreground",
};

const Badge = forwardRef(({
  className,
  variant = "default",
  disabled = false,
  ...props
}, ref) => (
  <span
    className={cn(
      "inline-flex items-center rounded-none px-2 py-1 text-xs font-black uppercase tracking-widest brut-border-2",
      variantStyles[variant],
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
    ref={ref}
    {...props}
  />
));

Badge.displayName = "Badge";

export { Badge };
