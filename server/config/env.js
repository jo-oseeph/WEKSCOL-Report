import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.join(serverDirectory, "..", "..");

const envFilePath = path.join(projectDirectory, ".env");

if (typeof process.loadEnvFile === "function" && fs.existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

const loadConfig = () => {
  const nodeEnvironment = process.env.NODE_ENV || "development";

  return {
    nodeEnvironment,
    port: Number(process.env.PORT || 3001),
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
    },
    clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  };
};

export default loadConfig;