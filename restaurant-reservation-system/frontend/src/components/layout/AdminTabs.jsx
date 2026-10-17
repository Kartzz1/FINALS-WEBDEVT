import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/restaurants", label: "Restaurants" },
  { to: "/admin/tables", label: "Tables" },
  { to: "/admin/reservations", label: "Reservations" },
  { to: "/admin/users", label: "Users" },
];

// Tabs scroll sideways on narrow screens instead of wrapping into several rows.
export default function AdminTabs() {
  return (
    <nav className="tabs" aria-label="Administration">
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
