import { useState } from "react";
import AdminRestaurantForm from "../../components/features/AdminRestaurantForm.jsx";
import SyncPanel from "../../components/features/SyncPanel.jsx";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Icon from "../../components/ui/Icon.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import SegmentedControl from "../../components/ui/SegmentedControl.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { useAction } from "../../hooks/useAction.js";
import { useDebouncedValue } from "../../hooks/useDebouncedValue.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { useResource } from "../../hooks/useResource.js";
import { catalogService } from "../../services/catalogService.js";

const PAGE_SIZE = 10;
const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function AdminRestaurantsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | a restaurant
  const [toDelete, setToDelete] = useState(null);
  const { busy, error, run } = useAction();
  const q = useDebouncedValue(searchText.trim(), 350);
  usePageTitle("Manage restaurants");

  const { data, loading, error: loadError, reload } = useResource(
    () => catalogService.listRestaurants({ q, status, page, limit: PAGE_SIZE, sort: "name" }),
    [q, status, page]
  );

  function saved(message) {
    setEditing(null);
    toast.success(message);
    reload();
  }

  async function toggleActive(restaurant) {
    const open = restaurant.status === "active";
    const outcome = await run(
      () => catalogService.updateRestaurant(restaurant.id, { active: !open }),
      open ? "Restaurant hidden. Existing reservations are kept." : "Restaurant is visible again."
    );
    if (outcome.ok) reload();
  }

  async function remove() {
    const outcome = await run(() => catalogService.deleteRestaurant(toDelete.id), "Restaurant deleted.");
    setToDelete(null);
    if (outcome.ok) reload();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Restaurants</h1>
          <p className="page-subtitle">Import real restaurants, edit their details, and control what guests can see.</p>
        </div>
        <div className="actions page-actions">
          <Button icon="refresh" aria-expanded={showImport} onClick={() => setShowImport((open) => !open)}>
            {showImport ? "Hide import" : "Import restaurants"}
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
            Add restaurant
          </Button>
        </div>
      </header>

      {showImport && <SyncPanel onFinished={reload} />}

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={18} />
          <input
            type="search"
            aria-label="Search restaurants"
            placeholder="Search by name, city, or cuisine"
            value={searchText}
            maxLength={100}
            onChange={(event) => {
              setSearchText(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <SegmentedControl
          label="Filter by status"
          options={STATUS_FILTERS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      <Alert>{error}</Alert>
      {loadError && <ErrorState error={loadError} onRetry={reload} />}
      {loading && !data && !loadError && <Loading label="Loading restaurants" variant="list" />}
      {data && data.items.length === 0 && (
        <EmptyState
          title={q || status ? "No restaurants match" : "No restaurants yet"}
          action={
            q || status ? null : (
              <Button variant="primary" icon="refresh" onClick={() => setShowImport(true)}>
                Import from OpenStreetMap
              </Button>
            )
          }
        >
          {q || status
            ? "Try a different search or status filter."
            : "Import real Batangas restaurants, or add one by hand, so guests have something to book."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="results-bar">{data.total.toLocaleString()} restaurants</p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">City</th>
                  <th scope="col">Cuisine</th>
                  <th scope="col">Source</th>
                  <th scope="col">Tables</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td data-label="Name">
                      {restaurant.name}
                      {restaurant.category && (
                        <>
                          <br />
                          <span className="muted">{restaurant.category}</span>
                        </>
                      )}
                    </td>
                    <td data-label="City">{restaurant.city ?? "Not set"}</td>
                    <td data-label="Cuisine">{restaurant.cuisine.length ? restaurant.cuisine.join(", ") : "Not listed"}</td>
                    <td data-label="Source">
                      <span className="badge badge-neutral">{restaurant.source?.provider === "openstreetmap" ? "OpenStreetMap" : "Added by hand"}</span>
                    </td>
                    <td data-label="Tables">{restaurant.availableTables}</td>
                    <td data-label="Status">
                      <Badge status={restaurant.status} />
                    </td>
                    <td data-label="Actions">
                      <div className="actions">
                        <Button size="sm" icon="edit" onClick={() => setEditing(restaurant)}>
                          Edit
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => toggleActive(restaurant)}>
                          {restaurant.status === "active" ? "Hide" : "Show"}
                        </Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => setToDelete(restaurant)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      <Modal
        open={Boolean(editing)}
        size="lg"
        title={editing === "new" ? "Add restaurant" : "Edit restaurant"}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <AdminRestaurantForm
            key={editing === "new" ? "new" : editing.id}
            restaurant={editing === "new" ? null : editing}
            onSaved={saved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this restaurant?"
        message={
          toDelete
            ? `${toDelete.name} will be removed permanently. Restaurants that still have tables cannot be deleted; hide them instead.`
            : ""
        }
        confirmLabel="Delete restaurant"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
