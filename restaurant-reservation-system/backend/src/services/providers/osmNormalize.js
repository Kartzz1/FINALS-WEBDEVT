import { cleanString } from "../../utils/restaurantProfile.js";

// Turns one OpenStreetMap element into the shape stored in MongoDB.
// Rule: only copy what OpenStreetMap actually says. Anything missing stays null.

export const OSM_LICENSE = "ODbL 1.0";

const CATEGORY_LABELS = {
  restaurant: "Restaurant",
  cafe: "Cafe",
  fast_food: "Fast Food",
  bar: "Bar",
  pub: "Pub",
  food_court: "Food Court",
  ice_cream: "Ice Cream",
  biergarten: "Beer Garden",
};

// Display wording for common cuisine values. Unknown values are title-cased, never dropped.
const CUISINE_LABELS = {
  filipino: "Filipino",
  chinese: "Chinese",
  japanese: "Japanese",
  korean: "Korean",
  italian: "Italian",
  american: "American",
  burger: "Burgers",
  pizza: "Pizza",
  chicken: "Chicken",
  seafood: "Seafood",
  barbecue: "Barbecue",
  steak_house: "Steakhouse",
  coffee_shop: "Coffee",
  sushi: "Sushi",
  ramen: "Ramen",
  noodle: "Noodles",
  sandwich: "Sandwiches",
  ice_cream: "Ice Cream",
  regional: "Regional",
  international: "International",
};

const AMENITY_TAGS = [
  ["outdoor_seating", ["yes"], "Outdoor seating"],
  ["wheelchair", ["yes"], "Wheelchair accessible"],
  ["internet_access", ["wlan", "yes", "wifi"], "Wi-Fi"],
  ["air_conditioning", ["yes"], "Air conditioning"],
  ["takeaway", ["yes", "only"], "Takeaway"],
  ["delivery", ["yes"], "Delivery"],
  ["drive_through", ["yes"], "Drive-through"],
  ["reservation", ["yes", "required", "recommended"], "Accepts reservations"],
  ["diet:vegetarian", ["yes", "only"], "Vegetarian options"],
  ["diet:vegan", ["yes", "only"], "Vegan options"],
  ["diet:halal", ["yes", "only"], "Halal"],
];

const COMMONS_HOSTS = new Set(["upload.wikimedia.org", "commons.wikimedia.org"]);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{4,}$/;
const CUISINE_TOKEN = /^[a-z0-9_ -]{2,40}$/;

const titleCase = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function normalizeCuisine(raw) {
  if (typeof raw !== "string") return [];
  const labels = [];
  for (const part of raw.split(";")) {
    const token = part.trim().toLowerCase();
    if (!CUISINE_TOKEN.test(token)) continue;
    const key = token.replace(/\s+/g, "_");
    const label = CUISINE_LABELS[key] ?? titleCase(key.replace(/[_-]/g, " "));
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function normalizeWebsite(raw) {
  const text = cleanString(raw, 2048);
  if (!text) return null;
  const candidate = /^https?:\/\//i.test(text) ? text : /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(text) ? `https://${text}` : null;
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// Only Wikimedia Commons images are used: they are freely licensed. Other image links in
// OpenStreetMap may be copyrighted, so they are ignored rather than hot-linked.
export function normalizeImage(tags) {
  const commons = cleanString(tags.wikimedia_commons, 300);
  if (commons?.startsWith("File:")) {
    const file = encodeURIComponent(commons.slice(5).replace(/ /g, "_"));
    return { image: `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1000`, imageCredit: "Image from Wikimedia Commons" };
  }
  try {
    const url = new URL(tags.image ?? "");
    if (url.protocol === "https:" && COMMONS_HOSTS.has(url.hostname)) {
      return { image: url.toString(), imageCredit: "Image from Wikimedia Commons" };
    }
  } catch {
    // no usable image tag
  }
  return { image: null, imageCredit: null };
}

function normalizeAmenities(tags) {
  return AMENITY_TAGS.filter(([key, accepted]) => accepted.includes(String(tags[key]).toLowerCase())).map(
    ([, , label]) => label
  );
}

function buildAddress(tags, barangay) {
  const full = cleanString(tags["addr:full"], 255);
  if (full) return full;
  const street = [tags["addr:housenumber"], tags["addr:street"]].map((part) => cleanString(part, 100)).filter(Boolean).join(" ");
  const parts = [street, barangay].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function firstValue(...values) {
  for (const value of values) {
    const text = cleanString(typeof value === "string" ? value.split(";")[0] : value, 200);
    if (text) return text;
  }
  return null;
}

export function normalizeOsmElement(element, area, importedAt = new Date()) {
  const tags = element.tags ?? {};
  const name = cleanString(tags.name ?? tags["name:en"], 120);
  if (!name) return null;

  const point = element.type === "node" ? element : element.center;
  const latitude = typeof point?.lat === "number" ? point.lat : null;
  const longitude = typeof point?.lon === "number" ? point.lon : null;
  const barangay = cleanString(tags["addr:barangay"] ?? tags["addr:suburb"], 100);
  const phone = firstValue(tags.phone, tags["contact:phone"]);
  const email = firstValue(tags.email, tags["contact:email"]);

  return {
    externalPlaceId: `osm:${element.type}/${element.id}`,
    name,
    description: cleanString(tags.description ?? tags["description:en"], 2000),
    cuisine: normalizeCuisine(tags.cuisine),
    category: CATEGORY_LABELS[tags.amenity] ?? null,
    address: buildAddress(tags, barangay),
    barangay,
    // City and province come from the boundary the place was found inside, which is
    // authoritative, not from free-text address tags.
    city: area.city,
    province: area.province,
    latitude,
    longitude,
    phone: phone && PHONE_PATTERN.test(phone) ? phone : null,
    email: email && EMAIL_PATTERN.test(email) ? email.toLowerCase() : null,
    website: normalizeWebsite(tags.website ?? tags["contact:website"] ?? tags.url),
    ...normalizeImage(tags),
    openingHours: cleanString(tags.opening_hours, 500),
    priceRange: null,
    rating: null,
    reviewCount: null,
    amenities: normalizeAmenities(tags),
    source: {
      provider: "openstreetmap",
      url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      license: OSM_LICENSE,
      importedAt,
    },
  };
}
