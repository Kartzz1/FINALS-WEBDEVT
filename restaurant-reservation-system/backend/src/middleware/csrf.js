import { CSRF_COOKIE, cookieOptions } from "../config/cookies.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { createCsrfToken, isGenuineCsrfToken, safeEqual } from "../utils/csrf.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "x-csrf-token";

// Every state-changing request must (1) come from our own origin when the
// browser says where it came from, and (2) carry a header token that matches
// the HttpOnly cookie and carries our signature. A forged cross-site request
// cannot read the token, so it cannot build the header.
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("origin");
  if (origin && origin !== env.clientUrl) {
    return next(new AppError(403, "Cross-site request blocked."));
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  const valid =
    Boolean(cookieToken) &&
    Boolean(headerToken) &&
    safeEqual(cookieToken, headerToken) &&
    isGenuineCsrfToken(cookieToken, env.jwtSecret);
  if (!valid) {
    return next(new AppError(403, "Invalid or missing CSRF token."));
  }
  return next();
}

// The token is returned in the body as well as the cookie, because a frontend
// on another domain cannot read the API's cookies but can read this response
// (CORS only allows our own origin to do so).
export function issueCsrfToken(req, res) {
  const token = createCsrfToken(env.jwtSecret);
  res.cookie(CSRF_COOKIE, token, cookieOptions);
  res.status(200).json({ csrfToken: token });
}
