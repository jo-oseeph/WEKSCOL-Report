import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import duckdb from "duckdb";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(
  moduleDirectory,
  "../../../../reports/DIGICANE GLOBAL INVESTMENT DASHBOARD (13-29-54)(BI QUERY).csv",
);

// Creates a standardized error with an HTTP status code, matching the
// pattern already used by the harvesting notebook loader/executor.
function createError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function escapedCsvPath() {
  return csvPath.replace(/'/g, "''");
}

// Runs a DuckDB query against an in-memory database, closing it afterward.
function withDuckDb(callback) {
  return new Promise((resolve, reject) => {
    const database = new duckdb.Database(":memory:");
    const connection = database.connect();
    const finish = (error, result) => {
      connection.close();
      database.close();
      if (error) reject(error);
      else resolve(result);
    };
    callback(connection)
      .then((result) => finish(null, result))
      .catch((error) => finish(error));
  });
}

function runQuery(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

// The 3-year-overdue cutoff and $10,000 "big investment" threshold, matching
// the notebook's Python logic exactly (cell 44):
//   Record_Overdue = Posting_Date < (today - 3 years) AND Clearing is blank
//   Overdue_And_Big = Record_Overdue AND Amount > 10000
const OVERDUE_YEARS = 3;
const OVERDUE_AMOUNT_THRESHOLD = 10000;

// Reads the raw Investment Dashboard CSV (via DuckDB, so the ~48MB file is
// streamed and aggregated in SQL rather than loaded row-by-row into JS) and
// rolls it up to one row per farmer, mirroring the notebook's pandas
// groupby exactly: Total_Investment, CIR_Pending, Overdue_Amount,
// Investment_Flag ("Overdue"/"Not Overdue"), CC_Remarks.
async function loadFarmerInvestmentSummary() {
  if (!fs.existsSync(csvPath)) {
    throw createError(
      "The Investment Dashboard data file was not found on the server.",
      503,
    );
  }

  return withDuckDb((connection) => runQuery(connection, `
    WITH raw AS (
      SELECT
        column00 AS vendor,
        column01 AS farmer_name,
        column12 AS posting_date_raw,
        column10 AS clearing_raw,
        column18 AS amount_raw
      FROM read_csv(
        '${escapedCsvPath()}',
        header = false,
        skip = 1,
        all_varchar = true,
        ignore_errors = true
      )
    ),
    parsed AS (
      SELECT
        -- The farmer ID is the digits embedded in the Vendor code (e.g. "I  5638972" -> "5638972").
        TRIM(regexp_extract(vendor, '(\\d+)')) AS id_number,
        farmer_name,
        TRY_CAST(try_strptime(posting_date_raw, '%d.%m.%Y') AS DATE) AS posting_date,
        TRY_CAST(try_strptime(clearing_raw, '%d.%m.%Y') AS DATE) AS clearing_date,
        TRY_CAST(
          REPLACE(REPLACE(REPLACE(TRIM(amount_raw), ',', ''), '(', '-'), ')', '')
          AS DOUBLE
        ) AS amount
      FROM raw
    ),
    flagged AS (
      SELECT
        id_number,
        farmer_name,
        amount,
        (posting_date < CURRENT_DATE - INTERVAL '${OVERDUE_YEARS} years' AND clearing_date IS NULL) AS is_overdue_record,
        CASE WHEN clearing_date IS NULL THEN amount ELSE 0 END AS cir_pending_amount
      FROM parsed
      WHERE id_number IS NOT NULL AND id_number <> ''
    )
    SELECT
      id_number AS "ID_Number",
      ANY_VALUE(farmer_name) AS "Farmer_Name",
      SUM(amount) AS "Total_Investment",
      SUM(cir_pending_amount) AS "CIR_Pending",
      SUM(CASE WHEN is_overdue_record THEN amount ELSE 0 END) AS "Overdue_Amount",
      CASE WHEN BOOL_OR(is_overdue_record AND amount > ${OVERDUE_AMOUNT_THRESHOLD}) THEN 'Overdue' ELSE 'Not Overdue' END AS "Investment_Flag",
      CASE WHEN BOOL_OR(is_overdue_record AND amount > ${OVERDUE_AMOUNT_THRESHOLD}) THEN 'Don''t Issue' ELSE 'Issue with Precaution' END AS "CC_Remarks"
    FROM flagged
    GROUP BY id_number
  `));
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let cache = null;
let cacheExpiresAt = 0;
let cacheInFlight = null;

// Returns the per-farmer investment summary, cached in-memory for a while
// since re-scanning the 48MB CSV on every report request would be slow;
// concurrent requests during a refresh share the same in-flight promise.
export async function getFarmerInvestmentSummary({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cache && now < cacheExpiresAt) return cache;

  if (!cacheInFlight) {
    cacheInFlight = loadFarmerInvestmentSummary()
      .then((rows) => {
        cache = rows;
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return rows;
      })
      .finally(() => {
        cacheInFlight = null;
      });
  }

  try {
    return await cacheInFlight;
  } catch (error) {
    if (cache) return cache;
    throw error;
  }
}
