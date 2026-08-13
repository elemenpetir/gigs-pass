import { Outlet } from "react-router-dom";
import { TopNav, Footer } from "@/components";

const NAV_LINKS = [
  { label: "Discover", badge: "LIVE", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Categories", href: "/categories" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen selection:bg-gigs-pink selection:text-white">
      <TopNav
        links={NAV_LINKS}
        right={
          <>
            <a
              href="/orders"
              className="inline-flex items-center gap-2 px-3 py-2 font-black uppercase text-sm md:text-base brut-border-2 brut-button bg-canvas"
            >
              My Orders
            </a>
            <a
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 font-black uppercase text-sm md:text-base brut-border-2 brut-button bg-gigs-purple"
            >
              Login
            </a>
          </>
        }
      />
      <main className="max-w-7xl mx-auto px-4 md:px-8 relative overflow-hidden">
        <Outlet />
      </main>
      <Footer
        tagline="Your entry to the underground, the mainstream, and everything in between."
        columns={[
          {
            title: "Explore",
            items: [
              { label: "All Events", href: "/events" },
              { label: "Festivals", href: "/events" },
              { label: "Venues", href: "/events" },
              { label: "Cities", href: "/events" },
            ],
          },
          {
            title: "Support",
            items: [
              { label: "Help Center", href: "/" },
              { label: "Ticket Status", href: "/orders" },
              { label: "Contact Us", href: "/" },
            ],
          },
          {
            title: "For Organizers",
            items: [
              {
                label: "Create Event",
                href: "/admin/events/new",
              },
            ],
          },
        ]}
        bottom={
          <>
            <p>© 2026 Gigs Pass. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="/" className="hover:underline">Terms</a>
              <a href="/" className="hover:underline">Privacy</a>
            </div>
          </>
        }
      />
    </div>
  );
}