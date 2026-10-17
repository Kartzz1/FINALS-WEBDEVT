export const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

export const RESERVATION_STATUS = Object.freeze({
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
});

// OpenStreetMap "amenity" values the importer is allowed to request. This allowlist also
// keeps user-supplied values out of the Overpass query text.
export const OSM_AMENITIES = Object.freeze(["restaurant", "cafe", "fast_food", "bar", "pub", "food_court", "ice_cream", "biergarten"]);

export const PRICE_RANGES = Object.freeze(["$", "$$", "$$$", "$$$$"]);
export const RESTAURANT_SORTS = Object.freeze(["featured", "rating", "name", "price", "newest"]);

export const LIMITS = Object.freeze({
  DESCRIPTION_MAX: 2000,
  CITY_MAX: 100,
  URL_MAX: 2048,
  PHONE_MAX: 50,
  HOURS_MAX: 500,
  LIST_ITEM_MAX: 60,
  SEARCH_MAX: 100,
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  RESTAURANT_NAME_MAX: 120,
  ADDRESS_MAX: 255,
  TABLE_LABEL_MAX: 50,
  TABLE_CAPACITY_MAX: 50,
  NOTES_MAX: 500,
});

// Strength 2 compares letters case-insensitively, so "T1" and "t1" clash.
export const LABEL_COLLATION = Object.freeze({ locale: "en", strength: 2 });
