import { Navigate, Outlet, useLocation } from "react-router-dom";
import Loading from "../components/ui/Loading.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// These guards only decide what to show. They are not security: every API
// call is checked again on the server, which is what actually protects data.
export function RequireAuth() {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return <Loading label="Checking your session" variant="page" />;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
