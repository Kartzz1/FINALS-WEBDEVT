import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  NOW,
  START,
  clock,
  makeRestaurant,
  makeTable,
  makeUser,
  rejectsWith,
  resetState,
  store,
} from "./helpers.js";
import * as reservationService from "../src/services/reservationService.js";

const MISSING_ID = "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70";
const MINUTE_MS = 60 * 1000;
let admin;
let alice;
let bob;
let restaurant;
let table; // seats 4
let smallTable; // seats 2

const at = (iso) => new Date(iso);
const setClock = (iso) => {
  clock.now = () => at(iso);
};

function book(actor, overrides = {}) {
  return reservationService.createReservation(actor, {
    restaurantId: restaurant.id,
    tableId: table.id,
    guestCount: 2,
    startAt: START,
    durationMinutes: 60,
    ...overrides,
  });
}

beforeEach(async () => {
  resetState();
  admin = await makeUser({ role: "admin" });
  alice = await makeUser({ name: "Alice", email: "alice@example.com" });
  bob = await makeUser({ name: "Bob", email: "bob@example.com" });
  restaurant = await makeRestaurant();
  table = await makeTable(restaurant.id, { capacity: 4 });
  smallTable = await makeTable(restaurant.id, { capacity: 2 });
});

describe("creating reservations", () => {
  it("books a confirmed reservation and copies guest details from the account", async () => {
    const reservation = await book(alice);
    assert.equal(reservation.status, "confirmed");
    assert.equal(reservation.userId, alice.id);
    assert.equal(reservation.guestName, "Alice");
    assert.equal(reservation.guestEmail, "alice@example.com");
    assert.equal(reservation.endAt.toISOString(), "2030-06-02T19:00:00.000Z");
  });

  it("uses the default duration when none is given", async () => {
    const reservation = await book(alice, { durationMinutes: undefined });
    assert.equal(reservation.durationMinutes, 90);
    assert.equal(reservation.endAt.toISOString(), "2030-06-02T19:30:00.000Z");
  });

  it("rejects start times that are not in the future", async () => {
    await rejectsWith(book(alice, { startAt: at("2030-05-31T18:00:00Z") }), 400);
    await rejectsWith(book(alice, { startAt: NOW }), 400);
  });

  it("rejects bookings beyond the advance-booking limit", async () => {
    await rejectsWith(book(alice, { startAt: at("2030-08-15T18:00:00Z") }), 400);
    await book(alice, { startAt: at("2030-07-30T18:00:00Z") });
  });

  it("rejects durations outside the allowed range", async () => {
    await rejectsWith(book(alice, { durationMinutes: 10 }), 400);
    await rejectsWith(book(alice, { durationMinutes: 300 }), 400);
  });

  it("rejects a party larger than the table", async () => {
    await rejectsWith(book(alice, { tableId: smallTable.id, guestCount: 3 }), 400);
    await book(alice, { tableId: smallTable.id, guestCount: 2 });
  });

  it("rejects inactive tables and restaurants", async () => {
    await store.tables.update(smallTable.id, { active: false });
    await rejectsWith(book(alice, { tableId: smallTable.id }), 409);
    await store.restaurants.update(restaurant.id, { active: false });
    await rejectsWith(book(alice), 409);
  });

  it("rejects missing tables and tables from another restaurant", async () => {
    await rejectsWith(book(alice, { tableId: MISSING_ID }), 404);
    const other = await makeRestaurant({ name: "Elsewhere" });
    const foreignTable = await makeTable(other.id);
    await rejectsWith(book(alice, { tableId: foreignTable.id }), 400);
  });

  it("lets users book only for themselves, but admins for anyone", async () => {
    await rejectsWith(book(alice, { userId: bob.id }), 403);
    await book(alice, { userId: alice.id, tableId: smallTable.id });

    const onBehalf = await book(admin, { userId: bob.id });
    assert.equal(onBehalf.userId, bob.id);
    assert.equal(onBehalf.guestName, "Bob");
    assert.equal(onBehalf.guestEmail, "bob@example.com");
    await rejectsWith(book(admin, { userId: MISSING_ID, startAt: at("2030-06-03T18:00:00Z") }), 404);
  });
});

describe("double-booking prevention", () => {
  it("rejects overlapping confirmed reservations on the same table", async () => {
    await book(alice);
    await rejectsWith(book(bob), 409);
    await rejectsWith(book(bob, { startAt: at("2030-06-02T18:30:00Z") }), 409);
    await rejectsWith(book(bob, { startAt: at("2030-06-02T17:30:00Z") }), 409);
    await rejectsWith(book(bob, { startAt: at("2030-06-02T18:15:00Z"), durationMinutes: 30 }), 409);
  });

  it("allows back-to-back reservations", async () => {
    await book(alice);
    await book(bob, { startAt: at("2030-06-02T19:00:00Z") });
    await book(bob, { startAt: at("2030-06-02T17:00:00Z") });
  });

  it("allows the same time on a different table", async () => {
    await book(alice);
    await book(bob, { tableId: smallTable.id });
  });

  it("frees the slot when a reservation is cancelled", async () => {
    const first = await book(alice);
    await reservationService.updateReservation(alice, first.id, { status: "cancelled" });
    await book(bob);
  });

  it("lets exactly one of several simultaneous requests succeed", async () => {
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => makeUser()));
    const results = await Promise.allSettled(users.map((user) => book(user)));
    const winners = results.filter((result) => result.status === "fulfilled");
    const losers = results.filter((result) => result.status === "rejected");
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 4);
    for (const loser of losers) {
      assert.equal(loser.reason.status, 409);
    }
  });
});

describe("ownership and visibility", () => {
  it("shows users only their own reservations and admins all of them", async () => {
    await book(alice);
    await book(bob, { tableId: smallTable.id });
    const mine = await reservationService.listReservations(alice, { page: 1, limit: 10 });
    assert.equal(mine.total, 1);
    assert.equal(mine.items[0].userId, alice.id);
    const all = await reservationService.listReservations(admin, { page: 1, limit: 10 });
    assert.equal(all.total, 2);
  });

  it("applies filters, but a user can never filter their way into other users' data", async () => {
    await book(alice);
    const bobs = await book(bob, { tableId: smallTable.id });
    const onSmallTable = await reservationService.listReservations(alice, {
      page: 1,
      limit: 10,
      tableId: smallTable.id,
    });
    assert.equal(onSmallTable.total, 0);
    const cancelled = await reservationService.listReservations(admin, {
      page: 1,
      limit: 10,
      status: "cancelled",
    });
    assert.equal(cancelled.total, 0);
    assert.ok(bobs.id);
  });

  it("returns 404 for another user's reservation on every operation", async () => {
    const aliceBooking = await book(alice);
    await rejectsWith(reservationService.getReservation(bob, aliceBooking.id), 404);
    await rejectsWith(reservationService.updateReservation(bob, aliceBooking.id, { notes: "hi" }), 404);
    await rejectsWith(reservationService.updateReservation(bob, aliceBooking.id, { status: "cancelled" }), 404);
    await rejectsWith(
      reservationService.updateReservation(bob, aliceBooking.id, {
        tableId: table.id,
        guestCount: 2,
        startAt: START,
        durationMinutes: 60,
      }),
      404
    );
    assert.equal((await reservationService.getReservation(alice, aliceBooking.id)).id, aliceBooking.id);
    assert.equal((await reservationService.getReservation(admin, aliceBooking.id)).id, aliceBooking.id);
    assert.equal((await reservationService.getReservation(alice, aliceBooking.id)).status, "confirmed");
  });

  it("gives a missing reservation the same 404", async () => {
    await rejectsWith(reservationService.getReservation(alice, MISSING_ID), 404);
  });
});

describe("cancelling and completing", () => {
  it("lets the owner cancel before the reservation starts", async () => {
    const reservation = await book(alice);
    const cancelled = await reservationService.updateReservation(alice, reservation.id, { status: "cancelled" });
    assert.equal(cancelled.status, "cancelled");
  });

  it("stops users from cancelling once it has started, but not admins", async () => {
    const reservation = await book(alice);
    setClock("2030-06-02T18:30:00Z");
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { status: "cancelled" }), 409);
    const cancelled = await reservationService.updateReservation(admin, reservation.id, { status: "cancelled" });
    assert.equal(cancelled.status, "cancelled");
  });

  it("lets only administrators complete, and only after the end time", async () => {
    const reservation = await book(alice);
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { status: "completed" }), 403);

    setClock("2030-06-02T18:30:00Z");
    await rejectsWith(reservationService.updateReservation(admin, reservation.id, { status: "completed" }), 409);

    setClock("2030-06-02T19:30:00Z");
    const done = await reservationService.updateReservation(admin, reservation.id, { status: "completed" });
    assert.equal(done.status, "completed");
  });

  it("treats cancelled and completed reservations as final", async () => {
    const first = await book(alice);
    await reservationService.updateReservation(alice, first.id, { status: "cancelled" });
    await rejectsWith(reservationService.updateReservation(alice, first.id, { notes: "late edit" }), 409);
    await rejectsWith(reservationService.updateReservation(admin, first.id, { status: "completed" }), 409);

    const second = await book(alice, { startAt: at("2030-06-03T18:00:00Z") });
    setClock("2030-06-03T20:00:00Z");
    await reservationService.updateReservation(admin, second.id, { status: "completed" });
    await rejectsWith(reservationService.updateReservation(admin, second.id, { status: "cancelled" }), 409);
  });

  it("requires a status change to be sent on its own", async () => {
    const reservation = await book(alice);
    await rejectsWith(
      reservationService.updateReservation(alice, reservation.id, { status: "cancelled", notes: "x" }),
      400
    );
  });
});

describe("editing and rescheduling", () => {
  it("reschedules and recalculates the end time", async () => {
    const reservation = await book(alice);
    const moved = await reservationService.updateReservation(alice, reservation.id, {
      startAt: at("2030-06-03T12:00:00Z"),
      durationMinutes: 90,
    });
    assert.equal(moved.startAt.toISOString(), "2030-06-03T12:00:00.000Z");
    assert.equal(moved.endAt.toISOString(), "2030-06-03T13:30:00.000Z");
    assert.equal(moved.durationMinutes, 90);
  });

  it("does not let a reservation conflict with itself", async () => {
    const reservation = await book(alice);
    const shifted = await reservationService.updateReservation(alice, reservation.id, {
      startAt: at("2030-06-02T18:30:00Z"),
    });
    assert.equal(shifted.endAt.toISOString(), "2030-06-02T19:30:00.000Z");
  });

  it("rejects moving onto another reservation", async () => {
    await book(bob);
    const mine = await book(alice, { startAt: at("2030-06-02T20:00:00Z") });
    await rejectsWith(
      reservationService.updateReservation(alice, mine.id, { startAt: at("2030-06-02T18:30:00Z") }),
      409
    );
  });

  it("can switch to another table in the same restaurant only", async () => {
    const reservation = await book(alice);
    const moved = await reservationService.updateReservation(alice, reservation.id, { tableId: smallTable.id });
    assert.equal(moved.tableId, smallTable.id);

    const other = await makeRestaurant({ name: "Elsewhere" });
    const foreign = await makeTable(other.id);
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { tableId: foreign.id }), 400);
  });

  it("re-checks capacity, the future-start rule, and duration limits", async () => {
    const reservation = await book(alice);
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { guestCount: 9 }), 400);
    await rejectsWith(
      reservationService.updateReservation(alice, reservation.id, { startAt: at("2030-05-30T18:00:00Z") }),
      400
    );
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { durationMinutes: 600 }), 400);
  });

  it("still allows a notes-only edit after the table is deactivated, but nothing else", async () => {
    const reservation = await book(alice);
    await store.tables.update(table.id, { active: false });
    const edited = await reservationService.updateReservation(alice, reservation.id, { notes: "Window seat" });
    assert.equal(edited.notes, "Window seat");
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { guestCount: 3 }), 409);
  });

  it("stops users from editing a reservation that has started, while admins can", async () => {
    const reservation = await book(alice);
    setClock("2030-06-02T18:30:00Z");
    await rejectsWith(reservationService.updateReservation(alice, reservation.id, { notes: "late" }), 409);
    const extended = await reservationService.updateReservation(admin, reservation.id, { durationMinutes: 90 });
    assert.equal(extended.endAt.getTime() - extended.startAt.getTime(), 90 * MINUTE_MS);
  });

  it("returns the reservation untouched when nothing actually changes", async () => {
    const reservation = await book(alice);
    const same = await reservationService.updateReservation(alice, reservation.id, { guestCount: 2 });
    assert.equal(same.id, reservation.id);
    assert.equal(same.guestCount, 2);
  });
});

describe("deleting", () => {
  it("is limited to administrators and to cancelled reservations", async () => {
    const reservation = await book(alice);
    await rejectsWith(reservationService.deleteReservation(alice, reservation.id), 403);
    await rejectsWith(reservationService.deleteReservation(admin, reservation.id), 409);
    await reservationService.updateReservation(alice, reservation.id, { status: "cancelled" });
    await reservationService.deleteReservation(admin, reservation.id);
    await rejectsWith(reservationService.getReservation(admin, reservation.id), 404);
    await rejectsWith(reservationService.deleteReservation(admin, reservation.id), 404);
  });
});

describe("availability search", () => {
  const search = (actor, overrides = {}) =>
    reservationService.findAvailableTables(actor, {
      restaurantId: restaurant.id,
      startAt: START,
      guestCount: 2,
      durationMinutes: 60,
      ...overrides,
    });

  it("returns free tables that fit the party, smallest first", async () => {
    const tables = await search(alice);
    assert.deepEqual(tables.map((t) => t.id), [smallTable.id, table.id]);
    const larger = await search(alice, { guestCount: 3 });
    assert.deepEqual(larger.map((t) => t.id), [table.id]);
  });

  it("leaves out booked and inactive tables", async () => {
    await book(bob, { tableId: smallTable.id });
    assert.deepEqual((await search(alice)).map((t) => t.id), [table.id]);
    await store.tables.update(table.id, { active: false });
    assert.deepEqual(await search(alice), []);
  });

  it("treats back-to-back as free", async () => {
    await book(bob, { tableId: smallTable.id, startAt: at("2030-06-02T17:00:00Z") });
    assert.ok((await search(alice)).some((t) => t.id === smallTable.id));
  });

  it("can ignore the reservation being edited", async () => {
    const mine = await book(alice, { tableId: smallTable.id });
    assert.ok(!(await search(alice)).some((t) => t.id === smallTable.id));
    assert.ok((await search(alice, { excludeId: mine.id })).some((t) => t.id === smallTable.id));
  });

  it("does not let a user probe someone else's reservation through excludeId", async () => {
    const bobs = await book(bob, { tableId: smallTable.id });
    await rejectsWith(search(alice, { excludeId: bobs.id }), 404);
    assert.ok((await search(admin, { excludeId: bobs.id })).some((t) => t.id === smallTable.id));
  });

  it("rejects unknown or inactive restaurants and bad times", async () => {
    await rejectsWith(search(alice, { restaurantId: MISSING_ID }), 404);
    await rejectsWith(search(alice, { startAt: at("2030-05-30T18:00:00Z") }), 400);
    await store.restaurants.update(restaurant.id, { active: false });
    await rejectsWith(search(alice), 404);
  });
});

describe("display names", () => {
  it("adds the restaurant name and table label without storing them", async () => {
    const reservation = await book(alice);
    const [named] = await reservationService.withNames([reservation]);
    assert.equal(named.restaurantName, "Test Bistro");
    assert.equal(named.tableLabel, table.label);
    const stored = await store.reservations.findById(reservation.id);
    assert.equal("restaurantName" in stored, false);
  });

  it("falls back gracefully when the table no longer exists", async () => {
    const reservation = await book(alice);
    await store.tables.delete(table.id);
    const [named] = await reservationService.withNames([reservation]);
    assert.equal(named.tableLabel, "Unknown table");
    assert.equal(named.restaurantName, "Test Bistro");
  });
});
