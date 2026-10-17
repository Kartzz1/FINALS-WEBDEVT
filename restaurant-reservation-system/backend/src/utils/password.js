import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const FORMAT = "scrypt";

// Stored as "scrypt$<salt>$<key>", both base64, so each hash carries its own salt.
export async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(password, salt, KEY_BYTES);
  return [FORMAT, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [format, saltText, keyText] = String(stored).split("$");
  if (format !== FORMAT || !saltText || !keyText) {
    return false;
  }
  const expected = Buffer.from(keyText, "base64");
  if (expected.length === 0) {
    return false;
  }
  const actual = await scryptAsync(password, Buffer.from(saltText, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}
