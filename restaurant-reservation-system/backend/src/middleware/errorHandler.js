import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const DATABASE_ERROR_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongooseServerSelectionError",
]);

function isDatabaseDown(err) {
  return DATABASE_ERROR_NAMES.has(err.name) || /buffering timed out/i.test(err.message ?? "");
}

export function notFound(req, res) {
  res.status(404).json({ success: false, message: "Resource not found." });
}

// Express recognises error handlers by their four-argument signature.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large." });
  }
  if (err instanceof AppError) {
    const body = { success: false, message: err.message };
    if (err.details) {
      body.errors = err.details;
    }
    return res.status(err.status).json(body);
  }

  if (isDatabaseDown(err)) {
    console.error("Database unavailable:", err.message);
    return res.status(503).json({ success: false, message: "The database is temporarily unavailable. Please try again shortly." });
  }

  // Full details stay in the server log, and only in development.
  console.error(env.isProduction ? err.message : err);
  return res.status(500).json({ success: false, message: "Unable to process the request." });
}
