import { useState } from "react";
import Alert from "../../components/ui/Alert.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import ErrorState from "../../components/ui/ErrorState.jsx";
import Loading from "../../components/ui/Loading.jsx";
import Pagination from "../../components/ui/Pagination.jsx";
import SegmentedControl from "../../components/ui/SegmentedControl.jsx";
import { useAction } from "../../hooks/useAction.js";
import { usePageTitle } from "../../hooks/usePageTitle.js";
import { useResource } from "../../hooks/useResource.js";
import { reservationService } from "../../services/reservationService.js";
import { formatDateTime, formatDuration } from "../../utils/datetime.js";

const PAGE_SIZE = 10;
const FILTERS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

const hasEnded = (reservation) => new Date(reservation.endAt) <= new Date();

export default function AdminReservationsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(null); // { type: "cancel" | "delete", reservation }
  const { busy, error, run } = useAction();
  usePageTitle("Manage reservations");

  const { data, loading, error: loadError, reload } = useResource(
    () => reservationService.list({ page, limit: PAGE_SIZE, status }),
    [page, status]
  );

  async function complete(reservation) {
    const outcome = await run(
      () => reservationService.update(reservation.id, { status: "completed" }),
      "Reservation marked as completed."
    );
    if (outcome.ok) reload();
  }

  async function confirmPending() {
    const { type, reservation } = pending;
    const outcome =
      type === "cancel"
        ? await run(() => reservationService.update(reservation.id, { status: "cancelled" }), "Reservation cancelled.")
        : await run(() => reservationService.remove(reservation.id), "Reservation deleted.");
    setPending(null);
    if (outcome.ok) reload();
  }

  const dialog =
    pending?.type === "delete"
      ? { title: "Delete this reservation?", confirmLabel: "Delete reservation", text: "The record is removed permanently." }
      : { title: "Cancel this reservation?", confirmLabel: "Cancel reservation", text: "The table is released. This cannot be undone." };

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Reservations</h1>
          <p className="page-subtitle">A reservation can be completed only after its end time has passed.</p>
        </div>
      </header>

      <div className="toolbar">
        <SegmentedControl
          label="Filter by status"
          options={FILTERS}
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      <Alert>{error}</Alert>
      {loadError && <ErrorState error={loadError} onRetry={reload} />}
      {loading && !data && <Loading label="Loading reservations" variant="list" />}
      {data && data.items.length === 0 && (
        <EmptyState title="No reservations here">
          {status ? "No reservation has this status. Try another filter." : "Reservations will appear as guests book."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Where</th>
                  <th scope="col">When</th>
                  <th scope="col">Party</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((reservation) => (
                  <tr key={reservation.id}>
                    <td data-label="Guest">
                      {reservation.guestName}
                      <br />
                      <span className="muted">{reservation.guestEmail}</span>
                    </td>
                    <td data-label="Where">
                      {reservation.restaurantName}
                      <br />
                      <span className="muted">Table {reservation.tableLabel}</span>
                    </td>
                    <td data-label="When">
                      {formatDateTime(reservation.startAt)}
                      <br />
                      <span className="muted">{formatDuration(reservation.durationMinutes)}</span>
                    </td>
                    <td data-label="Party">{reservation.guestCount}</td>
                    <td data-label="Status">
                      <Badge status={reservation.status} />
                    </td>
                    <td data-label="Actions">
                      <div className="actions">
                        {reservation.status === "confirmed" && (
                          <>
                            <Button
                              size="sm"
                              icon="check"
                              disabled={busy || !hasEnded(reservation)}
                              title={hasEnded(reservation) ? undefined : "Available after the reservation ends"}
                              onClick={() => complete(reservation)}
                            >
                              Complete
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setPending({ type: "cancel", reservation })}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {reservation.status === "cancelled" && (
                          <Button
                            size="sm"
                            variant="danger"
                            icon="trash"
                            onClick={() => setPending({ type: "delete", reservation })}
                          >
                            Delete
                          </Button>
                        )}
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

      <ConfirmDialog
        open={Boolean(pending)}
        title={dialog.title}
        message={
          pending
            ? `${pending.reservation.guestName} at ${pending.reservation.restaurantName}, ${formatDateTime(
                pending.reservation.startAt
              )}. ${dialog.text}`
            : ""
        }
        confirmLabel={dialog.confirmLabel}
        danger
        busy={busy}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
