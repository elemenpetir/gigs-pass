import { NavLink, Outlet } from "react-router-dom";
import { TopNav } from "@/components";
import UserNav from "@/components/layout/UserNav";
import { cn } from "@/lib/utils";

const navCls = ({ isActive }) =>
  cn(
    "px-3 py-1 font-black uppercase text-sm tracking-tight whitespace-nowrap transition-colors",
    isActive ? "bg-foreground text-background" : "hover:bg-foreground hover:text-background",
  );

export default function OrganizerLayout() {
  return (
    <div className="min-h-screen selection:bg-gigs-pink selection:text-white">
      <TopNav links={[{ label: "Site", href: "/" }]} right={<UserNav />} />
      <div className="border-b-4 border-foreground bg-gigs-yellow">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex gap-6 overflow-x-auto">
          <NavLink to="/organizer/events" className={navCls}>
            My Events
          </NavLink>
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12 relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}