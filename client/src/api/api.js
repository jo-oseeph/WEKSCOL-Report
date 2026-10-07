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

async function requestFile(url, { params, fallbackMessage } = {}) {
  try {
    return await client.get(url, {
      params,
      responseType: "blob",
      // Export generation can legitimately take longer than normal API calls.
      // The server owns the report/database timeout for this request.
      timeout: 0,
    });
  } catch (error) {
    let message = fallbackMessage || "Unable to download the export.";
    const responseData = error.response?.data;
    if (responseData instanceof Blob) {
      try {
        const payload = JSON.parse(await responseData.text());
        message = payload.error || message;
      } catch {
        // Keep the safe fallback when the server returned a non-JSON error page.
      }
    } else if (responseData?.error) {
      message = responseData.error;
    }
    throw new Error(message);
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

export const admin = {
  getUsers: () =>
    request("GET", "/admin/users", {
      fallbackMessage: "Unable to load users.",
    }),
  getReports: () =>
    request("GET", "/admin/reports", {
      fallbackMessage: "Unable to load reports.",
    }),
  getUserPermissions: (userId) =>
    request("GET", `/admin/users/${userId}/permissions`, {
      fallbackMessage: "Unable to load report permissions.",
    }),
  updateUserStatus: (userId, status) =>
    request("PATCH", `/admin/users/${userId}/status`, {
      data: { status },
      fallbackMessage: "Unable to update account status.",
    }),
  updateUserPermissions: (userId, reportIds) =>
    request("PUT", `/admin/users/${userId}/permissions`, {
      data: { reportIds },
      fallbackMessage: "Unable to save report permissions.",
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
  getFilters: (reportId, params) =>
    request("GET", `/reports/${reportId}/filters`, {
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
  // Retained for callers that need to construct a direct export URL. The
  // report viewer uses download() below so it can show progress and errors.
  getExportUrl: (reportId, format, params) => {
    const search = new URLSearchParams(params).toString();
    return `${API_BASE_URL}/api/reports/${reportId}/export.${format}${search ? `?${search}` : ""}`;
  },
  download: (reportId, format, params) =>
    requestFile(`/reports/${reportId}/export.${format}`, {
      params,
      fallbackMessage: `Unable to download the ${format.toUpperCase()} export.`,
    }),
};

export default client;
