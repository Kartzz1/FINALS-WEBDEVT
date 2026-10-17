import { SESSION_COOKIE } from "../config/cookies.js";
import { authenticate } from "../services/authService.js";
import { AppError } from "../utils/AppError.js";
import { readSessionToken } from "../utils/tokens.js";

// Verifies the token signature and expiry, then the server-side session, then
// loads the user fresh from the database. The role never comes from the token.
export async function requireAuth(req, res, next) {
  try {
    const claims = readSessionToken(req.cookies?.[SESSION_COOKIE]);
    const user = claims ? await authenticate(claims) : null;
    if (!user) {
      throw new AppError(401, "Authentication required.");
    }
    req.user = user;
    req.sessionId = claims.sessionId;
    next();
  } catch (err) {
    next(err);
  }
}

// For public pages that show a little more to administrators. A missing or bad session
// simply means "guest"; it never blocks the request.
export async function optionalAuth(req, res, next) {
  try {
    const claims = readSessionToken(req.cookies?.[SESSION_COOKIE]);
    const user = claims ? await authenticate(claims) : null;
    if (user) {
      req.user = user;
      req.sessionId = claims.sessionId;
    }
  } catch {
    // treated as a guest
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError(403, "You do not have permission to perform this action."));
    }
    return next();
  };
}
