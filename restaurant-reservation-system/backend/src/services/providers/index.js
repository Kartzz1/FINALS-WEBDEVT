import { AppError } from "../../utils/AppError.js";
import { createOsmProvider } from "./osmOverpass.js";

// One place that turns configuration into a data provider. Other providers (for example a
// commercial places API) can be added here; they would read config.key on the server only.
export function createProvider(config) {
  if (config.provider === "osm") {
    const endpoints = [config.url, config.fallbackUrl].filter(Boolean);
    return createOsmProvider({ endpoints, userAgent: config.userAgent, amenities: config.amenities });
  }
  throw new AppError(500, `Unsupported restaurant provider "${config.provider}". Supported: osm.`);
}
