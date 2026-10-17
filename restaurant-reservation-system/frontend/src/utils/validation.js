// Mirrors the server's rules so people get instant, specific feedback. This is
// for convenience only: the server checks everything again and is the real gate.
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\p{N} .'’-]*$/u;
const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} #._:/-]*$/u;
const CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EMAIL_LOCAL_LENGTH = 64;

export const LIMITS = {
  NAME_MAX: 100,
  EMAIL_MAX: 254,
  RESTAURANT_NAME_MAX: 120,
  ADDRESS_MAX: 255,
  LABEL_MAX: 50,
  CAPACITY_MAX: 50,
  NOTES_MAX: 500,
  PASSWORD_MAX: 128,
};

export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (value) => value.length >= 8 },
  { id: "letter", label: "At least one letter", test: (value) => /\p{L}/u.test(value) },
  { id: "number", label: "At least one number", test: (value) => /\d/.test(value) },
];

export function validateEmail(raw) {
  const value = raw.trim();
  if (!value) return "Enter your email address.";
  const localPart = value.split("@")[0];
  if (
    value.length > LIMITS.EMAIL_MAX ||
    localPart.length > MAX_EMAIL_LOCAL_LENGTH ||
    value.includes("..") ||
    !EMAIL_PATTERN.test(value)
  ) {
    return "Enter a valid email address, like name@example.com.";
  }
  return "";
}

export function validateName(raw) {
  const value = raw.trim();
  if (!value) return "Enter a name.";
  if (value.length < 2) return "The name must be at least 2 characters.";
  if (value.length > LIMITS.NAME_MAX) return `The name must be at most ${LIMITS.NAME_MAX} characters.`;
  if (!NAME_PATTERN.test(value)) return "Use letters, spaces, apostrophes, hyphens, and periods only.";
  return "";
}

export function validateNewPassword(value) {
  if (!value) return "Enter a password.";
  if (value.length > LIMITS.PASSWORD_MAX) return `The password must be at most ${LIMITS.PASSWORD_MAX} characters.`;
  const failed = PASSWORD_RULES.find((rule) => !rule.test(value));
  return failed ? `The password needs: ${failed.label.toLowerCase()}.` : "";
}

export function validateConfirm(password, confirm) {
  return password === confirm ? "" : "The passwords do not match.";
}

export function validateText(label, raw, max) {
  const value = raw.trim();
  if (!value) return `Enter ${label}.`;
  if (value.length > max) return `Use at most ${max} characters.`;
  if (CONTROL_PATTERN.test(value)) return "Contains characters that are not allowed.";
  return "";
}

export function validateLabel(raw) {
  const value = raw.trim();
  if (!value) return "Enter a table label.";
  if (value.length > LIMITS.LABEL_MAX) return `Use at most ${LIMITS.LABEL_MAX} characters.`;
  if (!LABEL_PATTERN.test(value)) return "Use letters, numbers, spaces, and # . _ : / - only.";
  return "";
}

export function validateWholeNumber(label, raw, min, max) {
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return `${label} must be a whole number.`;
  const number = Number(text);
  if (number < min || number > max) return `${label} must be between ${min} and ${max}.`;
  return "";
}

export function validateWhen(raw, maxDays) {
  if (!raw) return "Choose a date and time.";
  const time = new Date(raw).getTime();
  if (Number.isNaN(time)) return "Enter a valid date and time.";
  const now = Date.now();
  if (time <= now) return "Choose a time in the future.";
  if (time - now > maxDays * DAY_MS) return `Reservations can be made up to ${maxDays} days ahead.`;
  return "";
}

// Drops empty messages so `Object.keys(result).length` tells whether anything is wrong.
export function compact(errors) {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}
