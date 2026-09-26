import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "..", "..", "..");

if (typeof process.loadEnvFile === "function") {
  for (const file of [path.join(root, ".env"), path.join(root, "server", ".env")]) {
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

export default function loadConfig() {
  return {
    port: Number(process.env.PORT || 3001),
    databaseUrl: process.env.DATABASE_URL || "",
    clientUrls: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((value) => value.trim()).filter(Boolean),
    warehouse: {
      server: process.env.REPORT_DB_SERVER || "",
      database: process.env.REPORT_DB_DATABASE || "",
      user: process.env.REPORT_DB_USER || "",
      password: process.env.REPORT_DB_PASSWORD || "",
      encrypt: process.env.REPORT_DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.REPORT_DB_TRUST_SERVER_CERTIFICATE === "true",
      connectionTimeout: Math.min(Number(process.env.REPORT_DB_CONNECTION_TIMEOUT || 30000), 180000),
      requestTimeout: Math.min(Number(process.env.REPORT_DB_REQUEST_TIMEOUT || 180000), 180000),
    },
    session: { cookieName: "wescol_session", maxAge: Number(process.env.SESSION_MAX_AGE || 604800000) },
  };
}