import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { RequireRole } from "@/lib/guard";
import AppLayout from "@/layouts/AppLayout";
import OrganizerLayout from "@/layouts/OrganizerLayout";
import AdminLayout from "@/layouts/AdminLayout";
import Home from "@/pages/public/Home";
import EventsPage from "@/pages/public/EventsPage";
import EventDetailPage from "@/pages/public/EventDetailPage";
import WaitingRoomPage from "@/pages/buyer/WaitingRoomPage";
import CheckoutPage from "@/pages/buyer/CheckoutPage";
import OrderHistoryPage from "@/pages/buyer/OrderHistoryPage";
import OrderDetailPage from "@/pages/buyer/OrderDetailPage";
import LoginPage from "@/pages/auth/LoginPage";
import OrganizerEventsPage from "@/pages/organizer/OrganizerEventsPage";
import EventFormPage from "@/pages/organizer/EventFormPage";
import CategoriesPage from "@/pages/organizer/CategoriesPage";
import EventOrdersPage from "@/pages/organizer/EventOrdersPage";
import AdminEventsPage from "@/pages/admin/AdminEventsPage";
import AdminOrdersPage from "@/pages/admin/AdminOrdersPage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:eventId/join/:categoryId" element={<WaitingRoomPage />} />
            <Route path="/events/:eventId/checkout/:categoryId" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route
            path="/organizer"
            element={
              <RequireRole role="organizer">
                <OrganizerLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/organizer/events" replace />} />
            <Route path="events" element={<OrganizerEventsPage />} />
            <Route path="events/new" element={<EventFormPage />} />
            <Route path="events/:id/edit" element={<EventFormPage />} />
            <Route path="events/:id/categories" element={<CategoriesPage />} />
            <Route path="events/:id/orders" element={<EventOrdersPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireRole role="admin">
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="/admin/events" replace />} />
            <Route path="events" element={<AdminEventsPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;