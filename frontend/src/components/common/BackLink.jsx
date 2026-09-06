import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      aria-label={`Back to ${typeof children === "string" ? children : "previous page"}`}
      className="group inline-flex max-w-full items-center gap-1.5 hover:text-gigs-pink transition-colors"
    >
      <ArrowLeft size={16} strokeWidth={3} className="shrink-0 transition-transform group-hover:-translate-x-1" />
      <span className="truncate">{children}</span>
    </Link>
  );
}
