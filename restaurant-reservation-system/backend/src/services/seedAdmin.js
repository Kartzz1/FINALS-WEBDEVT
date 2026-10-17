import { env } from "../config/env.js";
import { ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { hashPassword } from "../utils/password.js";
import { registerSchema } from "../validators/schemas.js";
import { validate } from "../validators/validate.js";

// Creates the first administrator when the ADMIN_* variables are set and no
// admin exists yet. The password is never logged.
export async function seedAdmin() {
  if (!env.adminSeed) {
    return;
  }
  if ((await store.users.countByRole(ROLES.ADMIN)) > 0) {
    return;
  }
  // Same rules as public registration, so a weak seed password fails at startup.
  const { name, email, password } = validate(env.adminSeed, registerSchema);
  await store.users.create({
    name,
    email,
    role: ROLES.ADMIN,
    passwordHash: await hashPassword(password),
  });
  console.log("Initial administrator account created.");
}
