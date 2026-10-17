import { Route, Routes } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout.jsx";
import MainLayout from "./layouts/MainLayout.jsx";
import EditReservationPage from "./pages/EditReservationPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import MyReservationsPage from "./pages/MyReservationsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import RestaurantDetailPage from "./pages/RestaurantDetailPage.jsx";
import ReservePage from "./pages/ReservePage.jsx";
import RestaurantsPage from "./pages/RestaurantsPage.jsx";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage.jsx";
import AdminReservationsPage from "./pages/admin/AdminReservationsPage.jsx";
import AdminRestaurantsPage from "./pages/admin/AdminRestaurantsPage.jsx";
import AdminTablesPage from "./pages/admin/AdminTablesPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import { RequireAdmin, RequireAuth } from "./routes/RequireAuth.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Anyone can browse restaurants. Booking and everything personal needs an account. */}
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route path="restaurants/:id" element={<RestaurantDetailPage />} />

        <Route element={<RequireAuth />}>
          <Route path="restaurants/:id/reserve" element={<ReservePage />} />
          <Route path="reservations" element={<MyReservationsPage />} />
          <Route path="reservations/:id/edit" element={<EditReservationPage />} />
          <Route path="profile" element={<ProfilePage />} />

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="restaurants" element={<AdminRestaurantsPage />} />
              <Route path="tables" element={<AdminTablesPage />} />
              <Route path="reservations" element={<AdminReservationsPage />} />
              <Route path="users" element={<AdminUsersPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
