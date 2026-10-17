import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { rejectsWith, resetState, store } from "./helpers.js";
import * as restaurantService from "../src/services/restaurantService.js";
import {
  buildMergePatch,
  getSyncStatus,
  resetSyncState,
  runRestaurantSync,
  startRestaurantSync,
} from "../src/services/restaurantImportService.js";

const silent = { info() {}, warn() {}, error() {} };

// A stand-in for the external source. The candidates are made-up test data.
function fakeProvider(byArea) {
  return {
    name: "fake",
    async fetchArea(area) {
      const value = byArea[area.key];
      if (value instanceof Error) throw value;
      if (typeof value === "function") return value();
      return { candidates: value ?? [], skipped: 0, partial: false };
    },
  };
}

function candidate(n, overrides = {}) {
  return {
    externalPlaceId: `fake:node/${n}`,
    name: `Fixture Place ${n}`,
    description: null, cuisine: [], category: "Restaurant",
    address: null, barangay: null, city: "Lipa City", province: "Batangas",
    latitude: 13.9 + n * 0.01, longitude: 121.1,
    phone: null, email: null, website: null, image: null, imageCredit: null, openingHours: null,
    priceRange: null, rating: null, reviewCount: null, amenities: [],
    source: { provider: "fake", url: `https://example.test/${n}`, license: "test", importedAt: new Date("2030-01-01T00:00:00Z") },
    ...overrides,
  };
}

const sync = (byArea, options = {}) =>
  runRestaurantSync({ areaKeys: ["lipa"], ...options }, { provider: fakeProvider(byArea), logger: silent });
const everything = async () => (await store.restaurants.search({ limit: 100 })).items;

beforeEach(() => {
  resetState();
  resetSyncState();
});

describe("restaurant sync", () => {
  it("inserts new restaurants with their source, location, and an active status", async () => {
    const run = await sync({ lipa: [candidate(1), candidate(2)] });
    assert.equal(run.status, "completed");
    assert.deepEqual([run.totals.fetched, run.totals.created, run.totals.updated], [2, 2, 0]);
    const [first] = await everything();
    assert.equal(first.active, true);
    assert.equal(first.source.provider, "fake");
    assert.deepEqual(first.location.type, "Point");
  });

  it("is safe to run again: no duplicates, nothing changes", async () => {
    await sync({ lipa: [candidate(1), candidate(2)] });
    const second = await sync({ lipa: [candidate(1), candidate(2)] });
    assert.deepEqual([second.totals.created, second.totals.updated, second.totals.unchanged], [0, 0, 2]);
    assert.equal((await everything()).length, 2);
  });

  it("updates an existing restaurant when the source has new information", async () => {
    await sync({ lipa: [candidate(1)] });
    const run = await sync({ lipa: [candidate(1, { phone: "+63 000 000 0000", name: "Fixture Place 1 Renamed" })] });
    assert.equal(run.totals.updated, 1);
    const [restaurant] = await everything();
    assert.equal(restaurant.phone, "+63 000 000 0000");
    assert.equal(restaurant.name, "Fixture Place 1 Renamed");
    assert.equal(restaurant.profileScore, 1);
  });

  it("never overwrites good information with empty values", async () => {
    await sync({ lipa: [candidate(1, { phone: "+63 000 000 0000", website: "https://example.test/", cuisine: ["Filipino"], openingHours: "Mo-Su 10:00-22:00" })] });
    const run = await sync({ lipa: [candidate(1, { phone: null, website: "", cuisine: [], openingHours: null })] });
    assert.equal(run.totals.unchanged, 1);
    const [restaurant] = await everything();
    assert.equal(restaurant.phone, "+63 000 000 0000");
    assert.equal(restaurant.website, "https://example.test/");
    assert.deepEqual(restaurant.cuisine, ["Filipino"]);
    assert.equal(restaurant.openingHours, "Mo-Su 10:00-22:00");
  });

  it("leaves fields alone that an administrator edited by hand", async () => {
    await sync({ lipa: [candidate(1, { phone: "+63 000 000 0000" })] });
    const [created] = await everything();
    await restaurantService.updateRestaurant(created.id, { phone: "+63 999 999 9999" });
    const run = await sync({ lipa: [candidate(1, { phone: "+63 111 111 1111", website: "https://example.test/new" })] });
    assert.equal(run.totals.updated, 1);
    const [restaurant] = await everything();
    assert.equal(restaurant.phone, "+63 999 999 9999"); // the admin's value stays
    assert.equal(restaurant.website, "https://example.test/new"); // untouched fields still sync
  });

  it("does not reopen a restaurant an administrator deactivated", async () => {
    await sync({ lipa: [candidate(1)] });
    const [created] = await everything();
    await restaurantService.updateRestaurant(created.id, { active: false });
    await sync({ lipa: [candidate(1, { phone: "+63 000 000 0000" })] });
    assert.equal((await everything())[0].active, false);
  });

  it("skips the same place mapped twice (same name, within 75 metres)", async () => {
    const run = await sync({
      lipa: [candidate(1, { latitude: 13.94, longitude: 121.1 }), candidate(2, { name: "Fixture Place 1", latitude: 13.9401, longitude: 121.1 })],
    });
    assert.deepEqual([run.totals.created, run.totals.duplicates], [1, 1]);
  });

  it("keeps two branches that share a name but are far apart", async () => {
    const run = await sync({
      lipa: [candidate(1, { latitude: 13.94, longitude: 121.1 }), candidate(2, { name: "Fixture Place 1", latitude: 13.96, longitude: 121.1 })],
    });
    assert.equal(run.totals.created, 2);
  });

  it("a dry run reports what would happen but saves nothing", async () => {
    const run = await sync({ lipa: [candidate(1), candidate(2)] }, { dryRun: true });
    assert.equal(run.dryRun, true);
    assert.equal(run.totals.created, 2);
    assert.equal((await everything()).length, 0);
  });

  it("logs a record that fails and carries on with the rest", async () => {
    // Two entries share one provider id; the second hits the unique constraint.
    const run = await sync({ lipa: [candidate(1), candidate(1, { name: "Fixture Twin" }), candidate(3)] });
    assert.equal(run.status, "completed_with_errors");
    assert.deepEqual([run.totals.created, run.totals.failed], [2, 1]);
    assert.equal(run.failures.length, 1);
    assert.equal(run.failures[0].externalPlaceId, "fake:node/1");
    assert.match(run.failures[0].reason, /already in use/);
  });

  it("reports an area that cannot be loaded, and still finishes the others", async () => {
    const run = await sync(
      { lipa: new Error("The OpenStreetMap server is busy (HTTP 429)"), batangas: [candidate(7, { city: "Batangas City" })] },
      { areaKeys: ["lipa", "batangas"] }
    );
    assert.equal(run.status, "completed_with_errors");
    assert.equal(run.areas[0].status, "failed");
    assert.match(run.areas[0].error, /busy/);
    assert.equal(run.areas[1].status, "completed");
    assert.equal(run.totals.created, 1);
  });

  it("marks the run failed when every area fails", async () => {
    const run = await sync({ lipa: new Error("network down") });
    assert.equal(run.status, "failed");
  });

  it("rejects unknown areas before doing anything", async () => {
    await rejectsWith(sync({}, { areaKeys: ["atlantis"] }), 400);
    assert.equal(getSyncStatus(), null);
  });

  it("allows only one sync at a time and exposes progress", async () => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const provider = fakeProvider({ lipa: async () => { await gate; return { candidates: [candidate(1)], skipped: 0, partial: false }; } });

    const started = startRestaurantSync({ areaKeys: ["lipa"] }, { provider, logger: silent });
    assert.equal(started.status, "running");
    assert.equal(getSyncStatus().status, "running");
    assert.throws(() => startRestaurantSync({ areaKeys: ["lipa"] }, { provider, logger: silent }), (e) => e.status === 409);
    await rejectsWith(runRestaurantSync({ areaKeys: ["lipa"] }, { provider, logger: silent }), 409);

    release();
    for (let i = 0; i < 50 && getSyncStatus().status === "running"; i += 1) await new Promise((r) => setTimeout(r, 5));
    assert.equal(getSyncStatus().status, "completed");
    assert.equal(getSyncStatus().totals.created, 1);
  });
});

describe("merge rules", () => {
  const existing = { id: "x", name: "Fixture", phone: "111", manualFields: [], cuisine: ["Thai"], latitude: 1, longitude: 2 };

  it("returns an empty patch when nothing real changed", () => {
    assert.deepEqual(buildMergePatch(existing, { name: "Fixture", phone: "111", cuisine: ["Thai"], website: null, source: {} }), {});
  });

  it("recomputes the location only when the coordinates change", () => {
    const patch = buildMergePatch(existing, { latitude: 3, longitude: 2, source: { provider: "fake" } });
    assert.deepEqual(patch.location, { type: "Point", coordinates: [2, 3] });
    assert.equal(patch.source.provider, "fake");
    assert.equal("location" in buildMergePatch(existing, { phone: "222", source: {} }), false);
  });
});
