import { LIMITS } from "../constants.js";
import { AppError } from "../utils/AppError.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// Tabs and newlines are only allowed in multi-line fields such as notes.
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001F\u007F]/;
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_EMAIL_LOCAL_LENGTH = 64;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;
const DIGITS_PATTERN = /^\d{1,9}$/;
const DECIMAL_PATTERN = /^\d{1,3}(\.\d{1,6})?$/;
const SIGNED_DECIMAL_PATTERN = /^-?\d{1,3}(\.\d{1,10})?$/;
const MAX_TIMESTAMP_LENGTH = 30;
const UUID_LENGTH = 36;

function parseString(rule, raw) {
  if (typeof raw !== "string") {
    return { error: "Must be a string." };
  }
  const value = rule.trim === false ? raw : raw.trim();
  const minLength = rule.minLength ?? (rule.allowEmpty ? 0 : 1);
  if (value.length < minLength) {
    return {
      error: minLength === 1 ? "Must not be empty." : `Must be at least ${minLength} characters.`,
    };
  }
  if (rule.maxLength !== undefined && value.length > rule.maxLength) {
    return { error: `Must be at most ${rule.maxLength} characters.` };
  }
  if (!rule.allowControl) {
    const forbidden = rule.multiline ? MULTI_LINE_FORBIDDEN : SINGLE_LINE_FORBIDDEN;
    if (forbidden.test(value)) {
      return { error: "Contains characters that are not allowed." };
    }
  }
  if (rule.pattern && !rule.pattern.test(value)) {
    return { error: rule.patternMessage ?? "Has an invalid format." };
  }
  if (rule.strong && !(/\p{L}/u.test(value) && /\d/.test(value))) {
    return { error: "Must include at least one letter and one number." };
  }
  return { value };
}

function parseEmail(raw) {
  const result = parseString({ maxLength: LIMITS.EMAIL_MAX }, raw);
  if (result.error) {
    return result;
  }
  const localPart = result.value.split("@")[0];
  if (
    !EMAIL_PATTERN.test(result.value) ||
    result.value.includes("..") ||
    localPart.length > MAX_EMAIL_LOCAL_LENGTH
  ) {
    return { error: "Must be a valid email address." };
  }
  return { value: result.value.toLowerCase() };
}

function parseUuid(raw) {
  const result = parseString({ maxLength: UUID_LENGTH }, raw);
  if (result.error) {
    return result;
  }
  if (!UUID_PATTERN.test(result.value)) {
    return { error: "Must be a valid UUID." };
  }
  return { value: result.value.toLowerCase() };
}

// Accepts UTC ISO timestamps only, e.g. 2030-06-02T18:00:00Z.
function parseTimestamp(raw) {
  const result = parseString({ maxLength: MAX_TIMESTAMP_LENGTH }, raw);
  if (result.error) {
    return result;
  }
  const date = new Date(result.value);
  const isRealDate =
    UTC_TIMESTAMP_PATTERN.test(result.value) &&
    !Number.isNaN(date.getTime()) &&
    // Catches impossible dates such as February 31, which some parsers roll over.
    date.toISOString().slice(0, 10) === result.value.slice(0, 10);
  return isRealDate ? { value: date } : { error: "Must be a valid UTC timestamp like 2030-06-02T18:00:00Z." };
}

function parseInteger(rule, raw, coerce) {
  const candidate =
    coerce && typeof raw === "string" && DIGITS_PATTERN.test(raw) ? Number(raw) : raw;
  if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
    return { error: "Must be a whole number." };
  }
  if (rule.min !== undefined && candidate < rule.min) {
    return { error: `Must be at least ${rule.min}.` };
  }
  if (rule.max !== undefined && candidate > rule.max) {
    return { error: `Must be at most ${rule.max}.` };
  }
  return { value: candidate };
}

function parseNumber(rule, raw, coerce) {
  const isText = coerce && typeof raw === "string" && (rule.min < 0 ? SIGNED_DECIMAL_PATTERN : DECIMAL_PATTERN).test(raw);
  const candidate = isText ? Number(raw) : raw;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
    return { error: "Must be a number." };
  }
  if (rule.min !== undefined && candidate < rule.min) {
    return { error: `Must be at least ${rule.min}.` };
  }
  if (rule.max !== undefined && candidate > rule.max) {
    return { error: `Must be at most ${rule.max}.` };
  }
  return { value: candidate };
}

// Web addresses must use http or https, so "javascript:" and similar can never be stored.
function parseUrl(raw) {
  const result = parseString({ maxLength: LIMITS.URL_MAX }, raw);
  if (result.error) {
    return result;
  }
  let url;
  try {
    url = new URL(result.value);
  } catch {
    return { error: "Must be a valid web address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Must start with http:// or https://." };
  }
  return { value: url.toString() };
}

function parseArray(rule, raw, coerce) {
  if (!Array.isArray(raw)) {
    return { error: "Must be a list." };
  }
  if (rule.maxItems !== undefined && raw.length > rule.maxItems) {
    return { error: `Must have at most ${rule.maxItems} items.` };
  }
  const values = [];
  const seen = new Set();
  for (const item of raw) {
    const result = parseField(rule.items, item, coerce);
    if (result.error) {
      return { error: `Invalid item: ${result.error}` };
    }
    const key = String(result.value).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      values.push(result.value);
    }
  }
  return { value: values };
}

function parseBoolean(raw, coerce) {
  if (coerce && raw === "true") return { value: true };
  if (coerce && raw === "false") return { value: false };
  return typeof raw === "boolean" ? { value: raw } : { error: "Must be true or false." };
}

function parseEnum(rule, raw) {
  return typeof raw === "string" && rule.values.includes(raw)
    ? { value: raw }
    : { error: `Must be one of: ${rule.values.join(", ")}.` };
}

function parseField(rule, raw, coerce) {
  switch (rule.type) {
    case "string":
      return parseString(rule, raw);
    case "email":
      return parseEmail(raw);
    case "uuid":
      return parseUuid(raw);
    case "timestamp":
      return parseTimestamp(raw);
    case "integer":
      return parseInteger(rule, raw, coerce);
    case "boolean":
      return parseBoolean(raw, coerce);
    case "number":
      return parseNumber(rule, raw, coerce);
    case "url":
      return parseUrl(raw);
    case "array":
      return parseArray(rule, raw, coerce);
    case "enum":
      return parseEnum(rule, raw);
    default:
      throw new Error(`Unknown validation rule type: ${rule.type}`);
  }
}

// Returns a new object holding only validated, known fields. Unknown fields
// are rejected rather than ignored, so values like "role" cannot be smuggled in.
//   partial: every field optional, but at least one must be present (PATCH)
//   coerce:  accept numbers/booleans sent as text (query strings)
export function validate(input, schema, { partial = false, coerce = false } = {}) {
  const source = input ?? {};
  if (typeof source !== "object" || Array.isArray(source)) {
    throw new AppError(400, "Request body must be a JSON object.");
  }

  const errors = [];
  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(schema, key)) {
      errors.push({ field: key, message: "Unknown field." });
    }
  }

  const cleaned = {};
  for (const [name, rule] of Object.entries(schema)) {
    const raw = Object.hasOwn(source, name) ? source[name] : undefined;
    if (raw === undefined) {
      if (rule.required && !partial) {
        errors.push({ field: name, message: "Is required." });
      }
      continue;
    }
    if (raw === null && rule.nullable) {
      cleaned[name] = null;
      continue;
    }
    const result = parseField(rule, raw, coerce);
    if (result.error) {
      errors.push({ field: name, message: result.error });
    } else {
      cleaned[name] = result.value;
    }
  }

  if (errors.length === 0 && partial && Object.keys(cleaned).length === 0) {
    errors.push({ field: "body", message: "At least one field is required." });
  }
  if (errors.length > 0) {
    throw new AppError(400, "Validation failed.", errors);
  }
  return cleaned;
}

export function parseId(value) {
  return validate({ id: value }, { id: { type: "uuid", required: true } }).id;
}
