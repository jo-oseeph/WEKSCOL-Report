import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));

const envFilePath = path.join(serverDirectory, "..", ".env");

if (typeof process.loadEnvFile === "function" && fs.existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

const loadConfig = () => {
  const nodeEnvironment = process.env.NODE_ENV || "development";

  return {
    nodeEnvironment,
    port: Number(process.env.PORT || 3001),
    databasePath: process.env.DATABASE_PATH
      ? path.resolve(serverDirectory, "..", process.env.DATABASE_PATH)
      : path.join(serverDirectory, "..", "data", "wescol.sqlite"),
    session: {
      cookieName: "wescol_session",
      maxAge: Number(process.env.SESSION_MAX_AGE || 604800000),
      secure: nodeEnvironment === "production",
    },
  };
};

export default loadConfig;