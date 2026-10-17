import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvailabilityPicker from "../components/features/AvailabilityPicker.jsx";
import Alert from "../components/ui/Alert.jsx";
import { ButtonLink } from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import FormField from "../components/ui/FormField.jsx";
import Icon from "../components/ui/Icon.jsx";
import Loading from "../components/ui/Loading.jsx";
import { useAction } from "../hooks/useAction.js";
import { usePageTitle } from "../hooks/usePageTitle.js";
import { useResource } from "../hooks/useResource.js";
import { catalogService } from "../services/catalogService.js";
import { reservationService } from "../services/reservationService.js";
import { describeTables, formatLocation } from "../utils/restaurant.js";
import { LIMITS } from "../utils/validation.js";

export default function ReservePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const { busy, error, run } = useAction();

  const { data, loading, error: loadError, reload } = useResource(() => catalogService.getRestaurant(id), [id]);
  const restaurant = data?.restaurant;
  usePageTitle(restaurant ? `Reserve at ${restaurant.name}` : "Reserve a table");

  async function book(table, values) {
    const body = { restaurantId: id, tableId: table.id, ...values };
    if (notes.trim()) {
      body.notes = notes.trim();
    }
    const outcome = await run(() => reservationService.create(body));
    if (outcome.ok) {
      navigate("/reservations", {
        state: { notice: `Reserved table ${table.label} at ${restaurant.name}.` },
      });
    }
  }

  if (loading && !restaurant) {
    return <Loading label="Loading restaurant" variant="page" />;
  }
  if (loadError) {
    return (
      <>
        <ErrorState error={loadError} onRetry={reload} notFoundText="That restaurant could not be found, or it is no longer listed." />
        <p className="auth-switch">
          <Link to="/restaurants">Back to all restaurants</Link>
        </p>
      </>
    );
  }

  const hasTables = restaurant.availableTables > 0;

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/restaurants">Restaurants</Link>
        <Icon name="chevron-right" size={16} />
        <Link to={`/restaurants/${restaurant.id}`}>{restaurant.name}</Link>
        <Icon name="chevron-right" size={16} />
        <span aria-current="page">Reserve</span>
      </nav>
      <header className="page-header">
        <div>
          <h1>Reserve at {restaurant.name}</h1>
          <p className="page-subtitle">
            <Icon name="pin" size={18} />
            {formatLocation(restaurant) || "Location not listed"} · {describeTables(restaurant.tableSummary)}
          </p>
        </div>
      </header>

      {hasTables ? (
        <Card raised>
          <AvailabilityPicker restaurantId={id} actionLabel="Reserve this table" busy={busy} onChoose={book}>
            <FormField
              id="notes"
              as="textarea"
              label="Special request"
              optional
              rows={2}
              maxLength={LIMITS.NOTES_MAX}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              hint={`For example a birthday or a seating request. ${notes.length}/${LIMITS.NOTES_MAX} characters.`}
            />
            <Alert>{error}</Alert>
          </AvailabilityPicker>
        </Card>
      ) : (
        <EmptyState
          title="No tables are open for booking"
          action={
            <ButtonLink to={`/restaurants/${restaurant.id}`} variant="primary">
              Back to restaurant details
            </ButtonLink>
          }
        >
          This restaurant has not set up tables for online reservations yet. Please contact them directly.
        </EmptyState>
      )}
    </>
  );
}
