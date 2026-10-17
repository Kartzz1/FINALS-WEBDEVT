// Creates backend/.env with a fresh random secret and a ready-to-use admin account.
// Safe to run again: it never overwrites an existing .env.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, "backend", ".env");
const examplePath = join(root, "backend", ".env.example");

if (existsSync(envPath)) {
  console.log("backend/.env already exists, so it was left unchanged.");
  process.exit(0);
}

const adminEmail = "admin@restaurant.test";
const adminPassword = `Admin-${randomBytes(4).toString("hex")}-2026`;
let text = readFileSync(examplePath, "utf8");

function setValue(key, value) {
  text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
}
setValue("JWT_SECRET", randomBytes(48).toString("hex"));
setValue("ADMIN_NAME", "Administrator");
setValue("ADMIN_EMAIL", adminEmail);
setValue("ADMIN_PASSWORD", adminPassword);
writeFileSync(envPath, text);

console.log("\nCreated backend/.env");
console.log("\n  ADMIN LOGIN (write this down)");
console.log(`  Email:    ${adminEmail}`);
console.log(`  Password: ${adminPassword}`);
console.log("\nThis account is created the first time the backend starts.");
