import sql from "mssql";
import loadConfig from "../../../config/env.js";

const config = loadConfig();

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
    options: {
      encrypt: database.encrypt,
      trustServerCertificate: database.trustServerCertificate,
    },
  };
}

// Converts SQL Server values into JSON-safe response values.
function normalizeValue(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function executeHarvestingQuery(queryText, parameters = {}) {
  let pool;
  try {
    pool = await sql.connect(databaseConfig());
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
    if (error.statusCode) throw error;
    throw Object.assign(new Error(`Harvesting database query failed: ${error.message}`), { statusCode: 503 });
  } finally {
    if (pool) await pool.close();
  }
}

export async function getHarvestingLocationRows(queryText) {
  return executeHarvestingQuery(queryText);
}