import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { makeFixtureRestaurant, makeTable, makeUser, rejectsWith, resetState, store } from "./helpers.js";
import * as restaurantService from "../src/services/restaurantService.js";

let admin;
const search = (query = {}, actor = null) => restaurantService.searchRestaurants(actor, { page: 1, limit: 50, ...query });
const names = (result) => result.items.map((r) => r.name);

beforeEach(async () => {
  resetState();
  admin = await makeUser({ role: "admin" });
});

describe("restaurant search", () => {
  it("works for guests and returns only active restaurants", async () => {
    await makeFixtureRestaurant({ name: "Fixture Open" });
    await makeFixtureRestaurant({ name: "Fixture Closed", active: false });
    assert.deepEqual(names(await search()), ["Fixture Open"]);
  });

  it("lets administrators see everything and filter by status", async () => {
    await makeFixtureRestaurant({ name: "Fixture Open" });
    await makeFixtureRestaurant({ name: "Fixture Closed", active: false });
    assert.equal((await search({}, admin)).total, 2);
    assert.deepEqual(names(await search({ status: "inactive" }, admin)), ["Fixture Closed"]);
    assert.deepEqual(names(await search({ status: "active" }, admin)), ["Fixture Open"]);
  });

  it("finds restaurants by name, city, barangay, address, and cuisine text", async () => {
    await makeFixtureRestaurant({ name: "Fixture Grill", city: "Batangas City", cuisine: ["Japanese"] });
    await makeFixtureRestaurant({ name: "Fixture Cafe", city: "Lipa City", barangay: "Fixture Barangay" });
    assert.deepEqual(names(await search({ q: "grill" })), ["Fixture Grill"]);
    assert.deepEqual(names(await search({ q: "japan" })), ["Fixture Grill"]);
    assert.deepEqual(names(await search({ q: "lipa" })), ["Fixture Cafe"]);
    assert.deepEqual(names(await search({ q: "barangay" })), ["Fixture Cafe"]);
    assert.equal((await search({ q: "no such thing" })).total, 0);
  });

  it("treats search text as plain text, not as a pattern", async () => {
    await makeFixtureRestaurant({ name: "Fixture (Special) Place" });
    assert.equal((await search({ q: "(Special)" })).total, 1);
    assert.equal((await search({ q: ".*" })).total, 0);
  });

  it('matches "Lipa" to Lipa City but not to other cities', async () => {
    await makeFixtureRestaurant({ name: "Fixture A", city: "Lipa City" });
    await makeFixtureRestaurant({ name: "Fixture B", city: "Batangas City" });
    assert.deepEqual(names(await search({ city: "Lipa" })), ["Fixture A"]);
    assert.deepEqual(names(await search({ city: "lipa city" })), ["Fixture A"]);
    assert.deepEqual(names(await search({ city: "Batangas" })), ["Fixture B"]);
  });

  it("filters by cuisine and category, ignoring case", async () => {
    await makeFixtureRestaurant({ name: "Fixture Sushi", cuisine: ["Japanese", "Sushi"], category: "Restaurant" });
    await makeFixtureRestaurant({ name: "Fixture Coffee", cuisine: ["Coffee"], category: "Cafe" });
    assert.deepEqual(names(await search({ cuisine: "japanese" })), ["Fixture Sushi"]);
    assert.deepEqual(names(await search({ category: "cafe" })), ["Fixture Coffee"]);
    assert.equal((await search({ cuisine: "Japan" })).total, 0); // exact match for cuisine filters
  });

  it("filters by price range and minimum rating, and unknown values never match", async () => {
    await makeFixtureRestaurant({ name: "Fixture Cheap", priceRange: "$", rating: 3.5 });
    await makeFixtureRestaurant({ name: "Fixture Fancy", priceRange: "$$$", rating: 4.8 });
    await makeFixtureRestaurant({ name: "Fixture Unknown" });
    assert.deepEqual(names(await search({ priceRange: "$$$" })), ["Fixture Fancy"]);
    assert.deepEqual(names(await search({ minRating: 4 })), ["Fixture Fancy"]);
    assert.deepEqual(names(await search({ minRating: 3 })).sort(), ["Fixture Cheap", "Fixture Fancy"]);
  });

  it("filters by availability: only restaurants with open tables", async () => {
    const withTable = await makeFixtureRestaurant({ name: "Fixture Has Tables" });
    await makeFixtureRestaurant({ name: "Fixture No Tables" });
    const closedOnly = await makeFixtureRestaurant({ name: "Fixture Closed Tables" });
    await makeTable(withTable.id, { capacity: 4 });
    await makeTable(closedOnly.id, { capacity: 2, active: false });
    assert.deepEqual(names(await search({ hasTables: true })), ["Fixture Has Tables"]);
    assert.equal((await search({})).total, 3);
  });

  it("attaches a table summary worked out from the Table collection", async () => {
    const restaurant = await makeFixtureRestaurant({ name: "Fixture Seats" });
    await makeTable(restaurant.id, { capacity: 2 });
    await makeTable(restaurant.id, { capacity: 4 });
    await makeTable(restaurant.id, { capacity: 4 });
    await makeTable(restaurant.id, { capacity: 10, active: false });
    const [item] = (await search()).items;
    assert.deepEqual(item.tableSummary, { count: 3, seats: 10, capacities: [2, 4] });
  });

  it("sorts by rating with unrated restaurants last, in either direction", async () => {
    await makeFixtureRestaurant({ name: "Fixture Unrated" });
    await makeFixtureRestaurant({ name: "Fixture Good", rating: 4.5 });
    await makeFixtureRestaurant({ name: "Fixture Better", rating: 4.9 });
    assert.deepEqual(names(await search({ sort: "rating" })), ["Fixture Better", "Fixture Good", "Fixture Unrated"]);
    assert.deepEqual(names(await search({ sort: "rating", order: "asc" })), ["Fixture Good", "Fixture Better", "Fixture Unrated"]);
  });

  it("sorts by name and by price, with unknown prices last", async () => {
    await makeFixtureRestaurant({ name: "Fixture Charlie", priceRange: "$$" });
    await makeFixtureRestaurant({ name: "Fixture Alpha" });
    await makeFixtureRestaurant({ name: "Fixture Bravo", priceRange: "$" });
    assert.deepEqual(names(await search({ sort: "name" })), ["Fixture Alpha", "Fixture Bravo", "Fixture Charlie"]);
    assert.deepEqual(names(await search({ sort: "name", order: "desc" })), ["Fixture Charlie", "Fixture Bravo", "Fixture Alpha"]);
    assert.deepEqual(names(await search({ sort: "price" })), ["Fixture Bravo", "Fixture Charlie", "Fixture Alpha"]);
    assert.deepEqual(names(await search({ sort: "price", order: "desc" })), ["Fixture Charlie", "Fixture Bravo", "Fixture Alpha"]);
  });

  it("puts the most complete listings first when nothing is rated (featured)", async () => {
    await makeFixtureRestaurant({ name: "Fixture Bare", profileScore: 0 });
    await makeFixtureRestaurant({ name: "Fixture Complete", profileScore: 5 });
    assert.deepEqual(names(await search({ sort: "featured" })), ["Fixture Complete", "Fixture Bare"]);
  });

  it("paginates and reports the total", async () => {
    for (let n = 1; n <= 5; n += 1) await makeFixtureRestaurant({ name: `Fixture N${n}` });
    const page = await search({ sort: "name", page: 2, limit: 2 });
    assert.deepEqual(names(page), ["Fixture N3", "Fixture N4"]);
    assert.equal(page.total, 5);
  });

  it("builds facet counts from active restaurants only", async () => {
    await makeFixtureRestaurant({ city: "Lipa City", cuisine: ["Filipino", "Seafood"], category: "Restaurant" });
    await makeFixtureRestaurant({ city: "Lipa City", cuisine: ["Filipino"], category: "Cafe" });
    await makeFixtureRestaurant({ city: "Batangas City", cuisine: ["Japanese"], category: "Restaurant" });
    await makeFixtureRestaurant({ city: "Batangas City", cuisine: ["Japanese"], active: false });
    const facets = await restaurantService.listFacets();
    assert.deepEqual(facets.cities, [{ name: "Lipa City", count: 2 }, { name: "Batangas City", count: 1 }]);
    assert.deepEqual(facets.cuisines[0], { name: "Filipino", count: 2 });
    assert.ok(facets.cuisines.some((c) => c.name === "Japanese" && c.count === 1));
    assert.deepEqual(facets.categories[0], { name: "Restaurant", count: 2 });
  });
});

describe("restaurant management", () => {
  it("rejects half a coordinate pair and stores a location for a full pair", async () => {
    await rejectsWith(restaurantService.createRestaurant({ name: "Fixture", city: "Lipa City", latitude: 13.9 }), 400);
    const created = await restaurantService.createRestaurant({ name: "Fixture", city: "Lipa City", latitude: 13.9, longitude: 121.1 });
    assert.deepEqual(created.location, { type: "Point", coordinates: [121.1, 13.9] });
    assert.equal(created.province, "Batangas");
  });

  it("scores listing completeness and remembers which fields an administrator edited", async () => {
    const created = await restaurantService.createRestaurant({ name: "Fixture", city: "Lipa City" });
    assert.equal(created.profileScore, 0);
    const updated = await restaurantService.updateRestaurant(created.id, { phone: "+63 000 000 0000", description: "Fixture text" });
    assert.equal(updated.profileScore, 2);
    assert.deepEqual([...updated.manualFields].sort(), ["description", "phone"]);
  });

  it("returns 404 for unknown restaurants and hides inactive ones from guests", async () => {
    await rejectsWith(restaurantService.getRestaurant(null, "6f1c2a3e-8b1d-4e0a-9c1d-2b3c4d5e6f70"), 404);
    const closed = await makeFixtureRestaurant({ active: false });
    await rejectsWith(restaurantService.getRestaurant(null, closed.id), 404);
    assert.equal((await restaurantService.getRestaurant(admin, closed.id)).id, closed.id);
  });
});

describe("store parity", () => {
  it("finds restaurants by provider id and enforces its uniqueness", async () => {
    await makeFixtureRestaurant({ externalPlaceId: "fake:node/1" });
    const found = await store.restaurants.findByExternalIds(["fake:node/1", "fake:node/2"]);
    assert.equal(found.length, 1);
    await rejectsWith(makeFixtureRestaurant({ externalPlaceId: "fake:node/1" }), 409);
    // restaurants without a provider id never collide with each other
    await makeFixtureRestaurant();
    await makeFixtureRestaurant();
  });
});
