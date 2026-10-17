import "dotenv/config";
import { OSM_AMENITIES } from "../constants.js";

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIX = "replace-with";
const STORAGE_MODES = ["memory", "mongo"];
const SAME_SITE_VALUES = ["lax", "strict", "none"];
const DEFAULT_PORT = 4000;
const DEFAULT_SESSION_HOURS = 8;
const MAX_SESSION_HOURS = 24 * 7;

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const storageMode = process.env.STORAGE_MODE || "memory";
if (!STORAGE_MODES.includes(storageMode)) {
  throw new Error(`STORAGE_MODE must be one of: ${STORAGE_MODES.join(", ")}`);
}
if (isProduction && storageMode === "memory") {
  throw new Error("STORAGE_MODE=memory loses all data on restart, so it cannot be used in production. Use STORAGE_MODE=mongo");
}

const port = Number(process.env.PORT || DEFAULT_PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < MIN_SECRET_LENGTH || jwtSecret.startsWith(PLACEHOLDER_PREFIX)) {
  throw new Error(
    `JWT_SECRET must be a random string of at least ${MIN_SECRET_LENGTH} characters`
  );
}

const rawClientUrl = required("CLIENT_URL");
let clientUrl;
try {
  clientUrl = new URL(rawClientUrl).origin;
} catch {
  throw new Error("CLIENT_URL must be a valid URL such as http://localhost:5173");
}

const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS || DEFAULT_SESSION_HOURS);
if (!(sessionTtlHours > 0 && sessionTtlHours <= MAX_SESSION_HOURS)) {
  throw new Error(`SESSION_TTL_HOURS must be between 0 and ${MAX_SESSION_HOURS}`);
}

const cookieSameSite = (process.env.COOKIE_SAMESITE || "lax").toLowerCase();
if (!SAME_SITE_VALUES.includes(cookieSameSite)) {
  throw new Error(`COOKIE_SAMESITE must be one of: ${SAME_SITE_VALUES.join(", ")}`);
}
if (cookieSameSite === "none" && !isProduction) {
  throw new Error("COOKIE_SAMESITE=none requires NODE_ENV=production (the cookie must be Secure)");
}

const adminName = process.env.ADMIN_NAME?.trim();
const adminEmail = process.env.ADMIN_EMAIL?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
const adminValuesSet = [adminName, adminEmail, adminPassword].filter(Boolean).length;
if (adminValuesSet !== 0 && adminValuesSet !== 3) {
  throw new Error("ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD must be set together");
}

const DEFAULT_RESTAURANT_API_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_IMPORT_AMENITIES = "restaurant,cafe,bar,pub";

function optionalUrl(name, fallback) {
  const raw = process.env[name]?.trim() || fallback;
  if (!raw) return null;
  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

const importAmenities = (process.env.IMPORT_AMENITIES || DEFAULT_IMPORT_AMENITIES)
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const unknownAmenity = importAmenities.find((value) => !OSM_AMENITIES.includes(value));
if (unknownAmenity || importAmenities.length === 0) {
  throw new Error(`IMPORT_AMENITIES must list values from: ${OSM_AMENITIES.join(", ")}`);
}

const appTimezone = process.env.APP_TIMEZONE?.trim() || "Asia/Manila";
try {
  new Intl.DateTimeFormat("en", { timeZone: appTimezone });
} catch {
  throw new Error("APP_TIMEZONE must be a valid IANA timezone such as Asia/Manila");
}

export const env = Object.freeze({
  appTimezone,
  // External restaurant data source. OpenStreetMap's Overpass API needs no key; the key
  // is read for providers that do, and is only ever used on the server.
  restaurantApi: Object.freeze({
    provider: (process.env.RESTAURANT_API_PROVIDER || "osm").trim().toLowerCase(),
    url: optionalUrl("RESTAURANT_API_URL", DEFAULT_RESTAURANT_API_URL),
    fallbackUrl: optionalUrl("RESTAURANT_API_FALLBACK_URL", null),
    key: process.env.RESTAURANT_API_KEY?.trim() || null,
    userAgent:
      process.env.RESTAURANT_API_USER_AGENT?.trim() ||
      "RestaurantReservationSystem/1.0 (student project; contact: set RESTAURANT_API_USER_AGENT)",
    amenities: Object.freeze(importAmenities),
  }),
  nodeEnv,
  isProduction,
  port,
  storageMode,
  mongodbUri: storageMode === "mongo" ? required("MONGODB_URI") : null,
  jwtSecret,
  clientUrl,
  sessionTtlHours,
  cookieSameSite,
  trustProxy: process.env.TRUST_PROXY === "true",
  adminSeed:
    adminValuesSet === 3
      ? Object.freeze({ name: adminName, email: adminEmail, password: adminPassword })
      : null,
});
