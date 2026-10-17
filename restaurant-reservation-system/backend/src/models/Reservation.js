import mongoose from "mongoose";
import { LIMITS, RESERVATION_STATUS } from "../constants.js";
import { idField, wholeNumber } from "./schemaHelpers.js";

const reservationSchema = new mongoose.Schema(
  {
    _id: idField(),
    userId: { type: String, required: true, ref: "User" },
    restaurantId: { type: String, required: true, ref: "Restaurant" },
    tableId: { type: String, required: true, ref: "Table" },
    guestName: { type: String, required: true, trim: true, maxlength: LIMITS.NAME_MAX },
    guestEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: LIMITS.EMAIL_MAX,
    },
    guestCount: {
      type: Number,
      required: true,
      min: 1,
      max: LIMITS.TABLE_CAPACITY_MAX,
      validate: wholeNumber(),
    },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1, validate: wholeNumber() },
    notes: { type: String, trim: true, maxlength: LIMITS.NOTES_MAX, default: "" },
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUS),
      default: RESERVATION_STATUS.CONFIRMED,
    },
  },
  { timestamps: true, versionKey: false }
);

// Conflict check for one table, availability search per restaurant, and
// "my reservations" for one user.
reservationSchema.index({ tableId: 1, status: 1, startAt: 1, endAt: 1 });
reservationSchema.index({ restaurantId: 1, status: 1, startAt: 1 });
reservationSchema.index({ userId: 1, startAt: -1 });

export const Reservation = mongoose.model("Reservation", reservationSchema);
