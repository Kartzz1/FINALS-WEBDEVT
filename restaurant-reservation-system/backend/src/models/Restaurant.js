import mongoose from "mongoose";
import { LIMITS, PRICE_RANGES } from "../constants.js";
import { idField } from "./schemaHelpers.js";

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    _id: idField(),
    name: { type: String, required: true, trim: true, maxlength: LIMITS.RESTAURANT_NAME_MAX },
    description: { type: String, trim: true, maxlength: LIMITS.DESCRIPTION_MAX, default: null },
    cuisine: { type: [String], default: [] },
    category: { type: String, trim: true, maxlength: LIMITS.LIST_ITEM_MAX, default: null },

    address: { type: String, trim: true, maxlength: LIMITS.ADDRESS_MAX, default: null },
    barangay: { type: String, trim: true, maxlength: LIMITS.CITY_MAX, default: null },
    city: { type: String, trim: true, maxlength: LIMITS.CITY_MAX, default: null },
    province: { type: String, trim: true, maxlength: LIMITS.CITY_MAX, default: null },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    // GeoJSON copy of latitude/longitude so MongoDB can answer "near me" queries.
    // Absent (not empty) when the coordinates are unknown, which a 2dsphere index requires.
    location: { type: pointSchema, default: undefined },

    phone: { type: String, trim: true, maxlength: LIMITS.PHONE_MAX, default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: LIMITS.EMAIL_MAX, default: null },
    website: { type: String, trim: true, maxlength: LIMITS.URL_MAX, default: null },
    image: { type: String, trim: true, maxlength: LIMITS.URL_MAX, default: null },
    imageCredit: { type: String, trim: true, maxlength: LIMITS.ADDRESS_MAX, default: null },
    gallery: { type: [String], default: [] },
    openingHours: { type: String, trim: true, maxlength: LIMITS.HOURS_MAX, default: null },

    // Unknown stays null. Ratings and prices are never invented.
    priceRange: { type: String, enum: [...PRICE_RANGES, null], default: null },
    rating: { type: Number, min: 0, max: 5, default: null },
    reviewCount: { type: Number, min: 0, default: null },
    amenities: { type: [String], default: [] },

    // Stored as a boolean; the API also exposes it as status: "active" | "inactive".
    active: { type: Boolean, default: true },

    // Which provider the record came from, and the id that makes re-imports idempotent.
    externalPlaceId: { type: String, trim: true, default: undefined },
    source: {
      provider: { type: String, default: undefined },
      url: { type: String, default: undefined },
      license: { type: String, default: undefined },
      importedAt: { type: Date, default: undefined },
    },
    // Fields an administrator edited by hand. The importer never overwrites these.
    manualFields: { type: [String], default: [] },
    profileScore: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

restaurantSchema.index({ name: 1 });
restaurantSchema.index({ city: 1 });
restaurantSchema.index({ province: 1 });
restaurantSchema.index({ cuisine: 1 });
restaurantSchema.index({ category: 1 });
restaurantSchema.index({ active: 1, city: 1 });
restaurantSchema.index({ rating: -1 });
restaurantSchema.index({ profileScore: -1, name: 1 });
restaurantSchema.index({ location: "2dsphere" });
// Unique only when a provider id exists, so hand-entered restaurants (no id) never collide.
restaurantSchema.index(
  { externalPlaceId: 1 },
  { unique: true, partialFilterExpression: { externalPlaceId: { $type: "string" } } }
);

export const Restaurant = mongoose.model("Restaurant", restaurantSchema);
