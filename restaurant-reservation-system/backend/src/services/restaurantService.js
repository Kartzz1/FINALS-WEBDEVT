import { ROLES } from "../constants.js";
import { store } from "../repositories/index.js";
import { AppError } from "../utils/AppError.js";
import { buildLocation, computeProfileScore } from "../utils/restaurantProfile.js";

const isAdmin = (actor) => actor?.role === ROLES.ADMIN;
const EMPTY_SUMMARY = Object.freeze({ count: 0, seats: 0, capacities: [] });

async function loadRestaurant(id) {
  const restaurant = await store.restaurants.findById(id);
  if (!restaurant) {
    throw new AppError(404, "Restaurant not found.");
  }
  return restaurant;
}

// Adds how many open tables a restaurant has, worked out from the Table collection
// at read time so it can never go stale.
async function withTableSummaries(restaurants) {
  if (restaurants.length === 0) return restaurants;
  const summary = await store.tables.summaryByRestaurantIds(restaurants.map((r) => r.id));
  return restaurants.map((restaurant) => ({ ...restaurant, tableSummary: summary[restaurant.id] ?? EMPTY_SUMMARY }));
}

function assertCoordinates({ latitude, longitude }) {
  const hasLatitude = typeof latitude === "number";
  const hasLongitude = typeof longitude === "number";
  if (hasLatitude !== hasLongitude) {
    throw new AppError(400, "Latitude and longitude must be provided together.");
  }
}

// Regular visitors only ever see active restaurants. Administrators see everything
// and may filter by status.
export async function searchRestaurants(actor, query = {}) {
  const admin = isAdmin(actor);
  const criteria = {
    q: query.q,
    city: query.city,
    province: query.province,
    cuisine: query.cuisine,
    category: query.category,
    priceRanges: query.priceRange ? [query.priceRange] : undefined,
    minRating: query.minRating,
    sort: query.sort,
    order: query.order,
    page: query.page ?? 1,
    limit: query.limit ?? 12,
    active: admin ? (query.status ? query.status === "active" : undefined) : true,
  };
  if (query.hasTables) {
    criteria.ids = await store.tables.restaurantIdsWithActiveTables();
  }
  const result = await store.restaurants.search(criteria);
  return { items: await withTableSummaries(result.items), total: result.total };
}

// Kept under its earlier name so existing callers keep working.
export const listRestaurants = searchRestaurants;

export async function getRestaurant(actor, id) {
  const restaurant = await loadRestaurant(id);
  if (!restaurant.active && !isAdmin(actor)) {
    throw new AppError(404, "Restaurant not found.");
  }
  const [withSummary] = await withTableSummaries([restaurant]);
  return withSummary;
}

export function listFacets() {
  return store.restaurants.facets();
}

function withDerivedFields(record) {
  const location = buildLocation(record.latitude, record.longitude);
  return { ...record, ...(location ? { location } : {}), profileScore: computeProfileScore(record) };
}

export async function createRestaurant(data) {
  assertCoordinates(data);
  return store.restaurants.create(withDerivedFields({ province: "Batangas", ...data }));
}

// Anything an administrator changes is remembered in manualFields, so a later
// import from the external source does not overwrite it.
export async function updateRestaurant(id, changes) {
  const existing = await loadRestaurant(id);
  const merged = { ...existing, ...changes };
  assertCoordinates(merged);

  const patch = { ...changes, profileScore: computeProfileScore(merged) };
  if ("latitude" in changes || "longitude" in changes) {
    patch.location = buildLocation(merged.latitude, merged.longitude);
  }
  patch.manualFields = [...new Set([...(existing.manualFields ?? []), ...Object.keys(changes)])];
  return store.restaurants.update(id, patch);
}

export async function deleteRestaurant(id) {
  await loadRestaurant(id);
  if ((await store.tables.countByRestaurant(id)) > 0) {
    throw new AppError(409, "Restaurants that still have tables cannot be deleted.");
  }
  await store.restaurants.delete(id);
}
