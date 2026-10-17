import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import request from "supertest";
import { PASSWORD, START, makeRestaurant, makeTable, makeUser, resetState, store } from "./helpers.js";
import app from "../src/app.js";

const MISSING_ID = "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70";

// A browser-like client: it keeps cookies and sends the CSRF header the way the real frontend will.
async function newClient() {
  const agent = request.agent(app);
  const { body } = await agent.get("/api/auth/csrf").expect(200);
  const withToken = (req) => req.set("X-CSRF-Token", body.csrfToken);
  return {
    agent,
    get: (url) => agent.get(url),
    post: (url, data) => withToken(agent.post(url)).send(data),
    put: (url, data) => withToken(agent.put(url)).send(data),
    patch: (url, data) => withToken(agent.patch(url)).send(data),
    delete: (url) => withToken(agent.delete(url)),
  };
}

async function loggedInClient(user) {
  const client = await newClient();
  await client.post("/api/auth/login", { email: user.email, password: PASSWORD }).expect(200);
  return client;
}

let restaurant;
let table;

beforeEach(async () => {
  resetState();
  restaurant = await makeRestaurant();
  table = await makeTable(restaurant.id, { capacity: 4 });
});

const bookingBody = (overrides = {}) => ({
  restaurantId: restaurant.id,
  tableId: table.id,
  guestCount: 2,
  startAt: START.toISOString(),
  durationMinutes: 60,
  ...overrides,
});

describe("public endpoints", () => {
  it("reports health and booking configuration without authentication", async () => {
    const health = await request(app).get("/api/health").expect(200);
    assert.equal(health.body.storageMode, "memory");
    const config = await request(app).get("/api/config").expect(200);
    assert.equal(config.body.booking.MAX_ADVANCE_DAYS, 60);
  });

  it("returns JSON 404s and 400s for unknown routes and malformed bodies", async () => {
    await request(app).get("/api/nope").expect(404);
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad")
      .expect(400);
    assert.equal(res.body.message, "Malformed JSON body.");
  });
});

describe("CSRF protection", () => {
  it("rejects state-changing requests without a token", async () => {
    await request(app).post("/api/auth/login").send({ email: "a@b.co", password: PASSWORD }).expect(403);
  });

  it("rejects a token that does not match the cookie", async () => {
    const client = await newClient();
    await client.agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", "forged.token")
      .send({ email: "a@b.co", password: PASSWORD })
      .expect(403);
  });

  it("rejects a request that names a foreign origin", async () => {
    const client = await newClient();
    await client.agent
      .post("/api/auth/login")
      .set("Origin", "http://evil.example")
      .set("X-CSRF-Token", "ignored")
      .send({ email: "a@b.co", password: PASSWORD })
      .expect(403);
  });
});

describe("authentication", () => {
  it("registers a regular user and sets an HttpOnly session cookie", async () => {
    const client = await newClient();
    const res = await client
      .post("/api/auth/register", { name: "Ann", email: "ann@example.com", password: PASSWORD })
      .expect(201);
    assert.equal(res.body.user.role, "user");
    assert.equal("passwordHash" in res.body.user, false);
    const cookies = res.headers["set-cookie"].join(";");
    assert.match(cookies, /gather_session=/);
    assert.match(cookies, /HttpOnly/);
    await client.get("/api/auth/me").expect(200);
  });

  it("refuses to let a registration choose its own role", async () => {
    const client = await newClient();
    await client
      .post("/api/auth/register", { name: "Eve", email: "eve@example.com", password: PASSWORD, role: "admin" })
      .expect(400);
  });

  it("logs out, after which the same cookie no longer works", async () => {
    const user = await makeUser();
    const client = await loggedInClient(user);
    await client.get("/api/auth/me").expect(200);
    await client.post("/api/auth/logout", {}).expect(204);
    await client.get("/api/auth/me").expect(401);
  });

  it("gives identical errors for a wrong password and an unknown email", async () => {
    const user = await makeUser();
    const client = await newClient();
    const wrong = await client.post("/api/auth/login", { email: user.email, password: "WrongPassword1" }).expect(401);
    const unknown = await client.post("/api/auth/login", { email: "nobody@example.com", password: PASSWORD }).expect(401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  it("rejects operator objects in the login body", async () => {
    const client = await newClient();
    await client.post("/api/auth/login", { email: { $ne: null }, password: { $ne: null } }).expect(400);
  });

  it("requires a session for protected routes", async () => {
    await request(app).get("/api/reservations").expect(401);
    await request(app).get("/api/users").expect(401);
  });
});

describe("authorization", () => {
  it("keeps regular users out of administrator endpoints", async () => {
    const client = await loggedInClient(await makeUser());
    await client.get("/api/users").expect(403);
    await client.post("/api/restaurants", { name: "X", address: "Y" }).expect(403);
    await client.delete(`/api/tables/${table.id}`).expect(403);
    await client.delete(`/api/reservations/${MISSING_ID}`).expect(403);
  });

  it("lets administrators manage restaurants and users", async () => {
    const client = await loggedInClient(await makeUser({ role: "admin" }));
    const created = await client.post("/api/restaurants", { name: "New Place", city: "Lipa City", address: "2 Side Street" }).expect(201);
    assert.equal(created.body.restaurant.active, true);
    const users = await client.get("/api/users").expect(200);
    assert.ok(users.body.items.every((u) => !("passwordHash" in u)));
  });

  it("hides another user's reservation behind a 404", async () => {
    const alice = await loggedInClient(await makeUser());
    const bob = await loggedInClient(await makeUser());
    const created = await alice.post("/api/reservations", bookingBody()).expect(201);
    const id = created.body.reservation.id;

    await alice.get(`/api/reservations/${id}`).expect(200);
    await bob.get(`/api/reservations/${id}`).expect(404);
    await bob.patch(`/api/reservations/${id}`, { status: "cancelled" }).expect(404);
    const bobsList = await bob.get("/api/reservations").expect(200);
    assert.equal(bobsList.body.total, 0);
  });
});

describe("reservations over HTTP", () => {
  it("rejects a double booking with 409", async () => {
    const alice = await loggedInClient(await makeUser());
    const bob = await loggedInClient(await makeUser());
    await alice.post("/api/reservations", bookingBody()).expect(201);
    await bob.post("/api/reservations", bookingBody()).expect(409);
  });

  it("validates input with 400 and field-level errors", async () => {
    const client = await loggedInClient(await makeUser());
    const res = await client
      .post("/api/reservations", bookingBody({ guestCount: "two", startAt: "tomorrow", extra: true }))
      .expect(400);
    const fields = res.body.errors.map((e) => e.field).sort();
    assert.deepEqual(fields, ["extra", "guestCount", "startAt"]);
  });

  it("rejects malformed ids and operator-style query strings", async () => {
    const client = await loggedInClient(await makeUser());
    await client.get("/api/reservations/not-a-uuid").expect(400);
    await client.get("/api/reservations?status[$ne]=confirmed").expect(400);
  });

  it("searches availability and returns only tables that fit", async () => {
    const client = await loggedInClient(await makeUser());
    const query = new URLSearchParams({
      restaurantId: restaurant.id,
      startAt: START.toISOString(),
      guestCount: "2",
    });
    const res = await client.get(`/api/availability?${query}`).expect(200);
    assert.deepEqual(res.body.tables.map((t) => t.id), [table.id]);
    assert.ok(res.body.tables.every((t) => !("bookingVersion" in t)));
  });
});

describe("restaurant API", () => {
  it("lets anyone browse and search, with a consistent success envelope", async () => {
    const res = await request(app).get("/api/restaurants").expect(200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.items));
    assert.equal(res.body.items[0].id, restaurant.id);
    assert.equal(res.body.items[0].availableTables, 1);
    assert.ok(!("manualFields" in res.body.items[0]), "internal fields stay private");

    await request(app).get("/api/restaurants/search?q=bistro").expect(200);
    await request(app).get("/api/restaurants/facets").expect(200);
  });

  it("finds restaurants by city and cuisine with the dedicated routes", async () => {
    await store.restaurants.update(restaurant.id, { city: "Lipa City", cuisine: ["Japanese"] });
    const byCity = await request(app).get("/api/restaurants/city/Lipa").expect(200);
    assert.equal(byCity.body.total, 1);
    const byCuisine = await request(app).get("/api/restaurants/cuisine/japanese").expect(200);
    assert.equal(byCuisine.body.total, 1);
    const none = await request(app).get("/api/restaurants/city/Atlantis").expect(200);
    assert.equal(none.body.total, 0);
  });

  it("answers errors in the same envelope: invalid id, unknown id, and bad filters", async () => {
    const invalid = await request(app).get("/api/restaurants/not-a-uuid").expect(400);
    assert.equal(invalid.body.success, false);
    const missing = await request(app).get(`/api/restaurants/${MISSING_ID}`).expect(404);
    assert.deepEqual(missing.body, { success: false, message: "Restaurant not found." });
    await request(app).get("/api/restaurants?limit=500").expect(400);
    await request(app).get("/api/restaurants?sort=popularity").expect(400);
    await request(app).get("/api/restaurants?q[$ne]=x").expect(400);
  });

  it("hides inactive restaurants from the public", async () => {
    await store.restaurants.update(restaurant.id, { active: false });
    const list = await request(app).get("/api/restaurants").expect(200);
    assert.equal(list.body.total, 0);
    await request(app).get(`/api/restaurants/${restaurant.id}`).expect(404);
  });

  it("only administrators can create, change, delete, or import restaurants", async () => {
    const guest = await newClient();
    await guest.post("/api/restaurants", { name: "X", city: "Lipa City" }).expect(401);

    const customer = await loggedInClient(await makeUser());
    await customer.post("/api/restaurants", { name: "X", city: "Lipa City" }).expect(403);
    await customer.patch(`/api/restaurants/${restaurant.id}`, { name: "Y" }).expect(403);
    await customer.delete(`/api/restaurants/${restaurant.id}`).expect(403);
    await customer.post("/api/admin/restaurants/sync", {}).expect(403);
    await customer.get("/api/admin/restaurants/sync/status").expect(403);
  });

  it("validates what administrators send, including web addresses and rating limits", async () => {
    const admin = await loggedInClient(await makeUser({ role: "admin" }));
    const bad = await admin
      .post("/api/restaurants", { name: "Fixture", city: "Lipa City", website: "javascript:alert(1)", rating: 9, latitude: 13.9 })
      .expect(400);
    assert.equal(bad.body.success, false);
    const fields = bad.body.errors.map((e) => e.field).sort();
    assert.deepEqual(fields, ["rating", "website"]);
    await admin.post("/api/restaurants", { name: "Fixture", city: "Lipa City", latitude: 13.9 }).expect(400);
    await admin.post("/api/admin/restaurants/sync", { areas: ["atlantis"] }).expect(400);
  });

  it("lets an administrator create and edit a restaurant, and sees import details", async () => {
    const admin = await loggedInClient(await makeUser({ role: "admin" }));
    const created = await admin
      .post("/api/restaurants", { name: "Fixture Place", city: "Batangas City", cuisine: ["Filipino"], latitude: 13.75, longitude: 121.05, priceRange: "$$" })
      .expect(201);
    assert.equal(created.body.restaurant.status, "active");
    assert.equal(created.body.restaurant.externalPlaceId, null);
    const id = created.body.restaurant.id;
    const patched = await admin.patch(`/api/restaurants/${id}`, { phone: "+63 000 000 0000", priceRange: null }).expect(200);
    assert.equal(patched.body.restaurant.priceRange, null);
    assert.deepEqual(patched.body.restaurant.manualFields.sort(), ["phone", "priceRange"]);
    const publicView = await request(app).get(`/api/restaurants/${id}`).expect(200);
    assert.ok(!("manualFields" in publicView.body.restaurant));
  });

  it("reports reservations with friendly field names and the guest's local date and time", async () => {
    const customer = await loggedInClient(await makeUser());
    const made = await customer.post("/api/reservations", bookingBody({ notes: "Window seat" })).expect(201);
    const reservation = made.body.reservation;
    assert.equal(reservation.numberOfGuests, 2);
    assert.equal(reservation.specialRequest, "Window seat");
    assert.equal(reservation.reservationDate, "2030-06-03"); // 18:00 UTC is 02:00 the next day in Manila
    assert.equal(reservation.reservationTime, "02:00");
  });
});
