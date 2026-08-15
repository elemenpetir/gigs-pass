import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-none border font-black uppercase tracking-tight whitespace-nowrap outline-none select-none transition-all duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border-foreground bg-foreground text-background brut-button",
        accent: "border-foreground bg-gigs-pink text-foreground brut-shadow brut-button",
        secondary: "border-foreground bg-canvas text-ink brut-button hover:bg-gigs-yellow",
        outline: "border-2 border-foreground bg-canvas text-ink brut-button hover:bg-gigs-purple",
        ghost: "border-transparent text-ink brut-button hover:text-gigs-pink",
        destructive: "border-2 border-error bg-error/10 text-error brut-button",
        link: "text-ink underline-offset-4 hover:underline hover:text-gigs-pink",
      },
      size: {
        default: "h-10 gap-2 px-5",
        xs: "h-7 gap-1 rounded-none px-3 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-7 text-base",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button, buttonVariants };
