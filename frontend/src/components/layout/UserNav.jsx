import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogIn, LogOut, ShieldCheck, Ticket } from "lucide-react";
import { useAuth } from "@/lib/auth";

const btn =
  "inline-flex items-center gap-2 px-3 py-2 font-black uppercase text-sm md:text-base brut-border-2 brut-button";

export default function UserNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" aria-label="Login" className={`${btn} bg-gigs-purple`}>
        <LogIn size={18} strokeWidth={3} />
        <span className="hidden md:inline">Login</span>
      </Link>
    );
  }

  const roleLink =
    user.role === "organizer"
      ? { to: "/organizer/events", label: "Manage", Icon: LayoutDashboard }
      : user.role === "admin"
        ? { to: "/admin/events", label: "Admin", Icon: ShieldCheck }
        : { to: "/orders", label: "My Orders", Icon: Ticket };

  return (
    <>
      <Link to={roleLink.to} aria-label={roleLink.label} className={`${btn} bg-canvas`}>
        <roleLink.Icon size={18} strokeWidth={3} />
        <span className="hidden md:inline">{roleLink.label}</span>
      </Link>
      <button
        type="button"
        aria-label="Log Out"
        onClick={() => {
          logout();
          navigate("/");
        }}
        className={`${btn} bg-gigs-yellow`}
      >
        <LogOut size={18} strokeWidth={3} />
        <span className="hidden md:inline">Log Out</span>
      </button>
    </>
  );
}