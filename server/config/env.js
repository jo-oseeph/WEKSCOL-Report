import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// env.js lives at server/config/. Support both the repository-root .env and
// the server/.env location documented by the setup instructions. Loading the
// root file first preserves the existing project-level configuration, while
// the server file provides a fallback when the root .env does not exist.
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.join(configDirectory, "..");
const projectDirectory = path.join(serverDirectory, "..");

const envFilePaths = [
  path.join(projectDirectory, ".env"),
  path.join(serverDirectory, ".env"),
];

if (typeof process.loadEnvFile === "function") {
  for (const envFilePath of envFilePaths) {
    if (fs.existsSync(envFilePath)) {
      process.loadEnvFile(envFilePath);
    }
  }
}

const loadConfig = () => {
  const nodeEnvironment = process.env.NODE_ENV || "development";

  return {
    nodeEnvironment,
    port: Number(process.env.PORT || 3001),
    databaseUrl: process.env.DATABASE_URL || "",
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || "",
    databasePath: process.env.DATABASE_PATH
      ? path.resolve(projectDirectory, process.env.DATABASE_PATH)
      : path.join(projectDirectory, "data", "wescol.sqlite"),
    weighmentDataPath: process.env.WEIGHMENT_DATA_PATH
      ? path.resolve(projectDirectory, process.env.WEIGHMENT_DATA_PATH)
      : "",
    harvestingDatabase: {
      server: process.env.REPORT_DB_SERVER || "",
      database: process.env.REPORT_DB_DATABASE || "",
      user: process.env.REPORT_DB_USER || "",
      password: process.env.REPORT_DB_PASSWORD || "",
      driver: process.env.REPORT_DB_DRIVER || "ODBC Driver 17 for SQL Server",
      encrypt: process.env.REPORT_DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.REPORT_DB_TRUST_SERVER_CERTIFICATE === "true",
      connectionTimeout: Number(process.env.REPORT_DB_CONNECTION_TIMEOUT || 120000),
      requestTimeout: Number(process.env.REPORT_DB_REQUEST_TIMEOUT || 120000),
    },
    session: {
      cookieName: "wescol_session",
      maxAge: Number(process.env.SESSION_MAX_AGE || 604800000),
      secure: nodeEnvironment === "production",
    },
    email: {
      provider: "gmail",
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASSWORD || "",
      from: process.env.SMTP_FROM || process.env.SMTP_USER || "",
      fromName: process.env.SMTP_FROM_NAME || "WESCOL Reports",
      connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
      greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
      socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
    },
    // CLIENT_URL may list multiple allowed frontend origins as a comma
    // separated string (e.g. local dev + the deployed Vercel URL).
    // clientUrls is the full parsed list, used for CORS origin checks.
    // clientUrl is a single URL used to build links (e.g. password reset
    // emails); it prefers a non-localhost entry so links generated in
    // production point at the real deployed frontend even if a local dev
    // URL is also present in the list.
    ...(() => {
      const clientUrls = (process.env.CLIENT_URL || "http://localhost:5173")
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
      const clientUrl = clientUrls.find((url) => !url.includes("localhost")) || clientUrls[0];
      return { clientUrl, clientUrls };
    })(),
  };
};

export default loadConfig;