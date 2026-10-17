import { randomBytes } from "node:crypto";

// Imported first by every test file. Tests always use memory storage and a
// throwaway secret, whatever the developer's own .env contains.
process.env.NODE_ENV = "test";
process.env.STORAGE_MODE = "memory";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
process.env.CLIENT_URL = "http://localhost:5173";
process.env.SESSION_TTL_HOURS = "1";
process.env.COOKIE_SAMESITE = "lax";
process.env.ADMIN_NAME = "Seed Admin";
process.env.ADMIN_EMAIL = "seed.admin@example.com";
process.env.ADMIN_PASSWORD = "SeedPassw0rd!";
