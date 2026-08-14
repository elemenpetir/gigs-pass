import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const baseField =
  "w-full rounded-none border-2 border-foreground bg-canvas px-4 py-3 font-bold text-body-md text-ink placeholder:text-foreground/40 focus:shadow-brut focus:outline-none disabled:opacity-50";

const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(baseField, className)} {...props} />
));
Input.displayName = "Input";

const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(baseField, "min-h-32 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";

const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(baseField, "appearance-none", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export { Input, Textarea, Select };