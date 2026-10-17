import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { buildLocation, computeProfileScore, distanceMeters, isEmptyValue } from "../utils/restaurantProfile.js";
import { listAreas, resolveAreas } from "./importAreas.js";
import { createProvider } from "./providers/index.js";

// Copies restaurants from an external source into MongoDB.
//   match    by the provider's stable id (externalPlaceId), never by name alone
//   update   only with non-empty values, and never over fields an administrator edited
//   insert   anything new, after a near-duplicate check
//   report   created / updated / unchanged / duplicates / failures

const MAX_FAILURES_KEPT = 200;
const NEAR_DUPLICATE_METERS = 75;
const EXISTING_LOOKUP_LIMIT = 5000;
const SYNCED_FIELDS = [
  "name", "description", "cuisine", "category", "address", "barangay", "city", "province",
  "latitude", "longitude", "phone", "email", "website", "image", "imageCredit",
  "openingHours", "priceRange", "rating", "reviewCount", "amenities",
];

let activeRun = null;
let lastRun = null;

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const emptyTotals = () => ({ fetched: 0, created: 0, updated: 0, unchanged: 0, duplicates: 0, skipped: 0, failed: 0 });
const snapshot = (run) => JSON.parse(JSON.stringify(run));

// What to change on an existing restaurant. Returns {} when nothing real changed.
export function buildMergePatch(existing, candidate) {
  const manual = new Set(existing.manualFields ?? []);
  const patch = {};
  for (const field of SYNCED_FIELDS) {
    const incoming = candidate[field];
    if (manual.has(field) || isEmptyValue(incoming)) continue;
    if (!sameValue(existing[field], incoming)) patch[field] = incoming;
  }
  if (Object.keys(patch).length === 0) return patch;

  const merged = { ...existing, ...patch };
  patch.profileScore = computeProfileScore(merged);
  patch.source = candidate.source;
  if ("latitude" in patch || "longitude" in patch) {
    patch.location = buildLocation(merged.latitude, merged.longitude);
  }
  return patch;
}

function buildNameIndex(restaurants) {
  const index = new Map();
  for (const restaurant of restaurants) addToIndex(index, restaurant);
  return index;
}

function addToIndex(index, restaurant) {
  const key = restaurant.name.trim().toLowerCase();
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(restaurant);
}

// Same name and within 75 m of a known place: almost certainly the same restaurant mapped twice.
function isNearDuplicate(index, candidate) {
  if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number") return false;
  return (index.get(candidate.name.trim().toLowerCase()) ?? []).some(
    (other) =>
      typeof other.latitude === "number" &&
      typeof other.longitude === "number" &&
      distanceMeters(candidate, other) < NEAR_DUPLICATE_METERS
  );
}

function recordFailure(run, area, candidate, error, logger) {
  logger.warn(`[sync] ${area.key}: could not save "${candidate.name}" (${candidate.externalPlaceId}): ${error.message}`);
  if (run.failures.length < MAX_FAILURES_KEPT) {
    run.failures.push({ area: area.key, externalPlaceId: candidate.externalPlaceId, name: candidate.name, reason: error.message });
  }
}

async function syncArea(area, provider, run, { dryRun, logger }) {
  const report = { key: area.key, city: area.city, status: "running", ...emptyTotals(), partial: false, error: null };
  try {
    const { candidates, skipped, partial } = await provider.fetchArea(area);
    report.fetched = candidates.length;
    report.skipped = skipped;
    report.partial = partial;

    const matches = await store.restaurants.findByExternalIds(candidates.map((c) => c.externalPlaceId));
    const byExternalId = new Map(matches.map((restaurant) => [restaurant.externalPlaceId, restaurant]));
    const inCity = await store.restaurants.search({ city: area.city, limit: EXISTING_LOOKUP_LIMIT, sort: "name" });
    const index = buildNameIndex(inCity.items);

    for (const candidate of candidates) {
      try {
        const existing = byExternalId.get(candidate.externalPlaceId);
        if (existing) {
          const patch = buildMergePatch(existing, candidate);
          if (Object.keys(patch).length === 0) {
            report.unchanged += 1;
          } else {
            if (!dryRun) await store.restaurants.update(existing.id, patch);
            report.updated += 1;
          }
        } else if (isNearDuplicate(index, candidate)) {
          report.duplicates += 1;
        } else {
          const record = { ...candidate, active: true, profileScore: computeProfileScore(candidate) };
          const location = buildLocation(candidate.latitude, candidate.longitude);
          if (location) record.location = location;
          if (!dryRun) await store.restaurants.create(record);
          addToIndex(index, candidate);
          report.created += 1;
        }
      } catch (error) {
        report.failed += 1;
        recordFailure(run, area, candidate, error, logger);
      }
    }
    report.status = report.failed > 0 ? "completed_with_errors" : "completed";
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    logger.error(`[sync] ${area.key}: ${error.message}`);
  }
  return report;
}

// Runs a sync and resolves when it is finished (used by the seed command and tests).
export async function runRestaurantSync({ areaKeys, dryRun = false } = {}, { provider, logger = console } = {}) {
  if (activeRun) throw new AppError(409, "A restaurant sync is already running. Wait for it to finish.");
  const areas = resolveAreas(areaKeys);
  const source = provider ?? createProvider(env.restaurantApi);

  const run = {
    id: randomUUID(),
    status: "running",
    provider: source.name ?? env.restaurantApi.provider,
    dryRun,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    areas: [],
    totals: emptyTotals(),
    failures: [],
    error: null,
  };
  activeRun = run;

  try {
    for (const area of areas) {
      const report = await syncArea(area, source, run, { dryRun, logger });
      run.areas.push(report);
      for (const key of Object.keys(run.totals)) run.totals[key] += report[key];
    }
    // "failed" means nothing could be loaded at all. Some failed records or areas is a partial success.
    const couldNotLoad = run.areas.filter((area) => area.status === "failed").length;
    const clean = run.areas.every((area) => area.status === "completed");
    run.status = clean ? "completed" : couldNotLoad === run.areas.length ? "failed" : "completed_with_errors";
  } catch (error) {
    run.status = "failed";
    run.error = error.message;
    logger.error(`[sync] ${error.message}`);
  } finally {
    run.finishedAt = new Date().toISOString();
    lastRun = run;
    activeRun = null;
  }
  return snapshot(run);
}

// Starts a sync in the background and returns straight away; poll getSyncStatus() for progress.
export function startRestaurantSync(options, deps) {
  if (activeRun) throw new AppError(409, "A restaurant sync is already running. Wait for it to finish.");
  resolveAreas(options.areaKeys);
  const finished = runRestaurantSync(options, deps);
  finished.catch((error) => (deps?.logger ?? console).error(`[sync] ${error.message}`));
  return snapshot(activeRun);
}

export const getSyncStatus = () => (activeRun ?? lastRun ? snapshot(activeRun ?? lastRun) : null);
export const getSyncAreas = () => listAreas();
export const resetSyncState = () => {
  activeRun = null;
  lastRun = null;
};
