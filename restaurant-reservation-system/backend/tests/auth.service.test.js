import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { PASSWORD, clock, makeUser, rejectsWith, resetState, store, NOW } from "./helpers.js";
import * as authService from "../src/services/authService.js";
import { seedAdmin } from "../src/services/seedAdmin.js";
import { verifyPassword } from "../src/utils/password.js";

const HOUR_MS = 60 * 60 * 1000;
const registration = { name: "Ann", email: "ann@example.com", password: PASSWORD };

beforeEach(resetState);

describe("register", () => {
  it("creates a regular user with a session and no password hash", async () => {
    const { user, session } = await authService.register(registration);
    assert.equal(user.role, "user");
    assert.equal("passwordHash" in user, false);
    assert.equal(session.userId, user.id);
    assert.equal(session.expiresAt.getTime(), NOW.getTime() + HOUR_MS);
  });

  it("stores a hash, never the password", async () => {
    const { user } = await authService.register(registration);
    const stored = await store.users.findById(user.id, { withPassword: true });
    assert.ok(!stored.passwordHash.includes(PASSWORD));
    assert.equal(await verifyPassword(PASSWORD, stored.passwordHash), true);
  });

  it("ignores a role passed in, always creating a regular user", async () => {
    const { user } = await authService.register({ ...registration, role: "admin" });
    assert.equal(user.role, "user");
  });

  it("rejects a duplicate email regardless of case", async () => {
    await authService.register(registration);
    await rejectsWith(authService.register({ ...registration, email: "ANN@example.com" }), 409);
  });
});

describe("login", () => {
  it("returns the user and a new session for correct credentials", async () => {
    await makeUser({ email: "bob@example.com" });
    const { user, session } = await authService.login({ email: "bob@example.com", password: PASSWORD });
    assert.equal(user.email, "bob@example.com");
    assert.equal("passwordHash" in user, false);
    assert.equal(session.userId, user.id);
  });

  it("gives the same 401 message for a wrong password and an unknown email", async () => {
    await makeUser({ email: "bob@example.com" });
    const messages = [];
    for (const attempt of [
      { email: "bob@example.com", password: "WrongPassword1" },
      { email: "nobody@example.com", password: PASSWORD },
    ]) {
      await assert.rejects(authService.login(attempt), (err) => {
        messages.push(err.message);
        return err.status === 401;
      });
    }
    assert.equal(messages[0], messages[1]);
  });
});

describe("authenticate", () => {
  it("returns the user for a live session", async () => {
    const { user, session } = await authService.register(registration);
    const found = await authService.authenticate({ userId: user.id, sessionId: session.id });
    assert.equal(found.id, user.id);
  });

  it("returns null for an unknown session or one belonging to someone else", async () => {
    const { session } = await authService.register(registration);
    const other = await makeUser();
    assert.equal(await authService.authenticate({ userId: other.id, sessionId: session.id }), null);
    assert.equal(await authService.authenticate({ userId: other.id, sessionId: "missing" }), null);
  });

  it("rejects and removes an expired session", async () => {
    const { user, session } = await authService.register(registration);
    clock.now = () => new Date(NOW.getTime() + 2 * HOUR_MS);
    assert.equal(await authService.authenticate({ userId: user.id, sessionId: session.id }), null);
    assert.equal(await store.sessions.findById(session.id), null);
  });

  it("stops working immediately after logout", async () => {
    const { user, session } = await authService.register(registration);
    await authService.logout(session.id);
    assert.equal(await authService.authenticate({ userId: user.id, sessionId: session.id }), null);
  });
});

describe("updateProfile", () => {
  it("changes the name without asking for the password", async () => {
    const { user, session } = await authService.register(registration);
    const updated = await authService.updateProfile(user, session.id, { name: "Ann Lee" });
    assert.equal(updated.name, "Ann Lee");
  });

  it("requires the current password to change the email", async () => {
    const { user, session } = await authService.register(registration);
    await rejectsWith(authService.updateProfile(user, session.id, { email: "new@example.com" }), 400);
    await rejectsWith(
      authService.updateProfile(user, session.id, { email: "new@example.com", currentPassword: "WrongPassword1" }),
      403
    );
  });

  it("keeps the current session but revokes the others after a sensitive change", async () => {
    const { user, session } = await authService.register(registration);
    const { session: otherDevice } = await authService.login({ email: user.email, password: PASSWORD });
    await authService.updateProfile(user, session.id, {
      email: "new@example.com",
      currentPassword: PASSWORD,
    });
    assert.ok(await store.sessions.findById(session.id));
    assert.equal(await store.sessions.findById(otherDevice.id), null);
  });

  it("applies a new password so only the new one logs in", async () => {
    const { user, session } = await authService.register(registration);
    await authService.updateProfile(user, session.id, {
      password: "BrandNewPass1",
      currentPassword: PASSWORD,
    });
    await rejectsWith(authService.login({ email: user.email, password: PASSWORD }), 401);
    const login = await authService.login({ email: user.email, password: "BrandNewPass1" });
    assert.equal(login.user.id, user.id);
  });

  it("rejects an email that belongs to another account", async () => {
    const taken = await makeUser({ email: "taken@example.com" });
    const { user, session } = await authService.register(registration);
    await rejectsWith(
      authService.updateProfile(user, session.id, { email: taken.email, currentPassword: PASSWORD }),
      409
    );
  });

  it("rejects a request that changes nothing", async () => {
    const { user, session } = await authService.register(registration);
    await rejectsWith(authService.updateProfile(user, session.id, { currentPassword: PASSWORD }), 400);
  });
});

describe("seedAdmin", () => {
  it("creates the first administrator once", async () => {
    await seedAdmin();
    await seedAdmin();
    const admin = await store.users.findByEmail("seed.admin@example.com", { withPassword: true });
    assert.equal(admin.role, "admin");
    assert.equal(await store.users.countByRole("admin"), 1);
    assert.equal(await verifyPassword("SeedPassw0rd!", admin.passwordHash), true);
  });

  it("does nothing when an administrator already exists", async () => {
    await makeUser({ role: "admin" });
    await seedAdmin();
    assert.equal(await store.users.countByRole("admin"), 1);
    assert.equal(await store.users.findByEmail("seed.admin@example.com"), null);
  });
});

describe("login throttling", () => {
  const fail = (email) => authService.login({ email, password: "WrongPassword1" });

  it("locks an account after repeated failures, even for the right password", async () => {
    const user = await makeUser({ email: "lock@example.com" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await rejectsWith(fail(user.email), 401);
    }
    await rejectsWith(fail(user.email), 429);
    await rejectsWith(authService.login({ email: user.email, password: PASSWORD }), 429);
  });

  it("treats unknown emails the same way, so the lockout reveals nothing", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await rejectsWith(fail("ghost@example.com"), 401);
    }
    await rejectsWith(fail("ghost@example.com"), 429);
  });

  it("starts counting again after a successful login", async () => {
    const user = await makeUser({ email: "reset@example.com" });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await rejectsWith(fail(user.email), 401);
    }
    await authService.login({ email: user.email, password: PASSWORD });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await rejectsWith(fail(user.email), 401);
    }
  });

  it("unlocks once the time window has passed", async () => {
    const user = await makeUser({ email: "later@example.com" });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await rejectsWith(fail(user.email), 401);
    }
    await rejectsWith(fail(user.email), 429);
    clock.now = () => new Date(NOW.getTime() + 16 * 60 * 1000);
    const login = await authService.login({ email: user.email, password: PASSWORD });
    assert.equal(login.user.email, user.email);
  });

  it("also limits guesses of the current password on the profile page", async () => {
    const { user, session } = await authService.register(registration);
    const attempt = () =>
      authService.updateProfile(user, session.id, { email: "other@example.com", currentPassword: "WrongPassword1" });
    for (let count = 0; count < 5; count += 1) {
      await rejectsWith(attempt(), 403);
    }
    await rejectsWith(attempt(), 429);
  });
});
