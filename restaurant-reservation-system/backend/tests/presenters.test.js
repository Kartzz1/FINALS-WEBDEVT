import assert from "node:assert/strict";
import { describe, it } from "node:test";
import "./helpers.js";
import { presentReservation, presentRestaurant, presentTable } from "../src/presenters.js";

describe("presenters", () => {
  it("shows reservation date and time in the restaurant's time zone (Asia/Manila by default)", () => {
    const view = presentReservation({ startAt: new Date("2030-06-02T18:00:00Z"), guestCount: 3, notes: "Window seat" });
    assert.equal(view.reservationDate, "2030-06-03");
    assert.equal(view.reservationTime, "02:00");
    assert.equal(view.numberOfGuests, 3);
    assert.equal(view.specialRequest, "Window seat");
  });

  it("never shows 24:00 at midnight and reports an empty request as null", () => {
    const view = presentReservation({ startAt: new Date("2030-06-02T16:00:00Z"), guestCount: 1, notes: "" });
    assert.equal(view.reservationTime, "00:00");
    assert.equal(view.reservationDate, "2030-06-03");
    assert.equal(view.specialRequest, null);
  });

  it("exposes the table number and a readable status", () => {
    assert.deepEqual(
      [presentTable({ label: "T4", active: true }).tableNumber, presentTable({ label: "T4", active: true }).status],
      ["T4", "available"]
    );
    assert.equal(presentTable({ label: "T5", active: false }).status, "unavailable");
  });

  it("keeps import bookkeeping away from the public and fills missing fields with null", () => {
    const restaurant = { id: "r1", name: "Fixture", active: true, externalPlaceId: "osm:node/1", manualFields: ["phone"], profileScore: 3, internalNote: "secret" };
    const publicView = presentRestaurant(restaurant);
    for (const hidden of ["externalPlaceId", "manualFields", "profileScore", "internalNote", "active"]) {
      assert.equal(hidden in publicView, false, hidden);
    }
    assert.equal(publicView.status, "active");
    assert.equal(publicView.rating, null);
    assert.deepEqual(publicView.cuisine, []);
    assert.deepEqual(publicView.tableSummary, { count: 0, seats: 0, capacities: [] });
    const adminView = presentRestaurant(restaurant, { admin: true });
    assert.equal(adminView.externalPlaceId, "osm:node/1");
    assert.deepEqual(adminView.manualFields, ["phone"]);
    assert.equal("internalNote" in adminView, false);
  });

  it("exposes only the licence information of the data source", () => {
    const view = presentRestaurant({ id: "r1", name: "Fixture", active: true, source: { provider: "openstreetmap", url: "https://www.openstreetmap.org/node/1", license: "ODbL 1.0", importedAt: new Date() } });
    assert.deepEqual(view.source, { provider: "openstreetmap", url: "https://www.openstreetmap.org/node/1", license: "ODbL 1.0" });
  });
});
