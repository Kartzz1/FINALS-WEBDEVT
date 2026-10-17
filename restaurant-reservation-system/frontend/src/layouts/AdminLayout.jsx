import { Outlet } from "react-router-dom";
import AdminTabs from "../components/layout/AdminTabs.jsx";

export default function AdminLayout() {
  return (
    <>
      <AdminTabs />
      <Outlet />
    </>
  );
}
