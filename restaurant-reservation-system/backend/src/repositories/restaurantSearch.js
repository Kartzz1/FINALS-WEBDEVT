import { PRICE_RANGES } from "../constants.js";

// Search rules shared by both storage modes, so memory and MongoDB behave the same.

const DEFAULT_DIRECTION = { rating: "desc", name: "asc", price: "asc" };
const TEXT_FIELDS = ["name", "city", "barangay", "address", "province", "category"];

export const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeCriteria(input = {}) {
  const sort = input.sort ?? "featured";
  const order = input.order ?? DEFAULT_DIRECTION[sort] ?? "asc";
  return {
    q: input.q?.trim() || null,
    city: input.city?.trim() || null,
    province: input.province?.trim() || null,
    cuisine: input.cuisine?.trim() || null,
    category: input.category?.trim() || null,
    priceRanges: input.priceRanges?.length ? input.priceRanges : null,
    minRating: input.minRating ?? null,
    ids: input.ids ?? null,
    active: input.active,
    sort,
    direction: order === "desc" ? -1 : 1,
    page: input.page ?? 1,
    limit: input.limit ?? 12,
  };
}

// Restaurants with no rating or price yet always sort last, in either direction.
export const unknownLast = (direction) => (direction === 1 ? 99 : -1);

export const priceLevel = (priceRange) => (PRICE_RANGES.includes(priceRange) ? priceRange.length : null);

const lower = (value) => String(value).toLowerCase();
const byText = (a, b) => String(a).localeCompare(String(b), "en", { sensitivity: "base" });

export function matchesCriteria(restaurant, c) {
  if (c.active !== undefined && restaurant.active !== c.active) return false;
  if (c.ids && !c.ids.includes(restaurant.id)) return false;
  if (c.city && !(restaurant.city && lower(restaurant.city).startsWith(lower(c.city)))) return false;
  if (c.province && !(restaurant.province && lower(restaurant.province) === lower(c.province))) return false;
  if (c.category && !(restaurant.category && lower(restaurant.category) === lower(c.category))) return false;
  if (c.cuisine && !(restaurant.cuisine ?? []).some((item) => lower(item) === lower(c.cuisine))) return false;
  if (c.priceRanges && !c.priceRanges.includes(restaurant.priceRange)) return false;
  if (c.minRating !== null && !(typeof restaurant.rating === "number" && restaurant.rating >= c.minRating)) {
    return false;
  }
  if (c.q) {
    const needle = lower(c.q);
    const haystack = [...TEXT_FIELDS.map((field) => restaurant[field]), ...(restaurant.cuisine ?? [])];
    if (!haystack.some((value) => value && lower(value).includes(needle))) return false;
  }
  return true;
}

export function compareRestaurants(a, b, c) {
  const d = c.direction;
  const rating = (r, nulls) => (typeof r.rating === "number" ? r.rating : nulls);
  let result = 0;

  if (c.sort === "name") {
    result = byText(a.name, b.name) * d;
  } else if (c.sort === "newest") {
    result = new Date(b.createdAt) - new Date(a.createdAt);
  } else if (c.sort === "rating") {
    result = (rating(a, unknownLast(d)) - rating(b, unknownLast(d))) * d;
    result ||= (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
  } else if (c.sort === "price") {
    const level = (r) => priceLevel(r.priceRange) ?? unknownLast(d);
    result = (level(a) - level(b)) * d;
  } else {
    // featured: best rating first, then the most complete listings
    result = rating(b, -1) - rating(a, -1);
    result ||= (b.profileScore ?? 0) - (a.profileScore ?? 0);
  }
  return result || byText(a.name, b.name) || String(a.id).localeCompare(String(b.id));
}

export const SEARCH_TEXT_FIELDS = TEXT_FIELDS;
