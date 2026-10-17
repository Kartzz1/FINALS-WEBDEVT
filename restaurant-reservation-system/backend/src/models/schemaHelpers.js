import { randomUUID } from "node:crypto";

// Functions rather than shared objects so each schema gets its own copy.
export const idField = () => ({ type: String, default: () => randomUUID() });

export const wholeNumber = () => ({
  validator: Number.isInteger,
  message: "{PATH} must be a whole number",
});
