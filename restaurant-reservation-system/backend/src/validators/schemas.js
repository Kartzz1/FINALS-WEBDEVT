import { LIMITS, PRICE_RANGES, RESERVATION_STATUS, RESTAURANT_SORTS, ROLES } from "../constants.js";
import { BOOKING } from "../config/booking.js";
import { MAX_PAGE_SIZE } from "../utils/pagination.js";

const MAX_PAGE_NUMBER = 100000;
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

const required = (rule) => ({ ...rule, required: true });
const text = (maxLength, extra = {}) => ({ type: "string", maxLength, ...extra });
const whole = (min, max) => ({ type: "integer", min, max });

const id = { type: "uuid" };
const email = { type: "email" };
const timestamp = { type: "timestamp" };
const flag = { type: "boolean" };
const role = { type: "enum", values: Object.values(ROLES) };
// Passwords keep every character exactly as typed (no trimming, no control-character filter).
const newPassword = {
  type: "string",
  trim: false,
  allowControl: true,
  strong: true,
  minLength: MIN_PASSWORD_LENGTH,
  maxLength: MAX_PASSWORD_LENGTH,
};
const anyPassword = { type: "string", trim: false, allowControl: true, maxLength: MAX_PASSWORD_LENGTH };
const notes = text(LIMITS.NOTES_MAX, { allowEmpty: true, multiline: true });
const personName = text(LIMITS.NAME_MAX, {
  minLength: 2,
  pattern: /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'’-]*$/u,
  patternMessage: "Use letters, spaces, apostrophes, hyphens, and periods only.",
});
const tableLabel = text(LIMITS.TABLE_LABEL_MAX, {
  pattern: /^[\p{L}\p{N}][\p{L}\p{N} #._:/-]*$/u,
  patternMessage: "Use letters, numbers, spaces, and # . _ : / - only.",
});
const guests = whole(1, BOOKING.MAX_GUESTS);
const minutes = whole(BOOKING.MIN_DURATION_MINUTES, BOOKING.MAX_DURATION_MINUTES);

const pagination = {
  page: whole(1, MAX_PAGE_NUMBER),
  limit: whole(1, MAX_PAGE_SIZE),
};

// Auth
export const registerSchema = {
  name: required(personName),
  email: required(email),
  password: required(newPassword),
};
export const loginSchema = { email: required(email), password: required(anyPassword) };
export const profileSchema = {
  name: personName,
  email,
  password: newPassword,
  currentPassword: anyPassword,
};

// Users (administrator)
export const userCreateSchema = {
  name: required(personName),
  email: required(email),
  password: required(newPassword),
  role: required(role),
};
export const userReplaceSchema = {
  name: required(personName),
  email: required(email),
  role: required(role),
  password: newPassword,
};
export const userPatchSchema = {
  name: personName,
  email,
  role,
  password: newPassword,
};
export const userListQuery = { ...pagination };

// Restaurants
const optional = (rule) => ({ ...rule, nullable: true });
const optionalText = (max, extra = {}) => optional(text(max, extra));
const textList = (maxItems) => ({ type: "array", maxItems, items: text(LIMITS.LIST_ITEM_MAX) });
const coordinate = (limit) => optional({ type: "number", min: -limit, max: limit });
const url = { type: "url" };

// Used for create (POST), replace (PUT), and partial update (PATCH) by administrators.
export const restaurantSchema = {
  name: required(text(LIMITS.RESTAURANT_NAME_MAX)),
  description: optionalText(LIMITS.DESCRIPTION_MAX, { multiline: true }),
  cuisine: textList(10),
  category: optionalText(LIMITS.LIST_ITEM_MAX),
  address: optionalText(LIMITS.ADDRESS_MAX),
  barangay: optionalText(LIMITS.CITY_MAX),
  city: required(text(LIMITS.CITY_MAX)),
  province: optionalText(LIMITS.CITY_MAX),
  latitude: coordinate(90),
  longitude: coordinate(180),
  phone: optional(text(LIMITS.PHONE_MAX, { pattern: /^[+\d][\d\s().,;/-]{3,48}$/, patternMessage: "Use digits, spaces, and + ( ) - only." })),
  email: optional(email),
  website: optional(url),
  image: optional(url),
  imageCredit: optionalText(LIMITS.ADDRESS_MAX),
  gallery: { type: "array", maxItems: 10, items: url },
  openingHours: optionalText(LIMITS.HOURS_MAX),
  priceRange: optional({ type: "enum", values: PRICE_RANGES }),
  rating: optional({ type: "number", min: 0, max: 5 }),
  reviewCount: optional(whole(0, 10000000)),
  amenities: textList(20),
  active: flag,
};

// Public search. Every filter is optional and validated, so nothing reaches the database unchecked.
export const restaurantSearchQuery = {
  ...pagination,
  q: text(LIMITS.SEARCH_MAX),
  city: text(LIMITS.CITY_MAX),
  province: text(LIMITS.CITY_MAX),
  cuisine: text(LIMITS.LIST_ITEM_MAX),
  category: text(LIMITS.LIST_ITEM_MAX),
  priceRange: { type: "enum", values: PRICE_RANGES },
  minRating: { type: "number", min: 0, max: 5 },
  hasTables: flag,
  status: { type: "enum", values: ["active", "inactive"] },
  sort: { type: "enum", values: RESTAURANT_SORTS },
  order: { type: "enum", values: ["asc", "desc"] },
};
export const restaurantListQuery = restaurantSearchQuery;
export const cityParam = { city: required(text(LIMITS.CITY_MAX)) };
export const cuisineParam = { cuisine: required(text(LIMITS.LIST_ITEM_MAX)) };

// Administrator action: start an import from the external restaurant source.
export const syncSchema = {
  areas: { type: "array", maxItems: 10, items: text(40) },
  dryRun: flag,
};

// Tables. restaurantId is deliberately absent from the update schema:
// a table can never be moved to another restaurant.
export const tableCreateSchema = {
  restaurantId: required(id),
  label: required(tableLabel),
  capacity: required(whole(1, LIMITS.TABLE_CAPACITY_MAX)),
  active: flag,
};
export const tableUpdateSchema = {
  label: required(tableLabel),
  capacity: required(whole(1, LIMITS.TABLE_CAPACITY_MAX)),
  active: flag,
};
export const tableListQuery = { ...pagination, restaurantId: id, active: flag };

// Reservations
export const reservationCreateSchema = {
  restaurantId: required(id),
  tableId: required(id),
  userId: id,
  guestCount: required(guests),
  startAt: required(timestamp),
  durationMinutes: minutes,
  notes,
};
export const reservationReplaceSchema = {
  tableId: required(id),
  guestCount: required(guests),
  startAt: required(timestamp),
  durationMinutes: required(minutes),
  notes,
};
export const reservationPatchSchema = {
  tableId: id,
  guestCount: guests,
  startAt: timestamp,
  durationMinutes: minutes,
  notes,
  status: {
    type: "enum",
    values: [RESERVATION_STATUS.CANCELLED, RESERVATION_STATUS.COMPLETED],
  },
};
export const reservationListQuery = {
  ...pagination,
  restaurantId: id,
  tableId: id,
  status: { type: "enum", values: Object.values(RESERVATION_STATUS) },
};
export const availabilityQuery = {
  restaurantId: required(id),
  startAt: required(timestamp),
  guestCount: required(guests),
  durationMinutes: minutes,
  excludeId: id,
};
