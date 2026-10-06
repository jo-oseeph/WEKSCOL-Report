import fs from "node:fs/promises";
import duckdb from "duckdb";
import loadConfig from "../../config/env.js";

let database;
let connection;

// Return the configured Parquet file path and fail clearly when the file is unavailable.
async function getParquetPath(dataset = "base") {
  const config = loadConfig();
  const parquetPath = dataset === "qc" ? config.qcParquetPath : config.parquetPath;
  try {
    await fs.access(parquetPath);
  } catch {
    throw Object.assign(new Error(`Parquet report data was not found at ${parquetPath}.`), {
      statusCode: 503,
    });
  }
  return parquetPath;
}

// Lazily create one in-memory DuckDB database and reuse its connection for report reads.
function getConnection() {
  if (!connection) {
    database = new duckdb.Database(":memory:");
    connection = database.connect();
  }
  return connection;
}

// Execute a parameterized DuckDB query and return its rows to the report engine.
export async function executeParquetQuery(query, parameters = []) {
  const tokens = new Set(parameters.filter((value) => typeof value === "string" && value.startsWith("__")));
  const paths = new Map();
  if (tokens.has("__PARQUET_PATH__")) paths.set("__PARQUET_PATH__", await getParquetPath("base"));
  if (tokens.has("__QC_PARQUET_PATH__")) paths.set("__QC_PARQUET_PATH__", await getParquetPath("qc"));
  const values = parameters.map((value) => paths.get(value) || value);

  return new Promise((resolve, reject) => {
    getConnection().all(query, ...values, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

// Close the DuckDB resources when the Node process is shutting down.
export function closeParquetDatabase() {
  if (connection) connection.close();
  if (database) database.close();
  connection = undefined;
  database = undefined;
}