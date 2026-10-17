import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "../components/ui/Alert.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button, { ButtonLink } from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import Icon from "../components/ui/Icon.jsx";
import Loading from "../components/ui/Loading.jsx";
import Pagination from "../components/ui/Pagination.jsx";
import SegmentedControl from "../components/ui/SegmentedControl.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { useAction } from "../hooks/useAction.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { reservationService } from "../services/reservationService.js";
import { formatDateTime, formatDuration, formatTime } from "../utils/datetime.js";

const PAGE_SIZE = 8;
const FILTERS = [
  { value: "", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
];

// Mirrors the server rule: only confirmed reservations that have not started can change.
const canChange = (reservation) =>
  reservation.status === "confirmed" && new Date(reservation.startAt) > new Date();

export default function MyReservationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const announced = useRef(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [toCancel, setToCancel] = useState(null);
  const { busy, error, run } = useAction();
  usePageTitle("My reservations");

  // A booking elsewhere sends a message along with the redirect; show it once.
  useEffect(() => {
    if (location.state?.notice && !announced.current) {
      announced.current = true;
      toast.success(location.state.notice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, toast]);

  const { data, loading, error: loadError, reload } = useResource(
    () => reservationService.list({ page, limit: PAGE_SIZE, status }),
    [page, status]
  );

  async function cancel() {
    const outcome = await run(
      () => reservationService.update(toCancel.id, { status: "cancelled" }),
      "Reservation cancelled."
    );
    setToCancel(null);
    if (outcome.ok) reload();
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>My reservations</h1>
          <p className="page-subtitle">Change or cancel a booking until it starts.</p>
        </div>
        <ButtonLink to="/restaurants" variant="primary" icon="plus">
          New reservation
        </ButtonLink>
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
        <EmptyState
          title={status ? "Nothing matches this filter" : "No reservations yet"}
          action={
            <ButtonLink to="/restaurants" variant="primary">
              Find a table
            </ButtonLink>
          }
        >
          {status ? "Try a different filter to see your other reservations." : "When you book a table it will show up here."}
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className="reservation-list">
            {data.items.map((reservation) => (
              <Card as="li" key={reservation.id} className="reservation">
                <div className="reservation-head">
                  <h2>{reservation.restaurantName}</h2>
                  <Badge status={reservation.status} />
                </div>
                <ul className="meta">
                  <li>
                    <Icon name="calendar" size={16} />
                    {formatDateTime(reservation.startAt)}
                  </li>
                  <li>
                    <Icon name="clock" size={16} />
                    Until {formatTime(reservation.endAt)} ({formatDuration(reservation.durationMinutes)})
                  </li>
                  <li>
                    <Icon name="users" size={16} />
                    {reservation.guestCount} {reservation.guestCount === 1 ? "guest" : "guests"}
                  </li>
                  <li>Table {reservation.tableLabel}</li>
                </ul>
                {reservation.notes && <p className="note">Notes: {reservation.notes}</p>}
                {canChange(reservation) && (
                  <div className="actions">
                    <ButtonLink to={`/reservations/${reservation.id}/edit`} size="sm" icon="edit">
                      Change
                    </ButtonLink>
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setToCancel(reservation)}>
                      Cancel
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Cancel this reservation?"
        message={
          toCancel
            ? `Your table at ${toCancel.restaurantName} on ${formatDateTime(toCancel.startAt)} will be released. This cannot be undone.`
            : ""
        }
        confirmLabel="Cancel reservation"
        danger
        busy={busy}
        onConfirm={cancel}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}
