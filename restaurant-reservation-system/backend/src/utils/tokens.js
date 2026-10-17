import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ALGORITHM = "HS256";
const HOUR_SECONDS = 60 * 60;

// The token holds only the user id (sub) and session id (sid). Role and
// everything else is read from the database on each request.
export function signSessionToken({ userId, sessionId }) {
  return jwt.sign({ sid: sessionId }, env.jwtSecret, {
    algorithm: ALGORITHM,
    subject: userId,
    expiresIn: env.sessionTtlHours * HOUR_SECONDS,
  });
}

// Returns null for anything wrong: bad signature, expired, wrong algorithm, malformed.
export function readSessionToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] });
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}
