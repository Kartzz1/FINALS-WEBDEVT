import "./setupEnv.js";
import assert from "node:assert/strict";
import { store } from "../src/repositories/index.js";
import { AppError } from "../src/utils/AppError.js";
import { clock } from "../src/utils/clock.js";
import { resetThrottle } from "../src/utils/loginThrottle.js";
import { hashPassword } from "../src/utils/password.js";

export { store, clock };

export const NOW = new Date("2030-06-01T08:00:00Z");
export const PASSWORD = "CorrectHorse9";
export const START = new Date("2030-06-02T18:00:00Z");

export function freezeTime(date = NOW) {
  clock.now = () => new Date(date.getTime());
}

export function resetState() {
  store.reset();
  resetThrottle();
  clock.reset();
  freezeTime();
}

let counter = 0;

export async function makeUser({ role = "user", name, email, password = PASSWORD } = {}) {
  counter += 1;
  return store.users.create({
    name: name ?? `Test User ${counter}`,
    email: email ?? `user${counter}@example.com`,
    role,
    passwordHash: await hashPassword(password),
  });
}

export function makeRestaurant(overrides = {}) {
  return store.restaurants.create({ name: "Test Bistro", address: "1 Main Street", ...overrides });
}

export function makeTable(restaurantId, overrides = {}) {
  counter += 1;
  return store.tables.create({ restaurantId, label: `T${counter}`, capacity: 4, ...overrides });
}

export async function rejectsWith(promise, status) {
  await assert.rejects(
    promise,
    (err) => err instanceof AppError && err.status === status,
    `expected an AppError with status ${status}`
  );
}

// Obviously fake restaurants for tests only. They never reach a real database.
let fixtureCounter = 0;
export function makeFixtureRestaurant(overrides = {}) {
  fixtureCounter += 1;
  return store.restaurants.create({
    name: `Fixture Place ${fixtureCounter}`,
    city: "Lipa City",
    province: "Batangas",
    cuisine: [],
    ...overrides,
  });
}
