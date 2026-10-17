import { clock } from "./clock.js";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10000;

// key -> { count, firstAt }. Held in memory, so it resets when the server restarts
// and is per server process; the IP-based rate limiter is the other layer.
const failures = new Map();

const keyOf = (key) => String(key).trim().toLowerCase();

function currentEntry(key) {
  const entry = failures.get(key);
  if (entry && clock.now().getTime() - entry.firstAt >= WINDOW_MS) {
    failures.delete(key);
    return undefined;
  }
  return entry;
}

// Seconds the caller must still wait, or 0 when attempts are allowed.
export function retryAfterSeconds(rawKey) {
  const entry = currentEntry(keyOf(rawKey));
  if (!entry || entry.count < MAX_FAILURES) {
    return 0;
  }
  return Math.ceil((WINDOW_MS - (clock.now().getTime() - entry.firstAt)) / 1000);
}

export function recordFailure(rawKey) {
  const key = keyOf(rawKey);
  const entry = currentEntry(key);
  if (entry) {
    entry.count += 1;
    return;
  }
  if (failures.size >= MAX_TRACKED_KEYS) {
    failures.delete(failures.keys().next().value);
  }
  failures.set(key, { count: 1, firstAt: clock.now().getTime() });
}

export function clearFailures(rawKey) {
  failures.delete(keyOf(rawKey));
}

export function resetThrottle() {
  failures.clear();
}
