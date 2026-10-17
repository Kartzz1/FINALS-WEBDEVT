import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { clock } from "../utils/clock.js";
import { clearFailures, recordFailure, retryAfterSeconds } from "../utils/loginThrottle.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

const HOUR_MS = 60 * 60 * 1000;
const INVALID_CREDENTIALS = "Invalid email or password.";

// Compared against when the email is unknown, so a missing account takes as
// long to reject as a wrong password and timing does not reveal which emails exist.
const DUMMY_HASH = await hashPassword(randomUUID());

function assertNotThrottled(key) {
  const waitSeconds = retryAfterSeconds(key);
  if (waitSeconds > 0) {
    const minutes = Math.ceil(waitSeconds / 60);
    throw new AppError(429, `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

function startSession(userId) {
  const expiresAt = new Date(clock.now().getTime() + env.sessionTtlHours * HOUR_MS);
  return store.sessions.create({ userId, expiresAt });
}

export async function register({ name, email, password }) {
  if (await store.users.findByEmail(email)) {
    throw new AppError(409, "An account with that email already exists.");
  }
  // The role is always set here, never taken from the request.
  const user = await store.users.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.USER,
  });
  const session = await startSession(user.id);
  return { user, session };
}

export async function login({ email, password }) {
  // Counted per email address, known or not, so the lockout reveals nothing about which accounts exist.
  assertNotThrottled(email);
  const account = await store.users.findByEmail(email, { withPassword: true });
  const passwordMatches = await verifyPassword(
    password,
    account ? account.passwordHash : DUMMY_HASH
  );
  if (!account || !passwordMatches) {
    recordFailure(email);
    throw new AppError(401, INVALID_CREDENTIALS);
  }
  clearFailures(email);
  const { passwordHash, ...user } = account;
  const session = await startSession(user.id);
  return { user, session };
}

// Returns the user when the session exists, belongs to them, and has not
// expired. The database TTL index cleans up late, so expiry is checked here too.
export async function authenticate({ userId, sessionId }) {
  const session = await store.sessions.findById(sessionId);
  if (!session || session.userId !== userId) {
    return null;
  }
  if (session.expiresAt <= clock.now()) {
    await store.sessions.delete(session.id);
    return null;
  }
  return store.users.findById(userId);
}

export async function logout(sessionId) {
  await store.sessions.delete(sessionId);
}

export async function updateProfile(actor, sessionId, changes) {
  const { currentPassword, password, ...profile } = changes;
  const touchesCredentials = profile.email !== undefined || password !== undefined;

  if (touchesCredentials) {
    if (!currentPassword) {
      throw new AppError(400, "Current password is required to change email or password.");
    }
    const throttleKey = `profile:${actor.id}`;
    assertNotThrottled(throttleKey);
    const account = await store.users.findById(actor.id, { withPassword: true });
    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      recordFailure(throttleKey);
      throw new AppError(403, "Current password is incorrect.");
    }
    clearFailures(throttleKey);
  }

  if (profile.email !== undefined) {
    const owner = await store.users.findByEmail(profile.email);
    if (owner && owner.id !== actor.id) {
      throw new AppError(409, "That email is already in use.");
    }
  }

  const data = { ...profile };
  if (password !== undefined) {
    data.passwordHash = await hashPassword(password);
  }
  if (Object.keys(data).length === 0) {
    throw new AppError(400, "No changes were provided.");
  }

  const updated = await store.users.update(actor.id, data);
  if (touchesCredentials) {
    await store.sessions.deleteByUserId(actor.id, { exceptId: sessionId });
  }
  return updated;
}
