import mongoose from "mongoose";
import { LIMITS, ROLES } from "../constants.js";
import { idField } from "./schemaHelpers.js";

const userSchema = new mongoose.Schema(
  {
    _id: idField(),
    name: { type: String, required: true, trim: true, maxlength: LIMITS.NAME_MAX },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: LIMITS.EMAIL_MAX,
    },
    // select: false keeps the hash out of every query unless asked for.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export const User = mongoose.model("User", userSchema);
