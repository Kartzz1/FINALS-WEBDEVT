import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const WINDOW_MS = 15 * 60 * 1000;
const API_LIMIT = 300;
const AUTH_LIMIT = 10;

function createLimiter(limit, message, windowMs = WINDOW_MS) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Automated tests make many requests from one address.
    skip: () => env.nodeEnv === "test",
    handler: (req, res) => res.status(429).json({ success: false, message }),
  });
}

export const apiLimiter = createLimiter(
  API_LIMIT,
  "Too many requests. Please try again later."
);
export const authLimiter = createLimiter(
  AUTH_LIMIT,
  "Too many attempts. Please try again later."
);

// Imports call a shared public service, so they are limited to a few per hour.
const HOUR_MS = 60 * 60 * 1000;
const SYNC_LIMIT = 6;
export const syncLimiter = createLimiter(
  SYNC_LIMIT,
  "Too many import requests. Please wait before starting another.",
  HOUR_MS
);
