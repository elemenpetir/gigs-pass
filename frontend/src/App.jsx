import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import AppLayout from "@/layouts/AppLayout";
import Home from "@/pages/Home";
import EventDetailPage from "@/pages/EventDetailPage";
import WaitingRoomPage from "@/pages/WaitingRoomPage";
import LoginPage from "@/pages/LoginPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/events/:id" element={<EventDetailPage />} />
            <Route path="/events/:eventId/join/:categoryId" element={<WaitingRoomPage />} />
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;