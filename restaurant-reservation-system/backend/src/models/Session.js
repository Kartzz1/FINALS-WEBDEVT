import mongoose from "mongoose";
import { idField } from "./schemaHelpers.js";

const sessionSchema = new mongoose.Schema(
  {
    _id: idField(),
    userId: { type: String, required: true, ref: "User", index: true },
    // TTL index: MongoDB removes expired sessions in the background, but only
    // about once a minute, so the auth middleware must still check expiresAt.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false }
);

export const Session = mongoose.model("Session", sessionSchema);
