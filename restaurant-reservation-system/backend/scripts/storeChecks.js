import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { RESERVATION_STATUS } from "../src/constants.js";
import { AppError } from "../src/utils/AppError.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const RACING_ATTEMPTS = 5;

// A reservation window on a fixed future date, in minutes after midnight UTC.
function slot(startMinutes, durationMinutes = 60) {
  const startAt = new Date(Date.UTC(2030, 0, 1, 0, startMinutes));
  return { startAt, endAt: new Date(startAt.getTime() + durationMinutes * MINUTE_MS) };
}

async function expectStatus(promise, status) {
  await assert.rejects(
    promise,
    (err) => err instanceof AppError && err.status === status
  );
}

export async function runStoreChecks(store) {
  const suffix = randomUUID().slice(0, 8);
  const created = { users: [], restaurants: [], tables: [], reservations: [] };
  const pass = (name) => console.log(`ok - ${name}`);

  try {
    const user = await store.users.create({
      name: "Check User",
      email: `Check.${suffix}@Example.com`,
      passwordHash: "hash-value",
    });
    created.users.push(user.id);
    assert.equal(user.email, `check.${suffix}@example.com`);
    assert.equal(user.role, "user");
    assert.equal("passwordHash" in user, false);
    pass("user is created with normalized email, default role, and no hash");

    const byEmail = await store.users.findByEmail(`CHECK.${suffix}@example.com`);
    assert.equal(byEmail.id, user.id);
    assert.equal("passwordHash" in byEmail, false);
    const withHash = await store.users.findByEmail(user.email, { withPassword: true });
    assert.equal(withHash.passwordHash, "hash-value");
    const byId = await store.users.findById(user.id);
    assert.equal("passwordHash" in byId, false);
    pass("password hash is returned only when explicitly requested");

    await expectStatus(
      store.users.create({ name: "Dup", email: user.email.toUpperCase(), passwordHash: "x" }),
      409
    );
    pass("duplicate email is rejected with 409, ignoring case");

    const keep = await store.sessions.create({
      userId: user.id,
      expiresAt: new Date(Date.now() + HOUR_MS),
    });
    const drop = await store.sessions.create({
      userId: user.id,
      expiresAt: new Date(Date.now() + HOUR_MS),
    });
    await store.sessions.deleteByUserId(user.id, { exceptId: keep.id });
    assert.ok(await store.sessions.findById(keep.id));
    assert.equal(await store.sessions.findById(drop.id), null);
    await store.sessions.delete(keep.id);
    pass("revoking other sessions keeps only the current one");

    const restaurant = await store.restaurants.create({
      name: `Check Cafe ${suffix}`,
      address: "1 Test Street",
    });
    created.restaurants.push(restaurant.id);
    assert.equal(restaurant.active, true);
    assert.equal(await store.restaurants.update(randomUUID(), { name: "Nobody" }), null);
    pass("restaurant defaults apply and updating a missing id returns null");

    const table = await store.tables.create({
      restaurantId: restaurant.id,
      label: "T1",
      capacity: 4,
    });
    created.tables.push(table.id);
    assert.equal("bookingVersion" in table, false);
    await expectStatus(
      store.tables.create({ restaurantId: restaurant.id, label: "t1", capacity: 2 }),
      409
    );
    assert.equal(await store.tables.countByRestaurant(restaurant.id), 1);
    const found = await store.tables.findByLabel(restaurant.id, "t1");
    assert.equal(found.id, table.id);
    const listed = await store.tables.list({
      filter: { restaurantId: restaurant.id },
      page: 1,
      limit: 10,
    });
    assert.equal(listed.total, 1);
    const locked = await store.tables.lockForBooking(table.id);
    assert.equal(locked.id, table.id);
    assert.equal("bookingVersion" in locked, false);
    pass("tables enforce case-insensitive unique labels and hide internal fields");

    const first = slot(600);
    const reservation = await store.reservations.create({
      userId: user.id,
      restaurantId: restaurant.id,
      tableId: table.id,
      guestName: user.name,
      guestEmail: user.email,
      guestCount: 2,
      durationMinutes: 60,
      ...first,
    });
    created.reservations.push(reservation.id);
    assert.equal(reservation.status, RESERVATION_STATUS.CONFIRMED);
    assert.equal(reservation.notes, "");

    const conflictsFor = (window, extra = {}) =>
      store.reservations.findConflicts({ tableId: table.id, ...window, ...extra });
    assert.equal((await conflictsFor(slot(630))).length, 1);
    assert.equal((await conflictsFor(slot(660))).length, 0);
    assert.equal((await conflictsFor(slot(540))).length, 0);
    assert.equal((await conflictsFor(slot(630), { excludeId: reservation.id })).length, 0);
    const byRestaurant = await store.reservations.findConflicts({
      restaurantId: restaurant.id,
      ...slot(630),
    });
    assert.equal(byRestaurant.length, 1);
    pass("overlaps conflict, back-to-back does not, and a reservation can exclude itself");

    await store.reservations.update(reservation.id, { status: RESERVATION_STATUS.CANCELLED });
    assert.equal((await conflictsFor(slot(630))).length, 0);
    await store.reservations.update(reservation.id, { status: RESERVATION_STATUS.CONFIRMED });
    pass("cancelled reservations do not block a time slot");

    assert.equal(await store.reservations.existsForTable(table.id), true);
    assert.equal(await store.reservations.existsForUser(user.id), true);
    const beforeEnd = await store.reservations.findUpcomingOrOngoing({
      tableId: table.id,
      now: new Date(Date.UTC(2029, 0, 1)),
    });
    const afterEnd = await store.reservations.findUpcomingOrOngoing({
      tableId: table.id,
      now: new Date(Date.UTC(2031, 0, 1)),
    });
    assert.equal(beforeEnd.length, 1);
    assert.equal(afterEnd.length, 0);
    pass("history and upcoming-reservation lookups work");

    // Restaurant search, facets, and table summaries, in whichever storage mode is running.
    const searchTag = `Zq${suffix}`;
    const cuisineTag = `Cuisine${suffix}`;
    const searchable = await store.restaurants.create({
      name: `${searchTag} Kitchen`,
      city: "Lipa City",
      province: "Batangas",
      cuisine: [cuisineTag],
      category: "Restaurant",
      rating: 4.5,
      priceRange: "$$",
      externalPlaceId: `check:${suffix}`,
      profileScore: 3,
    });
    created.restaurants.push(searchable.id);
    const criteria = (extra) => ({ q: searchTag, page: 1, limit: 10, ...extra });
    assert.equal((await store.restaurants.search(criteria({}))).total, 1);
    assert.equal((await store.restaurants.search(criteria({ q: searchTag.toLowerCase() }))).total, 1);
    assert.equal((await store.restaurants.search(criteria({ city: "lipa" }))).total, 1);
    assert.equal((await store.restaurants.search(criteria({ city: "batangas" }))).total, 0);
    assert.equal((await store.restaurants.search(criteria({ cuisine: cuisineTag.toLowerCase() }))).total, 1);
    assert.equal((await store.restaurants.search(criteria({ priceRanges: ["$$"], minRating: 4 }))).total, 1);
    assert.equal((await store.restaurants.search(criteria({ priceRanges: ["$"] }))).total, 0);
    assert.equal((await store.restaurants.search(criteria({ minRating: 4.8 }))).total, 0);
    assert.equal((await store.restaurants.search(criteria({ q: ".*" }))).total, 0);
    for (const sort of ["featured", "rating", "name", "price", "newest"]) {
      assert.equal((await store.restaurants.search(criteria({ sort }))).items.length, 1, sort);
    }
    assert.equal((await store.restaurants.findByExternalIds([`check:${suffix}`])).length, 1);
    await expectStatus(store.restaurants.create({ name: "Duplicate id", externalPlaceId: `check:${suffix}` }), 409);
    const facets = await store.restaurants.facets();
    assert.ok(facets.cuisines.some((row) => row.name === cuisineTag && row.count === 1));
    await store.tables.create({ restaurantId: searchable.id, label: "S1", capacity: 4 });
    created.tables.push((await store.tables.list({ filter: { restaurantId: searchable.id }, page: 1, limit: 5 })).items[0].id);
    const summary = await store.tables.summaryByRestaurantIds([searchable.id]);
    assert.deepEqual(summary[searchable.id], { count: 1, seats: 4, capacities: [4] });
    assert.ok((await store.tables.restaurantIdsWithActiveTables()).includes(searchable.id));
    pass("restaurant search, facets, provider-id uniqueness, and table summaries work");

    const restaurantsBefore = (await store.restaurants.list({ page: 1, limit: 1 })).total;
    await assert.rejects(
      store.transaction(async (tx) => {
        await tx.restaurants.create({ name: `Rollback ${suffix}`, address: "Nowhere" });
        throw new Error("force rollback");
      }),
      /force rollback/
    );
    const restaurantsAfter = (await store.restaurants.list({ page: 1, limit: 1 })).total;
    assert.equal(restaurantsAfter, restaurantsBefore);
    pass("a failed transaction leaves no partial writes");

    const racing = slot(900);
    const attempts = Array.from({ length: RACING_ATTEMPTS }, () =>
      store.transaction(async (tx) => {
        await tx.tables.lockForBooking(table.id);
        const conflicts = await tx.reservations.findConflicts({
          tableId: table.id,
          ...racing,
        });
        if (conflicts.length > 0) {
          throw new AppError(409, "Table is already booked for that time.");
        }
        return tx.reservations.create({
          userId: user.id,
          restaurantId: restaurant.id,
          tableId: table.id,
          guestName: user.name,
          guestEmail: user.email,
          guestCount: 2,
          durationMinutes: 60,
          ...racing,
        });
      })
    );
    const results = await Promise.allSettled(attempts);
    const winners = results.filter((result) => result.status === "fulfilled");
    for (const winner of winners) {
      created.reservations.push(winner.value.id);
    }
    assert.equal(winners.length, 1);
    for (const result of results.filter((r) => r.status === "rejected")) {
      assert.ok(result.reason instanceof AppError && result.reason.status === 409);
    }
    pass(`${RACING_ATTEMPTS} simultaneous bookings for one table: exactly one succeeds`);
  } finally {
    for (const id of created.reservations) await store.reservations.delete(id);
    for (const id of created.tables) await store.tables.delete(id);
    for (const id of created.restaurants) await store.restaurants.delete(id);
    for (const id of created.users) await store.users.delete(id);
  }
}
