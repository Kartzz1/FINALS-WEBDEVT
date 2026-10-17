import { AppError } from "../utils/AppError.js";

// Places the importer can load. Each one is a named boundary inside the province, so
// "Tanauan" or "Santo Tomas" can never be confused with towns of the same name elsewhere.
// OpenStreetMap's Philippine convention: province = admin_level 4, city/municipality = 6.
const PROVINCE = "Batangas";
const CITY_LEVEL = 6;

export const IMPORT_AREAS = Object.freeze({
  lipa: { key: "lipa", city: "Lipa City", osmName: "Lipa", province: PROVINCE, adminLevel: CITY_LEVEL },
  batangas: { key: "batangas", city: "Batangas City", osmName: "Batangas City", province: PROVINCE, adminLevel: CITY_LEVEL },
  tanauan: { key: "tanauan", city: "Tanauan City", osmName: "Tanauan", province: PROVINCE, adminLevel: CITY_LEVEL },
  malvar: { key: "malvar", city: "Malvar", osmName: "Malvar", province: PROVINCE, adminLevel: CITY_LEVEL },
  "santo-tomas": { key: "santo-tomas", city: "Santo Tomas", osmName: "Santo Tomas", province: PROVINCE, adminLevel: CITY_LEVEL },
});

// Lipa City and Batangas City come first, as the project prioritises them.
export const DEFAULT_AREA_KEYS = Object.freeze(["lipa", "batangas"]);

export const listAreas = () => Object.values(IMPORT_AREAS);

export function resolveAreas(keys) {
  const wanted = keys?.length ? keys : DEFAULT_AREA_KEYS;
  return wanted.map((key) => {
    const area = IMPORT_AREAS[String(key).toLowerCase()];
    if (!area) {
      throw new AppError(400, `Unknown import area "${key}". Available: ${Object.keys(IMPORT_AREAS).join(", ")}.`);
    }
    return area;
  });
}
