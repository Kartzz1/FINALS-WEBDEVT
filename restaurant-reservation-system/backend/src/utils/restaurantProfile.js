// Small pure helpers shared by the restaurant service and the importer.

export function cleanString(value, max = 500) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

export function isEmptyValue(value) {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

// GeoJSON point for the 2dsphere index. MongoDB wants [longitude, latitude].
export function buildLocation(latitude, longitude) {
  const valid =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;
  return valid ? { type: "Point", coordinates: [longitude, latitude] } : null;
}

// How complete a listing is (0 to 6). Used to put well-documented restaurants first
// when there are no ratings to sort by. It is a data-quality score, not a popularity score.
export function computeProfileScore(restaurant) {
  return [
    restaurant.image,
    restaurant.phone,
    restaurant.website,
    restaurant.openingHours,
    restaurant.description,
    restaurant.address,
  ].filter((value) => !isEmptyValue(value)).length;
}

const EARTH_RADIUS_METERS = 6371000;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
