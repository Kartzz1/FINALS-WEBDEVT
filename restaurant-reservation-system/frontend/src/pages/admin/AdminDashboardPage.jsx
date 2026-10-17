import { Link } from "react-router-dom";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Icon from "../../components/ui/Icon.jsx";
import Loading from "../../components/ui/Loading.jsx";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { useResource } from "../../hooks/useResource.js";
import { catalogService } from "../../services/catalogService.js";
import { reservationService } from "../../services/reservationService.js";
import { userService } from "../../services/userService.js";

// limit=1 because only the totals are needed, not the rows.
async function loadCounts() {
  const [users, restaurants, reservations, confirmed] = await Promise.all([
    userService.list({ limit: 1 }),
    catalogService.listRestaurants({ limit: 1 }),
    reservationService.list({ limit: 1 }),
    reservationService.list({ limit: 1, status: "confirmed" }),
  ]);
  return {
    users: users.total,
    restaurants: restaurants.total,
    reservations: reservations.total,
    confirmed: confirmed.total,
  };
}

export default function AdminDashboardPage() {
  const { data, loading, error, reload } = useResource(loadCounts, []);
  usePageTitle("Administration");

  const sections = [
    {
      to: "/admin/reservations",
      title: "Reservations",
      text: "Review bookings, cancel them, or mark them completed.",
      count: data && `${data.reservations} total, ${data.confirmed} confirmed`,
    },
    {
      to: "/admin/restaurants",
      title: "Restaurants",
      text: "Add restaurants and open or close them for bookings.",
      count: data && `${data.restaurants} total`,
    },
    {
      to: "/admin/tables",
      title: "Tables",
      text: "Set up the tables and seat counts for each restaurant.",
    },
    {
      to: "/admin/users",
      title: "Users",
      text: "Manage customer and administrator accounts.",
      count: data && `${data.users} total`,
    },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Administration</h1>
          <p className="page-subtitle">Manage the restaurants, tables, and bookings in the system.</p>
        </div>
      </header>

      {error && <ErrorState error={error} onRetry={reload} />}
      {loading && !data && !error && <Loading label="Loading overview" variant="list" />}

      {(data || (!loading && !error)) && (
        <ul className="manage-list">
          {sections.map((section) => (
            <li key={section.to}>
              <Link to={section.to}>
                <span>
                  <strong>{section.title}</strong>
                  <small>{section.text}</small>
                </span>
                {section.count && <span className="manage-count">{section.count}</span>}
                <Icon name="chevron-right" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
