import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const colorVariants = {
  default: "bg-canvas text-ink border-foreground",
  pink: "bg-gigs-pink text-foreground border-foreground",
  purple: "bg-gigs-purple text-ink border-foreground",
  orange: "bg-gigs-orange text-ink border-foreground",
  yellow: "bg-gigs-yellow text-ink border-foreground",
  teal: "bg-gigs-teal text-ink border-foreground",
  dark: "bg-gigs-dark text-background border-foreground",
};

const Card = forwardRef(({
  className,
  variant = "default",
  interactive = false,
  shadow = false,
  border = true,
  ...props
}, ref) => (
  <div
    className={cn(
      "rounded-none p-4",
      border && "border-4 border-foreground",
      shadow && "brut-shadow",
      interactive && "brut-card-hover cursor-pointer",
      colorVariants[variant],
      className
    )}
    ref={ref}
    {...props}
  />
));

Card.displayName = "Card";

export { Card };
