import { ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/password.js";

async function loadUser(id) {
  const user = await store.users.findById(id);
  if (!user) {
    throw new AppError(404, "User not found.");
  }
  return user;
}

async function assertEmailFree(email, ownId) {
  const owner = await store.users.findByEmail(email);
  if (owner && owner.id !== ownId) {
    throw new AppError(409, "That email is already in use.");
  }
}

async function isLastAdmin(user) {
  return user.role === ROLES.ADMIN && (await store.users.countByRole(ROLES.ADMIN)) <= 1;
}

export function listUsers({ page, limit }) {
  return store.users.list({ page, limit });
}

export async function createUser({ name, email, password, role }) {
  await assertEmailFree(email);
  return store.users.create({ name, email, role, passwordHash: await hashPassword(password) });
}

export function getUser(id) {
  return loadUser(id);
}

export async function updateUser(actor, id, changes) {
  const target = await loadUser(id);
  const { password, ...fields } = changes;

  if (fields.role !== undefined && fields.role !== target.role) {
    if (target.id === actor.id) {
      throw new AppError(403, "You cannot change your own role.");
    }
    if (await isLastAdmin(target)) {
      throw new AppError(409, "The last administrator cannot be demoted.");
    }
  }
  if (fields.email !== undefined) {
    await assertEmailFree(fields.email, target.id);
  }

  const data = { ...fields };
  if (password !== undefined) {
    data.passwordHash = await hashPassword(password);
  }
  const updated = await store.users.update(id, data);

  // A new password signs that user out everywhere. Admins changing their own
  // password here keep their session; the profile page is the normal route for that.
  if (password !== undefined && target.id !== actor.id) {
    await store.sessions.deleteByUserId(target.id);
  }
  return updated;
}

export async function deleteUser(actor, id) {
  const target = await loadUser(id);
  if (target.id === actor.id) {
    throw new AppError(403, "You cannot delete your own account.");
  }
  if (await isLastAdmin(target)) {
    throw new AppError(409, "The last administrator cannot be deleted.");
  }
  if (await store.reservations.existsForUser(target.id)) {
    throw new AppError(409, "Users who have reservations cannot be deleted.");
  }
  await store.sessions.deleteByUserId(target.id);
  await store.users.delete(target.id);
}
