import { OSM_AMENITIES } from "../../constants.js";
import { normalizeOsmElement } from "./osmNormalize.js";

// Reads restaurants from OpenStreetMap through the public Overpass API.
// Etiquette: one request at a time, a descriptive User-Agent, POST for long queries,
// and back off when the service answers "busy" (HTTP 429/503/504).

const BUSY_STATUSES = new Set([429, 503, 504]);
const DEFAULT_TIMEOUT_MS = 120000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 8000;
const QUERY_TIMEOUT_SECONDS = 90;

const quote = (text) => String(text).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Finds the city boundary inside the province, then every named food place inside it.
export function buildAreaQuery(area, amenities) {
  const safe = amenities.filter((value) => OSM_AMENITIES.includes(value));
  if (safe.length === 0) throw new Error("No valid amenity types were requested");
  return [
    `[out:json][timeout:${QUERY_TIMEOUT_SECONDS}];`,
    `area["boundary"="administrative"]["admin_level"="4"]["name"="${quote(area.province)}"]->.province;`,
    `rel(area.province)["boundary"="administrative"]["admin_level"="${Number(area.adminLevel)}"]["name"="${quote(area.osmName)}"];`,
    "map_to_area->.city;",
    `nwr["amenity"~"^(${safe.join("|")})$"]["name"](area.city);`,
    "out center;",
  ].join("\n");
}

// Used only when a query returns nothing, to tell "no restaurants" from "boundary not found".
export function buildBoundaryCheckQuery(area) {
  return [
    "[out:json][timeout:30];",
    `area["boundary"="administrative"]["admin_level"="4"]["name"="${quote(area.province)}"]->.province;`,
    `rel(area.province)["boundary"="administrative"]["admin_level"="${Number(area.adminLevel)}"]["name"="${quote(area.osmName)}"];`,
    "out ids;",
  ].join("\n");
}

export function createOsmProvider({
  endpoints,
  userAgent,
  amenities,
  fetchImpl = globalThis.fetch,
  sleep = defaultSleep,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}) {
  async function postQuery(query) {
    let lastError = null;
    for (const endpoint of endpoints) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
              "User-Agent": userAgent,
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (BUSY_STATUSES.has(response.status)) {
            lastError = new Error(`The OpenStreetMap server is busy (HTTP ${response.status})`);
            await sleep(retryDelayMs * (attempt + 1));
            continue;
          }
          if (response.status === 400) {
            const error = new Error("OpenStreetMap rejected the query (HTTP 400)");
            error.fatal = true;
            throw error;
          }
          if (!response.ok) {
            throw new Error(`OpenStreetMap returned HTTP ${response.status}`);
          }
          return await response.json();
        } catch (error) {
          if (error.fatal) throw error;
          lastError = error;
          await sleep(retryDelayMs);
        }
      }
    }
    throw lastError ?? new Error("The OpenStreetMap request failed");
  }

  return {
    name: "openstreetmap",

    async fetchArea(area) {
      const json = await postQuery(buildAreaQuery(area, amenities));
      const elements = json.elements ?? [];
      // Overpass reports runtime problems (such as a timeout) in "remark" with HTTP 200.
      if (json.remark && elements.length === 0) {
        throw new Error(`OpenStreetMap reported: ${json.remark}`);
      }
      if (elements.length === 0) {
        const check = await postQuery(buildBoundaryCheckQuery(area));
        if ((check.elements ?? []).length === 0) {
          throw new Error(`Could not find the OpenStreetMap boundary "${area.osmName}" inside ${area.province}`);
        }
      }

      const importedAt = new Date();
      const candidates = [];
      let skipped = 0;
      for (const element of elements) {
        const candidate = normalizeOsmElement(element, area, importedAt);
        if (candidate) candidates.push(candidate);
        else skipped += 1;
      }
      return { candidates, skipped, partial: Boolean(json.remark) };
    },
  };
}
