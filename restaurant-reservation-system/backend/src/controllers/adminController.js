import { getSyncAreas, getSyncStatus, startRestaurantSync } from "../services/restaurantImportService.js";
import { syncSchema } from "../validators/schemas.js";
import { validate } from "../validators/validate.js";

// POST /admin/restaurants/sync: starts an import in the background and answers at once (202).
export function startSync(req, res) {
  const options = validate(req.body, syncSchema);
  const run = startRestaurantSync({ areaKeys: options.areas, dryRun: options.dryRun === true });
  res.status(202).json({ run });
}

// GET /admin/restaurants/sync/status: progress of the current or most recent import.
export function syncStatus(req, res) {
  res.status(200).json({ run: getSyncStatus(), areas: getSyncAreas() });
}
