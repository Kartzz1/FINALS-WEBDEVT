import "./helpers.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../src/utils/AppError.js";
import {
  loginSchema,
  registerSchema,
  reservationListQuery,
  reservationReplaceSchema,
  restaurantSchema,
  tableUpdateSchema,
  userPatchSchema,
} from "../src/validators/schemas.js";
import { parseId, validate } from "../src/validators/validate.js";

function failingFields(run) {
  try {
    run();
  } catch (err) {
    assert.ok(err instanceof AppError);
    assert.equal(err.status, 400);
    return err.details?.map((detail) => detail.field) ?? [];
  }
  return assert.fail("expected a validation error");
}

const validRegistration = { name: "Ann", email: "ann@example.com", password: "longenough1" };

describe("validate", () => {
  it("rejects unknown fields, so a role cannot be smuggled in", () => {
    const fields = failingFields(() =>
      validate({ ...validRegistration, role: "admin" }, registerSchema)
    );
    assert.deepEqual(fields, ["role"]);
  });

  it("rejects a __proto__ key in the body", () => {
    const body = JSON.parse(
      '{"__proto__":{"role":"admin"},"name":"Ann","email":"ann@example.com","password":"longenough1"}'
    );
    assert.deepEqual(failingFields(() => validate(body, registerSchema)), ["__proto__"]);
  });

  it("trims names, lowercases emails, and keeps passwords exactly as typed", () => {
    const cleaned = validate(
      { name: "  Ann  ", email: "  ANN@Example.COM ", password: "  spaced pass 1  " },
      registerSchema
    );
    assert.equal(cleaned.name, "Ann");
    assert.equal(cleaned.email, "ann@example.com");
    assert.equal(cleaned.password, "  spaced pass 1  ");
  });

  it("enforces password length and email format", () => {
    const fields = failingFields(() =>
      validate({ name: "Ann", email: "not-an-email", password: "short" }, registerSchema)
    );
    assert.deepEqual(fields.sort(), ["email", "password"]);
  });

  it("rejects MongoDB operator objects in place of strings", () => {
    const fields = failingFields(() =>
      validate({ email: { $ne: null }, password: { $gt: "" } }, loginSchema)
    );
    assert.deepEqual(fields.sort(), ["email", "password"]);
  });

  it("requires every field for full updates and reports all missing fields", () => {
    const fields = failingFields(() => validate({}, reservationReplaceSchema));
    assert.deepEqual(fields.sort(), ["guestCount", "startAt", "tableId", "durationMinutes"].sort());
  });

  it("needs at least one field for partial updates", () => {
    assert.deepEqual(failingFields(() => validate({}, userPatchSchema, { partial: true })), ["body"]);
  });

  it("rejects bodies that are not JSON objects", () => {
    failingFields(() => validate([], registerSchema));
    failingFields(() => validate("text", registerSchema));
  });

  it("accepts only real UTC timestamps", () => {
    const parsed = validate(
      { tableId: "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70", guestCount: 2, durationMinutes: 60, startAt: "2030-06-02T18:00:00Z" },
      reservationReplaceSchema
    );
    assert.ok(parsed.startAt instanceof Date);
    assert.equal(parsed.startAt.toISOString(), "2030-06-02T18:00:00.000Z");

    for (const bad of ["2030-02-31T10:00:00Z", "2030-06-02T18:00:00+08:00", "tomorrow", 1893607200]) {
      const fields = failingFields(() =>
        validate(
          { tableId: "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70", guestCount: 2, durationMinutes: 60, startAt: bad },
          reservationReplaceSchema
        )
      );
      assert.deepEqual(fields, ["startAt"], `expected ${String(bad)} to be rejected`);
    }
  });

  it("coerces query strings only when asked, and only plain whole numbers", () => {
    assert.deepEqual(validate({ page: "2", limit: "5" }, reservationListQuery, { coerce: true }), {
      page: 2,
      limit: 5,
    });
    failingFields(() => validate({ page: "2" }, reservationListQuery));
    failingFields(() => validate({ page: "2abc" }, reservationListQuery, { coerce: true }));
    failingFields(() => validate({ page: ["1", "2"] }, reservationListQuery, { coerce: true }));
    failingFields(() => validate({ limit: "500" }, reservationListQuery, { coerce: true }));
  });

  it("rejects operator-style query keys", () => {
    const fields = failingFields(() =>
      validate({ "status[$ne]": "confirmed" }, reservationListQuery, { coerce: true })
    );
    assert.deepEqual(fields, ["status[$ne]"]);
  });

  it("validates ids as UUIDs", () => {
    assert.throws(() => parseId("123"), (err) => err instanceof AppError && err.status === 400);
    assert.equal(
      parseId("6F1C2A3E-8B1D-4E0A-9C1D-2B3C4D5E6F70"),
      "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70"
    );
  });
});

describe("stricter rules", () => {
  const registration = (overrides) => ({
    name: "Ann Lee",
    email: "ann@example.com",
    password: "longenough1",
    ...overrides,
  });

  it("rejects names that are too short or contain markup", () => {
    assert.deepEqual(failingFields(() => validate(registration({ name: "A" }), registerSchema)), ["name"]);
    assert.deepEqual(
      failingFields(() => validate(registration({ name: "<script>alert(1)</script>" }), registerSchema)),
      ["name"]
    );
    assert.equal(validate(registration({ name: "Mary-Jane O'Neil Jr." }), registerSchema).name, "Mary-Jane O'Neil Jr.");
  });

  it("rejects malformed email addresses", () => {
    for (const email of ["a@b", "a..b@example.com", "a b@example.com", "@example.com", "a@example.c", "a@.com"]) {
      assert.deepEqual(failingFields(() => validate(registration({ email }), registerSchema)), ["email"], email);
    }
    assert.equal(validate(registration({ email: "first.last+tag@sub.example.co" }), registerSchema).email, "first.last+tag@sub.example.co");
  });

  it("requires a letter and a number in new passwords", () => {
    for (const password of ["abcdefgh", "12345678", "!!!!!!!!!"]) {
      assert.deepEqual(failingFields(() => validate(registration({ password }), registerSchema)), ["password"], password);
    }
    assert.equal(validate(registration({ password: "abcdefg1" }), registerSchema).password, "abcdefg1");
  });

  it("rejects control characters in single-line fields but allows line breaks in notes", () => {
    assert.deepEqual(
      failingFields(() => validate({ name: "Cafe\u0000", city: "Lipa City", address: "1 Main St" }, restaurantSchema)),
      ["name"]
    );
    assert.deepEqual(
      failingFields(() => validate({ name: "Cafe", city: "Lipa City", address: "1 Main\nStreet" }, restaurantSchema)),
      ["address"]
    );
    const base = { tableId: "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70", guestCount: 2, durationMinutes: 60, startAt: "2030-06-02T18:00:00Z" };
    assert.equal(validate({ ...base, notes: "Window seat\nplease" }, reservationReplaceSchema).notes, "Window seat\nplease");
    assert.deepEqual(failingFields(() => validate({ ...base, notes: "bell\u0007" }, reservationReplaceSchema)), ["notes"]);
  });

  it("restricts table labels to safe characters", () => {
    assert.equal(validate({ label: "Patio 3", capacity: 4 }, tableUpdateSchema).label, "Patio 3");
    assert.deepEqual(failingFields(() => validate({ label: "<b>1</b>", capacity: 4 }, tableUpdateSchema)), ["label"]);
  });
});
