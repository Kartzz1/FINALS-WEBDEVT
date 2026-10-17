const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const pad = (number) => String(number).padStart(2, "0");

export function formatDateTime(iso) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso)
  );
}

// "2030-06-02T18:00" from a datetime-local input is local time; the API wants UTC.
export function localInputToUtcIso(value) {
  return new Date(value).toISOString();
}

export function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function utcIsoToLocalInput(iso) {
  return toLocalInput(new Date(iso));
}

export function localInputBounds(maxDays) {
  const now = new Date();
  return {
    min: toLocalInput(now),
    max: toLocalInput(new Date(now.getTime() + maxDays * DAY_MS)),
  };
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours && `${hours} h`, rest && `${rest} min`].filter(Boolean).join(" ");
}

export function durationOptions(min, max, step = 30) {
  const options = [];
  for (let value = min; value <= max; value += step) {
    options.push(value);
  }
  return options;
}
