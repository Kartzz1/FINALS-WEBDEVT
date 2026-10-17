import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL ?? ""}/api`;
const REQUEST_TIMEOUT_MS = 30000;

// Every request goes through this one Axios instance, so cookies, the CSRF token,
// and error handling behave the same everywhere. No secret is ever used in the browser.
const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

let csrfToken = null;
let onUnauthorized = () => {};

// The auth context registers a callback so an expired session logs the user out of the UI.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(status, message, fieldErrors = []) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// Turns any Axios failure into one ApiError. Status 0 means the server never answered.
function toApiError(error) {
  if (error instanceof ApiError) return error;
  if (!error.response) {
    return new ApiError(0, "Unable to reach the server. Check your connection and that the backend is running.");
  }
  const { status, data } = error.response;
  const fallback =
    status >= 500
      ? "The server is not responding correctly. Make sure the backend is running, then try again."
      : "Something went wrong.";
  return new ApiError(status, typeof data?.message === "string" ? data.message : fallback, data?.errors);
}

// The token lives in memory only. The matching copy is an HttpOnly cookie the
// browser sends automatically, and the server requires both to agree.
async function getCsrfToken() {
  if (!csrfToken) {
    try {
      const { data } = await client.get("/auth/csrf");
      csrfToken = data.csrfToken;
    } catch (error) {
      throw toApiError(error);
    }
  }
  return csrfToken;
}

function cleanParams(query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function request(method, path, { body, query } = {}, retried = false) {
  const headers = {};
  if (method !== "get") {
    headers["X-CSRF-Token"] = await getCsrfToken();
  }

  try {
    const response = await client.request({ method, url: path, data: body, params: cleanParams(query), headers });
    return response.status === 204 ? null : response.data;
  } catch (error) {
    const apiError = toApiError(error);
    // The CSRF cookie can expire while the page stays open: fetch a fresh token once.
    if (apiError.status === 403 && !retried && /csrf/i.test(apiError.message)) {
      csrfToken = null;
      return request(method, path, { body, query }, true);
    }
    if (apiError.status === 401 && path !== "/auth/me" && path !== "/auth/login") {
      onUnauthorized();
    }
    throw apiError;
  }
}

export const api = {
  get: (path, query) => request("get", path, { query }),
  post: (path, body) => request("post", path, { body }),
  put: (path, body) => request("put", path, { body }),
  patch: (path, body) => request("patch", path, { body }),
  delete: (path) => request("delete", path),
};
