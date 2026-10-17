import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvailabilityPicker from "../components/features/AvailabilityPicker.jsx";
import Alert from "../components/ui/Alert.jsx";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import FormField from "../components/ui/FormField.jsx";
import Icon from "../components/ui/Icon.jsx";
import Loading from "../components/ui/Loading.jsx";
import { useAction } from "../hooks/useAction.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { reservationService } from "../services/reservationService.js";
import { formatDateTime, utcIsoToLocalInput } from "../utils/datetime.js";
import { LIMITS } from "../utils/validation.js";

export default function EditReservationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const { busy, error, run } = useAction();
  usePageTitle("Change reservation");

  const { data, loading, error: loadError, reload } = useResource(() => reservationService.get(id), [id]);
  const reservation = data?.reservation;

  useEffect(() => {
    if (reservation) setNotes(reservation.notes ?? "");
  }, [reservation]);

  async function saveNotes(event) {
    event.preventDefault();
    const outcome = await run(() => reservationService.update(id, { notes: notes.trim() }), "Notes saved.");
    if (outcome.ok) reload();
  }

  async function move(table, values) {
    const outcome = await run(() => reservationService.update(id, { tableId: table.id, ...values }));
    if (outcome.ok) {
      navigate("/reservations", { state: { notice: `Reservation updated: table ${table.label}.` } });
    }
  }

  if (loading && !reservation) {
    return <Loading label="Loading reservation" variant="page" />;
  }
  if (loadError) {
    return (
      <>
        <ErrorState error={loadError} onRetry={reload} notFoundText="That reservation could not be found." />
        <p className="auth-switch">
          <Link to="/reservations">Back to my reservations</Link>
        </p>
      </>
    );
  }

  const editable = reservation.status === "confirmed" && new Date(reservation.startAt) > new Date();

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/reservations">My reservations</Link>
        <Icon name="chevron-right" size={16} />
        <span aria-current="page">Change reservation</span>
      </nav>
      <header className="page-header">
        <div>
          <h1>Change reservation</h1>
          <p className="page-subtitle">
            {reservation.restaurantName} · table {reservation.tableLabel} · {formatDateTime(reservation.startAt)}
          </p>
        </div>
        <Badge status={reservation.status} />
      </header>

      <Alert>{error}</Alert>

      {!editable ? (
        <Alert kind="info">
          This reservation can no longer be changed because it has started or is {reservation.status}.
        </Alert>
      ) : (
        <div className="stack">
          <Card>
            <form onSubmit={saveNotes} noValidate>
              <FormField
                id="notes"
                as="textarea"
                label="Notes for the restaurant"
                optional
                rows={2}
                maxLength={LIMITS.NOTES_MAX}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                hint={`${notes.length}/${LIMITS.NOTES_MAX} characters.`}
              />
              <Button type="submit" loading={busy}>
                Save notes
              </Button>
            </form>
          </Card>

          <Card raised>
            <p className="muted">
              To change the time, party size, or table, search again. Your own booking is ignored in the search, so
              your current table shows as free if it still is.
            </p>
            <AvailabilityPicker
              restaurantId={reservation.restaurantId}
              excludeId={reservation.id}
              currentTableId={reservation.tableId}
              initial={{
                when: utcIsoToLocalInput(reservation.startAt),
                guests: reservation.guestCount,
                duration: reservation.durationMinutes,
              }}
              actionLabel="Move reservation here"
              busy={busy}
              onChoose={move}
            />
          </Card>
        </div>
      )}
    </>
  );
}
