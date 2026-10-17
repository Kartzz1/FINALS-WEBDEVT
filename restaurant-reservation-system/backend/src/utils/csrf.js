import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const NONCE_BYTES = 32;
const CONTEXT = "gather-csrf:";

function sign(nonce, secret) {
  return createHmac("sha256", secret).update(CONTEXT + nonce).digest("hex");
}

export function safeEqual(a, b) {
  const first = Buffer.from(String(a));
  const second = Buffer.from(String(b));
  return first.length === second.length && timingSafeEqual(first, second);
}

// A token is "<random>.<signature>". The signature proves the server issued
// it, so an attacker who can plant a cookie still cannot forge a valid pair.
export function createCsrfToken(secret) {
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  return `${nonce}.${sign(nonce, secret)}`;
}

export function isGenuineCsrfToken(token, secret) {
  if (typeof token !== "string") {
    return false;
  }
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }
  return safeEqual(parts[1], sign(parts[0], secret));
}
