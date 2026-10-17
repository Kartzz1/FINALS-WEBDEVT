// Display helpers for restaurant data. Pure functions, so they are easy to test.

export function formatLocation(restaurant) {
  return [restaurant.barangay, restaurant.city, restaurant.province].filter(Boolean).join(", ");
}

export function describeTables(summary) {
  if (!summary || summary.count === 0) return "Tables not set up for online booking yet";
  const { count, capacities } = summary;
  const seats =
    capacities.length > 1 ? `seats ${capacities[0]} to ${capacities[capacities.length - 1]}` : `seats ${capacities[0]}`;
  return `${count} ${count === 1 ? "table" : "tables"} · ${seats}`;
}

export function phoneLink(phone) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

const MAP_PADDING = { lat: 0.004, lon: 0.006 };

// An OpenStreetMap embed. It needs no API key, and OpenStreetMap asks that the credit stays visible.
export function mapEmbedUrl(latitude, longitude) {
  const bbox = [
    longitude - MAP_PADDING.lon,
    latitude - MAP_PADDING.lat,
    longitude + MAP_PADDING.lon,
    latitude + MAP_PADDING.lat,
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export const mapPageUrl = (latitude, longitude) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

export const directionsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

// ---- Opening hours ----
// OpenStreetMap stores hours as text such as "Mo-Fr 09:00-18:00; Sa 10:00-14:00". This turns
// the common, simple forms into rows. Anything more unusual returns null, and the page then
// shows the original text unchanged rather than guessing.
const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const DAY_NAMES = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun" };
const TIME_RANGE = "\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2}";
const RULE = new RegExp(
  `^(?:(?<days>(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\\s*[-,]\\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\\s+)?(?<times>${TIME_RANGE}(?:\\s*,\\s*${TIME_RANGE})*|off|closed)$`,
  "i"
);

function formatTime(text) {
  const [hours, minutes] = text.trim().split(":").map(Number);
  if (hours > 24 || minutes > 59) return null;
  const suffix = hours % 24 >= 12 ? "PM" : "AM";
  return `${hours % 12 === 0 ? 12 : hours % 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDays(days) {
  if (!days) return "Every day";
  const parts = days.split(",").map((part) => part.trim());
  const labels = parts.map((part) => {
    const [from, to] = part.split("-").map((day) => day.trim());
    if (!DAYS.includes(from) || (to && !DAYS.includes(to))) return null;
    if (from === "Mo" && to === "Su") return "Every day";
    return to ? `${DAY_NAMES[from]} to ${DAY_NAMES[to]}` : DAY_NAMES[from];
  });
  return labels.includes(null) ? null : labels.join(", ");
}

export function parseOpeningHours(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  if (text.trim() === "24/7") return [{ days: "Every day", hours: "Open 24 hours" }];
  const rows = [];
  for (const rule of text.split(";").map((part) => part.trim()).filter(Boolean)) {
    const match = RULE.exec(rule);
    if (!match) return null;
    const days = formatDays(match.groups.days);
    if (!days) return null;
    const times = match.groups.times.toLowerCase();
    if (times === "off" || times === "closed") {
      rows.push({ days, hours: "Closed" });
      continue;
    }
    const ranges = times.split(",").map((range) => {
      const [open, close] = range.split("-").map(formatTime);
      return open && close ? `${open} to ${close}` : null;
    });
    if (ranges.includes(null)) return null;
    rows.push({ days, hours: ranges.join(", ") });
  }
  return rows.length ? rows : null;
}
