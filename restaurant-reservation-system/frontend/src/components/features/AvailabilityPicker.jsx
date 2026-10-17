import { useState } from "react";
import { useBookingConfig } from "../../hooks/useBookingConfig.js";
import { reservationService } from "../../services/reservationService.js";
import { durationOptions, formatDateTime, formatDuration, localInputBounds, localInputToUtcIso } from "../../utils/datetime.js";
import { fieldErrors } from "../../utils/errors.js";
import { compact, validateWhen, validateWholeNumber } from "../../utils/validation.js";
import Alert from "../ui/Alert.jsx";
import Button from "../ui/Button.jsx";
import FormField from "../ui/FormField.jsx";

// Searches free tables for a time and party size. `excludeId` lets an existing
// reservation ignore itself while being rescheduled. `children` renders between
// the search form and the results (the booking page puts its notes field there).
export default function AvailabilityPicker({
  restaurantId,
  excludeId,
  initial,
  currentTableId,
  actionLabel,
  busy,
  onChoose,
  children,
}) {
  const config = useBookingConfig();
  const [values, setValues] = useState({
    when: initial?.when ?? "",
    guests: String(initial?.guests ?? 2),
    duration: String(initial?.duration ?? 90),
  });
  const [tables, setTables] = useState(null);
  const [searched, setSearched] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});

  const bounds = localInputBounds(config.MAX_ADVANCE_DAYS);
  const durations = durationOptions(config.MIN_DURATION_MINUTES, config.MAX_DURATION_MINUTES);

  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  async function search(event) {
    event.preventDefault();
    setError("");
    setTables(null);
    const found = compact({
      startAt: validateWhen(values.when, config.MAX_ADVANCE_DAYS),
      guestCount: validateWholeNumber("Guests", values.guests, 1, config.MAX_GUESTS),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }

    setSearching(true);
    try {
      const startAt = localInputToUtcIso(values.when);
      const result = await reservationService.availability({
        restaurantId,
        startAt,
        guestCount: values.guests,
        durationMinutes: values.duration,
        excludeId,
      });
      setTables(result.tables);
      setSearched({ startAt, guestCount: Number(values.guests), durationMinutes: Number(values.duration) });
    } catch (err) {
      setError(err.message);
      setErrors(fieldErrors(err));
    } finally {
      setSearching(false);
    }
  }

  return (
    <section aria-labelledby="availability-heading">
      <h2 id="availability-heading">Find a table</h2>
      <form onSubmit={search} noValidate>
        <div className="search-grid">
          <FormField
            id="when"
            name="when"
            label="Date and time"
            type="datetime-local"
            value={values.when}
            min={bounds.min}
            max={bounds.max}
            onChange={change}
            error={errors.startAt}
            required
          />
          <FormField
            id="guests"
            name="guests"
            label="Guests"
            type="number"
            inputMode="numeric"
            min="1"
            max={config.MAX_GUESTS}
            value={values.guests}
            onChange={change}
            error={errors.guestCount}
            required
          />
          <FormField
            id="duration"
            name="duration"
            label="Length of stay"
            as="select"
            value={values.duration}
            onChange={change}
            error={errors.durationMinutes}
          >
            {durations.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </FormField>
          <div className="search-action">
            <Button type="submit" variant="primary" loading={searching}>
              Search tables
            </Button>
          </div>
        </div>
      </form>

      {children}
      <Alert>{error}</Alert>

      {tables && (
        <div>
          <h3 className="results-heading" aria-live="polite">
            {tables.length === 0
              ? "No tables available"
              : `${tables.length} ${tables.length === 1 ? "table" : "tables"} available`}
          </h3>
          {tables.length === 0 ? (
            <p className="muted">
              Nothing is free for {searched.guestCount} {searched.guestCount === 1 ? "guest" : "guests"} on{" "}
              {formatDateTime(searched.startAt)}. Try another time or a smaller party.
            </p>
          ) : (
            <ul className="table-choices" aria-label="Available tables">
              {tables.map((table) => (
                <li key={table.id} className="table-choice">
                  <div>
                    <strong>Table {table.label}</strong>
                    <small>
                      Seats {table.capacity}
                      {table.id === currentTableId ? " · your current table" : ""}
                    </small>
                  </div>
                  <Button variant="primary" size="sm" disabled={busy} onClick={() => onChoose(table, searched)}>
                    {actionLabel}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
