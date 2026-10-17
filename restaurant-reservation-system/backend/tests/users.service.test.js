import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { PASSWORD, START, makeRestaurant, makeTable, makeUser, rejectsWith, resetState, store } from "./helpers.js";
import * as authService from "../src/services/authService.js";
import * as reservationService from "../src/services/reservationService.js";
import * as userService from "../src/services/userService.js";

let admin;

beforeEach(async () => {
  resetState();
  admin = await makeUser({ role: "admin" });
});

describe("user management", () => {
  it("creates users and administrators with hashed passwords", async () => {
    const created = await userService.createUser({
      name: "New Admin",
      email: "new.admin@example.com",
      password: PASSWORD,
      role: "admin",
    });
    assert.equal(created.role, "admin");
    const login = await authService.login({ email: "new.admin@example.com", password: PASSWORD });
    assert.equal(login.user.id, created.id);
  });

  it("rejects a duplicate email", async () => {
    const existing = await makeUser();
    await rejectsWith(
      userService.createUser({ name: "Dup", email: existing.email, password: PASSWORD, role: "user" }),
      409
    );
  });

  it("lists users with pagination", async () => {
    await makeUser();
    await makeUser();
    const page = await userService.listUsers({ page: 1, limit: 2 });
    assert.equal(page.items.length, 2);
    assert.equal(page.total, 3);
  });

  it("returns 404 for an unknown user", async () => {
    await rejectsWith(userService.getUser("6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70"), 404);
  });

  it("promotes another user to administrator", async () => {
    const user = await makeUser();
    const updated = await userService.updateUser(admin, user.id, { role: "admin" });
    assert.equal(updated.role, "admin");
  });

  it("stops administrators from changing their own role", async () => {
    await makeUser({ role: "admin" });
    await rejectsWith(userService.updateUser(admin, admin.id, { role: "user" }), 403);
  });

  it("protects the last administrator from demotion and deletion", async () => {
    const otherAdmin = await makeUser({ role: "admin" });
    await userService.deleteUser(admin, otherAdmin.id);
    // Only `admin` remains. A second admin demoting them is impossible, so
    // check deletion through a regular actor object acting on the last admin.
    const stranger = { id: "someone-else", role: "admin" };
    await rejectsWith(userService.deleteUser(stranger, admin.id), 409);
    await rejectsWith(userService.updateUser(stranger, admin.id, { role: "user" }), 409);
  });

  it("blocks deleting your own account", async () => {
    await rejectsWith(userService.deleteUser(admin, admin.id), 403);
  });

  it("blocks deleting a user who has reservations", async () => {
    const user = await makeUser();
    const restaurant = await makeRestaurant();
    const table = await makeTable(restaurant.id);
    await reservationService.createReservation(user, {
      restaurantId: restaurant.id,
      tableId: table.id,
      guestCount: 2,
      startAt: START,
      durationMinutes: 60,
    });
    await rejectsWith(userService.deleteUser(admin, user.id), 409);
  });

  it("deletes a user together with their sessions", async () => {
    const { user, session } = await authService.register({
      name: "Temp",
      email: "temp@example.com",
      password: PASSWORD,
    });
    await userService.deleteUser(admin, user.id);
    assert.equal(await store.users.findById(user.id), null);
    assert.equal(await store.sessions.findById(session.id), null);
  });

  it("signs a user out everywhere when an admin resets their password", async () => {
    const { user, session } = await authService.register({
      name: "Temp",
      email: "temp@example.com",
      password: PASSWORD,
    });
    await userService.updateUser(admin, user.id, { password: "ResetByAdmin9" });
    assert.equal(await store.sessions.findById(session.id), null);
    const login = await authService.login({ email: user.email, password: "ResetByAdmin9" });
    assert.equal(login.user.id, user.id);
  });
});
