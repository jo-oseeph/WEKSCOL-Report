import axios from "axios";


export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const client = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15000,
  // Session auth relies on an HttpOnly cookie; this must be enabled on every
  // request (and matched by the server's CORS "credentials" setting) for the
  // cookie to be sent/accepted across the Vercel <-> Render origin boundary.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Normalizes axios errors into plain Error objects with the server's message
// (when available) so every caller can just read `error.message`.
function unwrapError(error, fallbackMessage) {
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new Error("The request timed out. Please try again.");
  }
  if (!error.response) {
    return new Error(
      "Unable to reach the server. Please check your connection and try again.",
    );
  }
  return new Error(error.response.data?.error || fallbackMessage);
}

async function request(method, url, { data, params, fallbackMessage, timeout } = {}) {
  try {
    const response = await client.request({ method, url, data, params, timeout });
    return response.data;
  } catch (error) {
    throw unwrapError(
      error,
      fallbackMessage || "Unable to complete the request.",
    );
  }
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

export const auth = {
  getCurrentUser: () =>
    request("GET", "/auth/me", {
      fallbackMessage: "Unable to load your session.",
    }),
  register: (details) =>
    request("POST", "/auth/register", {
      data: details,
      fallbackMessage: "Unable to create your account.",
    }),
  login: (credentials) =>
    request("POST", "/auth/login", {
      data: credentials,
      fallbackMessage: "Unable to sign in.",
    }),
  logout: () =>
    request("POST", "/auth/logout", { fallbackMessage: "Unable to sign out." }),
  updateProfile: (details) =>
    request("PUT", "/auth/profile", {
      data: details,
      fallbackMessage: "Unable to update your profile.",
    }),
  changePassword: (details) =>
    request("PUT", "/auth/password", {
      data: details,
      fallbackMessage: "Unable to change your password.",
    }),
  requestPasswordReset: (email) =>
    request("POST", "/auth/forgot-password", {
      data: { email },
      fallbackMessage: "Unable to send the reset link.",
    }),
  resetPassword: (details) =>
    request("POST", "/auth/reset-password", {
      data: details,
      fallbackMessage: "Unable to reset your password.",
    }),
};

// ---------------------------------------------------------------------------
// Report endpoints
// ---------------------------------------------------------------------------

export const reports = {
  getCatalog: () =>
    request("GET", "/reports/catalog", {
      fallbackMessage: "Unable to load the report catalog.",
    }),
  getFilters: (params) =>
    request("GET", "/reports/filters", {
      params,
      // Filter dropdowns should fail fast when SQL Server is unavailable;
      // they must not leave the report screen waiting for two minutes.
      timeout: 30000,
      fallbackMessage: "Unable to load filters.",
    }),
  run: (reportId, params) =>
    request("GET", `/reports/${reportId}`, {
      params,
      // Report generation can legitimately take longer than the lightweight
      // filter requests. The backend database request timeout is the single
      // authoritative deadline; Axios must not create a second shorter one.
      timeout: 0,
      fallbackMessage: "Unable to generate report.",
    }),
  // Export downloads are a full browser navigation (not an XHR/axios call),
  // so they need an absolute URL to the backend in production -- a relative
  // "/api/..." URL would resolve against the frontend's own origin (Vercel)
  // instead of the backend (Render).
  getExportUrl: (reportId, format, params) => {
    const search = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/api/reports/${reportId}/export.${format}${search ? `?${search}` : ""}`;
  },
};

export default client;
