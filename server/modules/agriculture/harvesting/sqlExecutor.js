import sql from "mssql";
import loadConfig from "../../../config/env.js";

const config = loadConfig();

let poolPromise = null;

// Builds the SQL Server connection configuration for harvesting reports.
function databaseConfig() {
  const database = config.harvestingDatabase;
  if (!database.server || !database.database || !database.user || !database.password) {
    throw Object.assign(new Error("Harvesting database credentials are not configured."), { statusCode: 503 });
  }
  return {
    server: database.server,
    database: database.database,
    user: database.user,
    password: database.password,
    connectionTimeout: database.connectionTimeout,
    requestTimeout: database.requestTimeout,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: database.encrypt,
      trustServerCertificate: database.trustServerCertificate,
    },
  };
}

// Returns a shared, lazily-created connection pool instead of opening a new
// TCP/TLS connection to the remote SQL Server on every request. Reusing the
// pool removes the handshake latency (and a source of intermittent 503s)
// from each report/filter call.
function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(databaseConfig());
    pool.on("error", (error) => {
      console.error("Harvesting database pool error:", error);
      poolPromise = null;
    });
    poolPromise = pool.connect().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

// Converts SQL Server values into JSON-safe response values.
function normalizeValue(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

// Classifies a raw driver/network/SQL error into an appropriate HTTP status
// code and message so callers (and the client) can tell the difference
// between "the database is unreachable" and "the query itself is wrong".
function classifyError(error) {
  if (error.statusCode) return error;

  const code = error.code || error.originalError?.code;
  const isConnectionIssue =
    code === "ETIMEOUT" ||
    code === "ESOCKET" ||
    code === "ECONNCLOSED" ||
    code === "ECONNREFUSED" ||
    code === "ELOGIN" ||
    /failed to connect/i.test(error.message || "");

  if (isConnectionIssue) {
    return Object.assign(
      new Error(`Harvesting database is unavailable right now: ${error.message}`),
      { statusCode: 503 },
    );
  }

  // Query/authoring errors (bad SQL, missing columns, etc.) are not the
  // database's fault, so they should surface as 500s with the real message
  // instead of being reported as "service unavailable".
  return Object.assign(
    new Error(`Harvesting report query failed: ${error.message}`),
    { statusCode: 500 },
  );
}

export async function executeHarvestingQuery(queryText, parameters = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();
    Object.entries(parameters).forEach(([name, value]) => {
      if (name.toLowerCase().includes("date") || name.toLowerCase().includes("month")) {
        request.input(name, sql.Date, value || null);
      } else {
        request.input(name, sql.VarChar(255), value || null);
      }
    });
    const result = await request.query(queryText);
    const rows = result.recordset.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
    ));
    return { columns: Object.keys(result.recordset[0] || {}), rows };
  } catch (error) {
    throw classifyError(error);
  }
}

export async function getHarvestingLocationRows(queryText) {
  return executeHarvestingQuery(queryText);
}
