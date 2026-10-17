import fs from "node:fs/promises";
import duckdb from "duckdb";
import loadConfig from "../../config/env.js";
import { resolveParquetFile } from "./githubParquetSource.js";

let database;
let connection;

// Return a local, current copy of the configured Parquet file and fail clearly when it is unavailable.
async function getParquetPath(dataset = "base") {
  const config = loadConfig();
  const configuredPath =
    dataset === "qc"
      ? config.qcParquetPath
      : dataset === "fully-billed"
        ? config.fullyBilledParquetPath
        : dataset === "field-wise"
          ? config.fieldWiseParquetPath
          : dataset === "month-wise"
            ? config.monthWiseParquetPath
            : dataset === "total-supply"
              ? config.totalSupplyParquetPath
              : dataset === "partially-billed"
                ? config.partiallyBilledParquetPath
                : dataset === "over-billed"
                  ? config.overBilledParquetPath
                  : dataset === "not-billed"
                    ? config.notBilledParquetPath
        : config.parquetPath;
  const parquetPath = await resolveParquetFile(configuredPath);
  try {
    await fs.access(parquetPath);
  } catch {
    throw Object.assign(
      new Error(`Parquet report data was not found at ${parquetPath}.`),
      {
        statusCode: 503,
      },
    );
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
  const tokens = new Set(
    parameters.filter(
      (value) => typeof value === "string" && value.startsWith("__"),
    ),
  );
  const paths = new Map();
  if (tokens.has("__PARQUET_PATH__"))
    paths.set("__PARQUET_PATH__", await getParquetPath("base"));
  if (tokens.has("__QC_PARQUET_PATH__"))
    paths.set("__QC_PARQUET_PATH__", await getParquetPath("qc"));
  if (tokens.has("__FULLY_BILLED_PARQUET_PATH__"))
    paths.set(
      "__FULLY_BILLED_PARQUET_PATH__",
      await getParquetPath("fully-billed"),
    );
  if (tokens.has("__FIELD_WISE_PARQUET_PATH__"))
    paths.set("__FIELD_WISE_PARQUET_PATH__", await getParquetPath("field-wise"));
  if (tokens.has("__MONTH_WISE_PARQUET_PATH__"))
    paths.set("__MONTH_WISE_PARQUET_PATH__", await getParquetPath("month-wise"));
  if (tokens.has("__TOTAL_SUPPLY_PARQUET_PATH__"))
    paths.set("__TOTAL_SUPPLY_PARQUET_PATH__", await getParquetPath("total-supply"));
  if (tokens.has("__PARTIALLY_BILLED_PARQUET_PATH__"))
    paths.set("__PARTIALLY_BILLED_PARQUET_PATH__", await getParquetPath("partially-billed"));
  if (tokens.has("__OVER_BILLED_PARQUET_PATH__"))
    paths.set("__OVER_BILLED_PARQUET_PATH__", await getParquetPath("over-billed"));
  if (tokens.has("__NOT_BILLED_PARQUET_PATH__"))
    paths.set("__NOT_BILLED_PARQUET_PATH__", await getParquetPath("not-billed"));
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
