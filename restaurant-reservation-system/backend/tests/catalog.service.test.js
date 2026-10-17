import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { START, makeRestaurant, makeTable, makeUser, rejectsWith, resetState, store } from "./helpers.js";
import * as reservationService from "../src/services/reservationService.js";
import * as restaurantService from "../src/services/restaurantService.js";
import * as tableService from "../src/services/tableService.js";

const MISSING_ID = "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70";
let admin;
let user;

beforeEach(async () => {
  resetState();
  admin = await makeUser({ role: "admin" });
  user = await makeUser();
});

describe("restaurants", () => {
  it("shows regular users only active restaurants, and admins everything", async () => {
    await makeRestaurant({ name: "Open" });
    await makeRestaurant({ name: "Closed", active: false });
    const forUser = await restaurantService.listRestaurants(user, { page: 1, limit: 10 });
    const forAdmin = await restaurantService.listRestaurants(admin, { page: 1, limit: 10 });
    assert.deepEqual(forUser.items.map((r) => r.name), ["Open"]);
    assert.equal(forAdmin.total, 2);
  });

  it("lets admins filter by active status", async () => {
    await makeRestaurant();
    await makeRestaurant({ active: false });
    const inactive = await restaurantService.listRestaurants(admin, { page: 1, limit: 10, status: "inactive" });
    assert.equal(inactive.total, 1);
  });

  it("hides an inactive restaurant from users with a 404", async () => {
    const closed = await makeRestaurant({ active: false });
    await rejectsWith(restaurantService.getRestaurant(user, closed.id), 404);
    assert.equal((await restaurantService.getRestaurant(admin, closed.id)).id, closed.id);
  });

  it("updates and deactivates a restaurant", async () => {
    const restaurant = await makeRestaurant();
    const updated = await restaurantService.updateRestaurant(restaurant.id, { active: false, name: "Renamed" });
    assert.equal(updated.active, false);
    assert.equal(updated.name, "Renamed");
    await rejectsWith(restaurantService.updateRestaurant(MISSING_ID, { name: "x" }), 404);
  });

  it("refuses to delete a restaurant that still has tables", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id);
    await rejectsWith(restaurantService.deleteRestaurant(restaurant.id), 409);
    await tableService.deleteTable(table.id);
    await restaurantService.deleteRestaurant(restaurant.id);
    assert.equal(await store.restaurants.findById(restaurant.id), null);
  });
});

describe("tables", () => {
  it("creates a table and rejects duplicate labels ignoring case", async () => {
    const restaurant = await makeRestaurant();
    await tableService.createTable({ restaurantId: restaurant.id, label: "Window 1", capacity: 4 });
    await rejectsWith(
      tableService.createTable({ restaurantId: restaurant.id, label: "window 1", capacity: 2 }),
      409
    );
    const other = await makeRestaurant();
    await tableService.createTable({ restaurantId: other.id, label: "Window 1", capacity: 2 });
  });

  it("rejects a table for a restaurant that does not exist", async () => {
    await rejectsWith(tableService.createTable({ restaurantId: MISSING_ID, label: "A", capacity: 2 }), 400);
  });

  it("requires users to name a restaurant and hides inactive ones", async () => {
    const restaurant = await makeRestaurant();
    await makeTable(restaurant.id);
    await makeTable(restaurant.id, { active: false });
    await rejectsWith(tableService.listTables(user, { page: 1, limit: 10 }), 400);

    const visible = await tableService.listTables(user, { page: 1, limit: 10, restaurantId: restaurant.id });
    assert.equal(visible.total, 1);

    const closed = await makeRestaurant({ active: false });
    await makeTable(closed.id);
    const hidden = await tableService.listTables(user, { page: 1, limit: 10, restaurantId: closed.id });
    assert.equal(hidden.total, 0);
    const adminView = await tableService.listTables(admin, { page: 1, limit: 10, restaurantId: closed.id });
    assert.equal(adminView.total, 1);
  });

  it("hides inactive tables from users on direct lookup", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id, { active: false });
    await rejectsWith(tableService.getTable(user, table.id), 404);
    assert.equal((await tableService.getTable(admin, table.id)).id, table.id);
  });

  it("does not expose the internal booking counter", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id);
    assert.equal("bookingVersion" in (await tableService.getTable(admin, table.id)), false);
  });

  it("prevents renaming a table to a label already in use", async () => {
    const restaurant = await makeRestaurant();
    await makeTable(restaurant.id, { label: "A1" });
    const second = await makeTable(restaurant.id, { label: "A2" });
    await rejectsWith(tableService.updateTable(second.id, { label: "a1" }), 409);
    const renamed = await tableService.updateTable(second.id, { label: "A2" });
    assert.equal(renamed.label, "A2");
  });

  it("blocks lowering capacity below an upcoming reservation but allows raising it", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id, { capacity: 6 });
    await reservationService.createReservation(user, {
      restaurantId: restaurant.id,
      tableId: table.id,
      guestCount: 5,
      startAt: START,
      durationMinutes: 60,
    });
    await rejectsWith(tableService.updateTable(table.id, { capacity: 4 }), 409);
    assert.equal((await tableService.updateTable(table.id, { capacity: 5 })).capacity, 5);
    assert.equal((await tableService.updateTable(table.id, { capacity: 8 })).capacity, 8);
  });

  it("keeps existing reservations when a table or restaurant is deactivated", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id);
    const reservation = await reservationService.createReservation(user, {
      restaurantId: restaurant.id,
      tableId: table.id,
      guestCount: 2,
      startAt: START,
      durationMinutes: 60,
    });
    await tableService.updateTable(table.id, { active: false });
    await restaurantService.updateRestaurant(restaurant.id, { active: false });
    const still = await reservationService.getReservation(user, reservation.id);
    assert.equal(still.status, "confirmed");
  });

  it("refuses to delete a table that has reservation history", async () => {
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id);
    const reservation = await reservationService.createReservation(user, {
      restaurantId: restaurant.id,
      tableId: table.id,
      guestCount: 2,
      startAt: START,
      durationMinutes: 60,
    });
    await reservationService.updateReservation(user, reservation.id, { status: "cancelled" });
    await rejectsWith(tableService.deleteTable(table.id), 409);
    await rejectsWith(tableService.deleteTable(MISSING_ID), 404);
  });
});
