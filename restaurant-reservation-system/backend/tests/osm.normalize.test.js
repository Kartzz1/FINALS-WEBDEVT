import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCuisine, normalizeImage, normalizeOsmElement, normalizeWebsite } from "../src/services/providers/osmNormalize.js";

const AREA = { key: "lipa", city: "Lipa City", province: "Batangas", osmName: "Lipa" };
const IMPORTED_AT = new Date("2030-01-01T00:00:00Z");

// Fixtures follow the shape of Overpass JSON. The names and numbers are made up for the tests.
const node = (tags, extra = {}) => ({ type: "node", id: 111, lat: 13.94, lon: 121.16, tags, ...extra });

describe("OpenStreetMap normalization", () => {
  it("skips elements without a name", () => {
    assert.equal(normalizeOsmElement(node({ amenity: "restaurant" }), AREA), null);
  });

  it("builds a stable provider id and a source record", () => {
    const result = normalizeOsmElement(node({ amenity: "restaurant", name: "Fixture Kitchen" }), AREA, IMPORTED_AT);
    assert.equal(result.externalPlaceId, "osm:node/111");
    assert.deepEqual(result.source, {
      provider: "openstreetmap",
      url: "https://www.openstreetmap.org/node/111",
      license: "ODbL 1.0",
      importedAt: IMPORTED_AT,
    });
  });

  it("takes the city and province from the boundary searched, not from address tags", () => {
    const result = normalizeOsmElement(node({ amenity: "cafe", name: "Fixture Cafe", "addr:city": "Somewhere Else" }), AREA);
    assert.equal(result.city, "Lipa City");
    assert.equal(result.province, "Batangas");
    assert.equal(result.category, "Cafe");
  });

  it("uses the centre point for buildings and areas", () => {
    const way = { type: "way", id: 222, center: { lat: 13.95, lon: 121.17 }, tags: { amenity: "restaurant", name: "Fixture Hall" } };
    const result = normalizeOsmElement(way, AREA);
    assert.equal(result.externalPlaceId, "osm:way/222");
    assert.deepEqual([result.latitude, result.longitude], [13.95, 121.17]);
  });

  it("never invents values: missing information stays null or empty", () => {
    const result = normalizeOsmElement(node({ amenity: "restaurant", name: "Fixture Bare" }), AREA);
    for (const field of ["description", "address", "barangay", "phone", "email", "website", "image", "openingHours", "priceRange", "rating", "reviewCount"]) {
      assert.equal(result[field], null, field);
    }
    assert.deepEqual(result.cuisine, []);
    assert.deepEqual(result.amenities, []);
  });

  it("reads contact details, opening hours, and an address when OpenStreetMap has them", () => {
    const result = normalizeOsmElement(
      node({
        amenity: "restaurant",
        name: "  Fixture   Kitchen ",
        phone: "+63 000 000 0000; +63 111 111 1111",
        "contact:email": "Info@Example.com",
        website: "www.example.com/menu",
        opening_hours: "Mo-Su 10:00-22:00",
        "addr:housenumber": "12",
        "addr:street": "Fixture Street",
        "addr:suburb": "Fixture Barangay",
        description: "A made-up description.",
      }),
      AREA
    );
    assert.equal(result.name, "Fixture Kitchen");
    assert.equal(result.phone, "+63 000 000 0000");
    assert.equal(result.email, "info@example.com");
    assert.equal(result.website, "https://www.example.com/menu");
    assert.equal(result.openingHours, "Mo-Su 10:00-22:00");
    assert.equal(result.address, "12 Fixture Street, Fixture Barangay");
    assert.equal(result.barangay, "Fixture Barangay");
    assert.equal(result.description, "A made-up description.");
  });

  it("drops contact values that are not valid instead of storing junk", () => {
    const result = normalizeOsmElement(node({ amenity: "restaurant", name: "Fixture", phone: "call us", email: "not an email", website: "javascript:alert(1)" }), AREA);
    assert.equal(result.phone, null);
    assert.equal(result.email, null);
    assert.equal(result.website, null);
  });

  it("maps cuisines to readable labels and keeps unfamiliar ones", () => {
    assert.deepEqual(normalizeCuisine("filipino;seafood;steak_house;thai"), ["Filipino", "Seafood", "Steakhouse", "Thai"]);
    assert.deepEqual(normalizeCuisine("japanese;Japanese"), ["Japanese"]);
    assert.deepEqual(normalizeCuisine("<script>"), []);
    assert.deepEqual(normalizeCuisine(undefined), []);
  });

  it("turns amenity tags into labels", () => {
    const result = normalizeOsmElement(node({ amenity: "restaurant", name: "Fixture", outdoor_seating: "yes", internet_access: "wlan", reservation: "required", wheelchair: "no" }), AREA);
    assert.deepEqual(result.amenities.sort(), ["Accepts reservations", "Outdoor seating", "Wi-Fi"]);
  });

  it("only uses freely licensed Wikimedia Commons images", () => {
    assert.deepEqual(normalizeImage({ image: "https://example.com/photo.jpg" }), { image: null, imageCredit: null });
    assert.deepEqual(normalizeImage({ image: "http://upload.wikimedia.org/x.jpg" }), { image: null, imageCredit: null });
    const commons = normalizeImage({ wikimedia_commons: "File:Fixture Photo.jpg" });
    assert.equal(commons.image, "https://commons.wikimedia.org/wiki/Special:FilePath/Fixture_Photo.jpg?width=1000");
    assert.equal(commons.imageCredit, "Image from Wikimedia Commons");
    assert.equal(normalizeImage({ image: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.jpg" }).image, "https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.jpg");
  });

  it("normalizes website addresses safely", () => {
    assert.equal(normalizeWebsite("example.com"), "https://example.com/");
    assert.equal(normalizeWebsite("http://example.com/a"), "http://example.com/a");
    assert.equal(normalizeWebsite("ftp://example.com"), null);
    assert.equal(normalizeWebsite("just words"), null);
  });
});
