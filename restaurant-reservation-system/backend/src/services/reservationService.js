import { BOOKING, MAX_TABLES_PER_RESTAURANT } from "../config/booking.js";
import { RESERVATION_STATUS, ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const isAdmin = (actor) => actor.role === ROLES.ADMIN;
const endTime = (startAt, durationMinutes) =>
  new Date(startAt.getTime() + durationMinutes * MINUTE_MS);

function assertDuration(durationMinutes) {
  const { MIN_DURATION_MINUTES: min, MAX_DURATION_MINUTES: max } = BOOKING;
  if (durationMinutes < min || durationMinutes > max) {
    throw new AppError(400, `Duration must be between ${min} and ${max} minutes.`);
  }
}

function assertStartAllowed(startAt) {
  const now = clock.now();
  if (startAt <= now) {
    throw new AppError(400, "The reservation must start in the future.");
  }
  if (startAt.getTime() - now.getTime() > BOOKING.MAX_ADVANCE_DAYS * DAY_MS) {
    throw new AppError(400, `Reservations can be made at most ${BOOKING.MAX_ADVANCE_DAYS} days ahead.`);
  }
}

function assertStillConfirmed(reservation) {
  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    throw new AppError(409, "Cancelled and completed reservations cannot be changed.");
  }
}

// Foreign reservations get the same 404 as missing ones, so IDs cannot be probed.
async function loadVisible(actor, id, repos = store) {
  const reservation = await repos.reservations.findById(id);
  if (!reservation || (!isAdmin(actor) && reservation.userId !== actor.id)) {
    throw new AppError(404, "Reservation not found.");
  }
  return reservation;
}

// Checks that the table can take a booking right now. Run inside a transaction.
async function loadBookableTable(repos, { restaurantId, tableId, guestCount }) {
  const table = await repos.tables.findById(tableId);
  if (!table) {
    throw new AppError(404, "Table not found.");
  }
  if (table.restaurantId !== restaurantId) {
    throw new AppError(400, "That table does not belong to the selected restaurant.");
  }
  const restaurant = await repos.restaurants.findById(restaurantId);
  if (!restaurant) {
    throw new AppError(404, "Restaurant not found.");
  }
  if (!restaurant.active || !table.active) {
    throw new AppError(409, "This restaurant or table is not accepting reservations.");
  }
  if (guestCount > table.capacity) {
    throw new AppError(400, `This table seats at most ${table.capacity} guests.`);
  }
  return table;
}

// Locking first makes simultaneous bookings for one table take turns, so the
// conflict check below cannot be fooled by a booking that is still in flight.
async function assertSlotFree(repos, { tableId, startAt, endAt, excludeId }) {
  await repos.tables.lockForBooking(tableId);
  const conflicts = await repos.reservations.findConflicts({ tableId, startAt, endAt, excludeId });
  if (conflicts.length > 0) {
    throw new AppError(409, "That table is already booked for the selected time.");
  }
}

export async function createReservation(actor, input) {
  const ownerId = input.userId ?? actor.id;
  if (ownerId !== actor.id && !isAdmin(actor)) {
    throw new AppError(403, "Only administrators can book on behalf of another user.");
  }
  const durationMinutes = input.durationMinutes ?? BOOKING.DEFAULT_DURATION_MINUTES;
  assertDuration(durationMinutes);
  assertStartAllowed(input.startAt);
  const endAt = endTime(input.startAt, durationMinutes);

  return store.transaction(async (tx) => {
    const owner = await tx.users.findById(ownerId);
    if (!owner) {
      throw new AppError(404, "User not found.");
    }
    const table = await loadBookableTable(tx, input);
    await assertSlotFree(tx, { tableId: table.id, startAt: input.startAt, endAt });

    return tx.reservations.create({
      userId: owner.id,
      restaurantId: table.restaurantId,
      tableId: table.id,
      // Copied from the account, never typed in by the client.
      guestName: owner.name,
      guestEmail: owner.email,
      guestCount: input.guestCount,
      startAt: input.startAt,
      endAt,
      durationMinutes,
      notes: input.notes,
    });
  });
}

export function listReservations(actor, { page, limit, restaurantId, tableId, status }) {
  const filter = { restaurantId, tableId, status };
  if (!isAdmin(actor)) {
    filter.userId = actor.id;
  }
  return store.reservations.list({ filter, page, limit });
}

export function getReservation(actor, id) {
  return loadVisible(actor, id);
}

export async function updateReservation(actor, id, changes) {
  const { status, ...edits } = changes;
  if (status === undefined) {
    return editReservation(actor, id, edits);
  }
  if (Object.keys(edits).length > 0) {
    throw new AppError(400, "A status change must be sent on its own.");
  }
  return changeStatus(actor, id, status);
}

function changeStatus(actor, id, status) {
  return store.transaction(async (tx) => {
    const reservation = await loadVisible(actor, id, tx);
    assertStillConfirmed(reservation);
    const now = clock.now();

    if (status === RESERVATION_STATUS.COMPLETED) {
      if (!isAdmin(actor)) {
        throw new AppError(403, "Only administrators can complete reservations.");
      }
      if (now < reservation.endAt) {
        throw new AppError(409, "A reservation can only be completed after its end time.");
      }
    } else if (!isAdmin(actor) && now >= reservation.startAt) {
      throw new AppError(409, "A reservation that has started can no longer be cancelled.");
    }
    return tx.reservations.update(id, { status });
  });
}

function editReservation(actor, id, edits) {
  return store.transaction(async (tx) => {
    const current = await loadVisible(actor, id, tx);
    assertStillConfirmed(current);
    if (!isAdmin(actor) && clock.now() >= current.startAt) {
      throw new AppError(409, "A reservation that has started can no longer be changed.");
    }

    const next = {
      tableId: edits.tableId ?? current.tableId,
      guestCount: edits.guestCount ?? current.guestCount,
      startAt: edits.startAt ?? current.startAt,
      durationMinutes: edits.durationMinutes ?? current.durationMinutes,
    };
    const startChanged = next.startAt.getTime() !== current.startAt.getTime();
    const bookingChanged =
      startChanged ||
      next.tableId !== current.tableId ||
      next.guestCount !== current.guestCount ||
      next.durationMinutes !== current.durationMinutes;

    const data = {};
    if (edits.notes !== undefined && edits.notes !== current.notes) {
      data.notes = edits.notes;
    }

    // Notes alone can always be edited. Anything that affects the booking
    // must pass every booking rule again.
    if (bookingChanged) {
      if (startChanged) {
        assertStartAllowed(next.startAt);
      }
      if (next.durationMinutes !== current.durationMinutes) {
        assertDuration(next.durationMinutes);
      }
      const table = await loadBookableTable(tx, {
        restaurantId: current.restaurantId,
        tableId: next.tableId,
        guestCount: next.guestCount,
      });
      const endAt = endTime(next.startAt, next.durationMinutes);
      await assertSlotFree(tx, { tableId: table.id, startAt: next.startAt, endAt, excludeId: id });
      Object.assign(data, {
        tableId: table.id,
        guestCount: next.guestCount,
        startAt: next.startAt,
        endAt,
        durationMinutes: next.durationMinutes,
      });
    }

    return Object.keys(data).length > 0 ? tx.reservations.update(id, data) : current;
  });
}

export async function deleteReservation(actor, id) {
  if (!isAdmin(actor)) {
    throw new AppError(403, "Only administrators can delete reservations.");
  }
  const reservation = await store.reservations.findById(id);
  if (!reservation) {
    throw new AppError(404, "Reservation not found.");
  }
  if (reservation.status !== RESERVATION_STATUS.CANCELLED) {
    throw new AppError(409, "Only cancelled reservations can be deleted.");
  }
  await store.reservations.delete(id);
}

export async function findAvailableTables(actor, query) {
  const { restaurantId, startAt, guestCount, excludeId } = query;
  const durationMinutes = query.durationMinutes ?? BOOKING.DEFAULT_DURATION_MINUTES;
  assertDuration(durationMinutes);
  assertStartAllowed(startAt);

  // Without this check, passing someone else's reservation id would reveal
  // whether a table frees up for them.
  if (excludeId) {
    await loadVisible(actor, excludeId);
  }
  const restaurant = await store.restaurants.findById(restaurantId);
  if (!restaurant || !restaurant.active) {
    throw new AppError(404, "Restaurant not found.");
  }

  const endAt = endTime(startAt, durationMinutes);
  const { items: tables } = await store.tables.list({
    filter: { restaurantId, active: true },
    page: 1,
    limit: MAX_TABLES_PER_RESTAURANT,
  });
  const conflicts = await store.reservations.findConflicts({
    restaurantId,
    startAt,
    endAt,
    excludeId,
  });
  const busy = new Set(conflicts.map((reservation) => reservation.tableId));

  return tables
    .filter((table) => table.capacity >= guestCount && !busy.has(table.id))
    .sort((a, b) => a.capacity - b.capacity || a.label.localeCompare(b.label));
}

// Adds display names (derived, never stored) so the client needs no extra lookups.
export async function withNames(reservations) {
  const restaurantIds = [...new Set(reservations.map((r) => r.restaurantId))];
  const tableIds = [...new Set(reservations.map((r) => r.tableId))];
  const [restaurants, tables] = await Promise.all([
    Promise.all(restaurantIds.map((id) => store.restaurants.findById(id))),
    Promise.all(tableIds.map((id) => store.tables.findById(id))),
  ]);
  const restaurantNames = new Map(restaurants.filter(Boolean).map((r) => [r.id, r.name]));
  const tableLabels = new Map(tables.filter(Boolean).map((t) => [t.id, t.label]));
  return reservations.map((reservation) => ({
    ...reservation,
    restaurantName: restaurantNames.get(reservation.restaurantId) ?? "Unknown restaurant",
    tableLabel: tableLabels.get(reservation.tableId) ?? "Unknown table",
  }));
}
