import { ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";

const isAdmin = (actor) => actor.role === ROLES.ADMIN;
const EMPTY_PAGE = Object.freeze({ items: [], total: 0 });

async function assertLabelFree(restaurantId, label, ownId) {
  const existing = await store.tables.findByLabel(restaurantId, label);
  if (existing && existing.id !== ownId) {
    throw new AppError(409, "A table with that label already exists in this restaurant.");
  }
}

// Regular users must name a restaurant, and only see active tables of an
// active restaurant. Admins can list everything and filter freely.
export async function listTables(actor, { page, limit, restaurantId, active }) {
  if (isAdmin(actor)) {
    return store.tables.list({ filter: { restaurantId, active }, page, limit });
  }
  if (!restaurantId) {
    throw new AppError(400, "restaurantId is required.");
  }
  const restaurant = await store.restaurants.findById(restaurantId);
  if (!restaurant || !restaurant.active) {
    return EMPTY_PAGE;
  }
  return store.tables.list({ filter: { restaurantId, active: true }, page, limit });
}

export async function getTable(actor, id) {
  const table = await store.tables.findById(id);
  if (!table) {
    throw new AppError(404, "Table not found.");
  }
  if (!isAdmin(actor)) {
    const restaurant = await store.restaurants.findById(table.restaurantId);
    if (!table.active || !restaurant?.active) {
      throw new AppError(404, "Table not found.");
    }
  }
  return table;
}

export async function createTable({ restaurantId, label, capacity, active }) {
  if (!(await store.restaurants.findById(restaurantId))) {
    throw new AppError(400, "restaurantId does not match an existing restaurant.");
  }
  await assertLabelFree(restaurantId, label);
  return store.tables.create({ restaurantId, label, capacity, active });
}

// Runs under the booking lock so a reservation cannot slip in while the
// capacity is being lowered or the table deactivated.
export function updateTable(id, changes) {
  return store.transaction(async (tx) => {
    const table = await tx.tables.lockForBooking(id);
    if (!table) {
      throw new AppError(404, "Table not found.");
    }
    if (changes.label !== undefined) {
      const existing = await tx.tables.findByLabel(table.restaurantId, changes.label);
      if (existing && existing.id !== id) {
        throw new AppError(409, "A table with that label already exists in this restaurant.");
      }
    }
    if (changes.capacity !== undefined && changes.capacity < table.capacity) {
      const upcoming = await tx.reservations.findUpcomingOrOngoing({
        tableId: id,
        now: clock.now(),
      });
      const largestParty = Math.max(0, ...upcoming.map((r) => r.guestCount));
      if (changes.capacity < largestParty) {
        throw new AppError(
          409,
          `Capacity cannot be lower than ${largestParty}, the largest upcoming reservation.`
        );
      }
    }
    return tx.tables.update(id, changes);
  });
}

export function deleteTable(id) {
  return store.transaction(async (tx) => {
    if (!(await tx.tables.lockForBooking(id))) {
      throw new AppError(404, "Table not found.");
    }
    if (await tx.reservations.existsForTable(id)) {
      throw new AppError(409, "Tables with reservation history cannot be deleted.");
    }
    await tx.tables.delete(id);
  });
}
