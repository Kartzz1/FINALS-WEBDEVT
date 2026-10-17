import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import FormField from "../../components/ui/FormField.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Modal from "../../components/ui/Modal.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import { useToast } from "../../components/ui/Toast.jsx";
import { useAction } from "../../hooks/useAction.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { useResource } from "../../hooks/useResource.js";
import { catalogService } from "../../services/catalogService.js";
import { fieldErrors } from "../../utils/errors.js";
import { LIMITS, compact, validateLabel, validateWholeNumber } from "../../utils/validation.js";

const PAGE_SIZE = 10;
const RESTAURANT_CHOICES = 50;
const EMPTY_PAGE = { items: [], page: 1, totalPages: 0, total: 0 };

function TableForm({ restaurantId, table, onSaved, onCancel }) {
  const [form, setForm] = useState({
    label: table?.label ?? "",
    capacity: String(table?.capacity ?? 4),
    active: table?.active ?? true,
  });
  const [errors, setErrors] = useState({});
  const { busy, error, run } = useAction();

  function change(event) {
    const { name, type, checked, value } = event.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  async function submit(event) {
    event.preventDefault();
    const found = compact({
      label: validateLabel(form.label),
      capacity: validateWholeNumber("Seats", form.capacity, 1, LIMITS.CAPACITY_MAX),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const body = { label: form.label.trim(), capacity: Number(form.capacity), active: form.active };
    const save = table
      ? () => catalogService.updateTable(table.id, body)
      : () => catalogService.createTable({ restaurantId, ...body });
    const outcome = await run(save);
    if (outcome.ok) onSaved(table ? "Table updated." : "Table added.");
    else setErrors(fieldErrors(outcome.error));
  }

  return (
    <form onSubmit={submit} noValidate>
      <Alert>{error}</Alert>
      <FormField
        id="t-label"
        name="label"
        label="Label"
        value={form.label}
        onChange={change}
        error={errors.label}
        maxLength={LIMITS.LABEL_MAX}
        hint="For example T1, Window 2, or Patio 3."
        required
      />
      <FormField
        id="t-capacity"
        name="capacity"
        label="Seats"
        type="number"
        inputMode="numeric"
        min="1"
        max={LIMITS.CAPACITY_MAX}
        value={form.capacity}
        onChange={change}
        error={errors.capacity}
        required
      />
      <label className="check">
        <input type="checkbox" name="active" checked={form.active} onChange={change} />
        Open for reservations
      </label>
      <div className="actions actions-end">
        <Button onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Save table
        </Button>
      </div>
    </form>
  );
}

export default function AdminTablesPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const { busy, error, run } = useAction();
  usePageTitle("Manage tables");

  const restaurants = useResource(() => catalogService.listRestaurants({ limit: RESTAURANT_CHOICES }), []);
  const restaurantId = params.get("restaurant") || restaurants.data?.items[0]?.id || "";

  const tables = useResource(
    () =>
      restaurantId
        ? catalogService.listTables({ restaurantId, page, limit: PAGE_SIZE })
        : Promise.resolve(EMPTY_PAGE),
    [restaurantId, page]
  );

  function chooseRestaurant(event) {
    setParams({ restaurant: event.target.value });
    setPage(1);
    setEditing(null);
  }

  function saved(message) {
    setEditing(null);
    toast.success(message);
    tables.reload();
  }

  async function toggleActive(table) {
    const outcome = await run(
      () => catalogService.updateTable(table.id, { active: !table.active }),
      table.active ? "Table closed. Existing reservations are kept." : "Table reopened."
    );
    if (outcome.ok) tables.reload();
  }

  async function remove() {
    const outcome = await run(() => catalogService.deleteTable(toDelete.id), "Table deleted.");
    setToDelete(null);
    if (outcome.ok) tables.reload();
  }

  const data = tables.data;
  const noRestaurants = restaurants.data && restaurants.data.items.length === 0;

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Tables</h1>
          <p className="page-subtitle">Tables with booking history cannot be deleted; close them instead.</p>
        </div>
        {restaurantId && (
          <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
            Add table
          </Button>
        )}
      </header>

      <Alert>{error}</Alert>
      {restaurants.error && <ErrorState error={restaurants.error} onRetry={restaurants.reload} />}
      {restaurants.loading && !restaurants.data && <Loading label="Loading restaurants" variant="list" />}
      {noRestaurants && (
        <EmptyState title="Add a restaurant first">Every table belongs to a restaurant.</EmptyState>
      )}

      {restaurants.data && !noRestaurants && (
        <div className="toolbar">
          <label htmlFor="restaurant-select">Restaurant</label>
          <select id="restaurant-select" value={restaurantId} onChange={chooseRestaurant}>
            {restaurants.data.items.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
                {restaurant.active ? "" : " (closed)"}
              </option>
            ))}
          </select>
        </div>
      )}

      {tables.error && <ErrorState error={tables.error} onRetry={tables.reload} />}
      {tables.loading && !data && restaurantId && <Loading label="Loading tables" variant="list" />}
      {data && restaurantId && data.items.length === 0 && (
        <EmptyState
          title="No tables yet"
          action={
            <Button variant="primary" icon="plus" onClick={() => setEditing("new")}>
              Add a table
            </Button>
          }
        >
          Guests cannot book this restaurant until it has at least one open table.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Seats</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((table) => (
                  <tr key={table.id}>
                    <td data-label="Label">{table.label}</td>
                    <td data-label="Seats">{table.capacity}</td>
                    <td data-label="Status">
                      <Badge status={table.active ? "active" : "inactive"} />
                    </td>
                    <td data-label="Actions">
                      <div className="actions">
                        <Button size="sm" icon="edit" onClick={() => setEditing(table)}>
                          Edit
                        </Button>
                        <Button size="sm" disabled={busy} onClick={() => toggleActive(table)}>
                          {table.active ? "Close" : "Reopen"}
                        </Button>
                        <Button size="sm" variant="danger" icon="trash" onClick={() => setToDelete(table)}>
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

      <Modal open={Boolean(editing)} title={editing === "new" ? "Add table" : "Edit table"} onClose={() => setEditing(null)}>
        {editing && restaurantId && (
          <TableForm
            key={editing === "new" ? "new" : editing.id}
            restaurantId={restaurantId}
            table={editing === "new" ? null : editing}
            onSaved={saved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this table?"
        message={
          toDelete
            ? `Table ${toDelete.label} will be removed. Tables that have any reservation history cannot be deleted; close them instead.`
            : ""
        }
        confirmLabel="Delete table"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
