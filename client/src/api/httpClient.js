import axios from "axios";

// In local development the frontend and backend run on different ports, so
// requests go through Vite's dev-server proxy (see vite.config.js) using
// relative URLs. In production the frontend (Vercel) and backend (Render)
// are on entirely different origins, so relative "/api/..." URLs resolve
// against the Vercel domain itself and 404. VITE_API_URL must be set (in the
// Vercel project's environment variables) to the deployed backend's origin,
// e.g. "https://wescol-report-api.onrender.com". When it is not set, the
// baseURL falls back to "" so local/dev-proxy behavior is unchanged.
const baseURL = import.meta.env.VITE_API_URL || "";

const httpClient = axios.create({
  baseURL: `${baseURL}/api`,
  // Session auth relies on an HttpOnly cookie; this must be enabled on every
  // request (and matched by the server's CORS "credentials" setting) for the
  // cookie to be sent/accepted across the Vercel <-> Render origin boundary.
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default httpClient;
