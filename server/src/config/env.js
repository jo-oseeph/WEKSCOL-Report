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
  const nodeEnvironment = process.env.NODE_ENV || "development";
  const clientUrls = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    nodeEnvironment,
    port: Number(process.env.PORT || 3001),
    databaseUrl: process.env.DATABASE_URL || "",
    databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED || "",
    parquetPath: process.env.PARQUET_REPORT_PATH || path.join(root, "reports", "parquet-etl", "data", "report_base.parquet"),
    qcParquetPath: process.env.PARQUET_QC_REPORT_PATH || path.join(root, "reports", "parquet-etl", "data", "fertilizer_issuance_validation.parquet"),
    clientUrls,
    clientUrl: clientUrls.find((url) => !url.includes("localhost")) || clientUrls[0],
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
  };
}