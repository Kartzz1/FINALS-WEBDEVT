import { useEffect, useState } from "react";
import { api } from "../services/api.js";

// Used only until the server answers, and if it never does. The server
// enforces the real limits either way.
const FALLBACK = {
  MIN_DURATION_MINUTES: 30,
  MAX_DURATION_MINUTES: 240,
  DEFAULT_DURATION_MINUTES: 90,
  MAX_ADVANCE_DAYS: 60,
  MAX_GUESTS: 50,
};

let cached = null;

export function useBookingConfig() {
  const [config, setConfig] = useState(cached ?? FALLBACK);

  useEffect(() => {
    if (cached) return;
    api
      .get("/config")
      .then(({ booking }) => {
        cached = booking;
        setConfig(booking);
      })
      .catch(() => {});
  }, []);

  return config;
}
