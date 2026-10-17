import { LIMITS } from "../constants.js";

export const BOOKING = Object.freeze({
  MIN_DURATION_MINUTES: 30,
  MAX_DURATION_MINUTES: 240,
  DEFAULT_DURATION_MINUTES: 90,
  MAX_ADVANCE_DAYS: 60,
  MAX_GUESTS: LIMITS.TABLE_CAPACITY_MAX,
});

// Upper bound when loading every table of one restaurant for availability.
export const MAX_TABLES_PER_RESTAURANT = 200;
