import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const btn =
  "inline-flex items-center gap-2 px-3 py-2 font-black uppercase text-sm md:text-base brut-border-2 brut-button";

export default function UserNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" className={`${btn} bg-gigs-purple`}>
        Login
      </Link>
    );
  }

  const roleLink =
    user.role === "organizer"
      ? { to: "/organizer/events", label: "Manage" }
      : user.role === "admin"
        ? { to: "/admin/events", label: "Admin" }
        : { to: "/orders", label: "My Orders" };

  return (
    <>
      <Link to={roleLink.to} className={`${btn} bg-canvas`}>
        {roleLink.label}
      </Link>
      <button
        type="button"
        onClick={() => {
          logout();
          navigate("/");
        }}
        className={`${btn} bg-gigs-yellow`}
      >
        Log Out
      </button>
    </>
  );
}