import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

function AccessBlock() {
  return (
    <section className="min-h-screen flex items-center justify-center">
      <div className="w-40 h-40 border-4 border-foreground bg-gigs-purple animate-pulse brut-shadow" />
    </section>
  );
}

export function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AccessBlock />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}