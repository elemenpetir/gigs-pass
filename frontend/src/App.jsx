import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { RequireRole } from "@/lib/guard";
import AppLayout from "@/layouts/AppLayout";
import OrganizerLayout from "@/layouts/OrganizerLayout";
import AdminLayout from "@/layouts/AdminLayout";
import Home from "@/pages/Home";
import EventDetailPage from "@/pages/EventDetailPage";
import WaitingRoomPage from "@/pages/WaitingRoomPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderHistoryPage from "@/pages/OrderHistoryPage";
import LoginPage from "@/pages/LoginPage";
import OrganizerEventsPage from "@/pages/OrganizerEventsPage";
import EventFormPage from "@/pages/EventFormPage";
import CategoriesPage from "@/pages/CategoriesPage";
import PlaceholderPage from "@/pages/PlaceholderPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:eventId/join/:categoryId" element={<WaitingRoomPage />} />
            <Route path="/events/:eventId/checkout/:categoryId" element={<CheckoutPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
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
            <Route path="events/:id/orders" element={<PlaceholderPage title="Event Orders" />} />
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
            <Route path="events" element={<PlaceholderPage title="Event Control" />} />
            <Route path="orders" element={<PlaceholderPage title="Order Override" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;