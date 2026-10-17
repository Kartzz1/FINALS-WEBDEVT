import { env } from "./env.js";

export const SESSION_COOKIE = "gather_session";
export const CSRF_COOKIE = "gather_csrf";

const HOUR_MS = 60 * 60 * 1000;

// HttpOnly keeps both cookies away from JavaScript, so an XSS bug cannot
// read the session. Secure is on in production, where HTTPS is expected.
const baseOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.cookieSameSite,
  path: "/",
};

export const cookieOptions = Object.freeze({
  ...baseOptions,
  maxAge: env.sessionTtlHours * HOUR_MS,
});

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOptions);
}

// Clearing must use the same path/sameSite/secure as setting, or browsers keep the cookie.
export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, baseOptions);
}
