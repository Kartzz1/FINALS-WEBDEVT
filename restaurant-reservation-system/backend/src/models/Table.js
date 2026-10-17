import mongoose from "mongoose";
import { LABEL_COLLATION, LIMITS } from "../constants.js";
import { idField, wholeNumber } from "./schemaHelpers.js";

const tableSchema = new mongoose.Schema(
  {
    _id: idField(),
    restaurantId: { type: String, required: true, ref: "Restaurant" },
    label: { type: String, required: true, trim: true, maxlength: LIMITS.TABLE_LABEL_MAX },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      max: LIMITS.TABLE_CAPACITY_MAX,
      validate: wholeNumber(),
    },
    active: { type: Boolean, default: true },
    // Internal write-control counter. Every booking transaction increments it,
    // so two transactions for the same table collide on this document and
    // MongoDB aborts one of them. It is never exposed through the API.
    bookingVersion: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

tableSchema.index(
  { restaurantId: 1, label: 1 },
  { unique: true, collation: LABEL_COLLATION }
);

export const Table = mongoose.model("Table", tableSchema);
