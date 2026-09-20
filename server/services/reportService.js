import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import duckdb from "duckdb";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(serverDirectory, "../../reports/Customer Care.xlsx");

const locations = {
  Naitiri: ["Kitale", "Misikhu", "Naitiri"],
  Olepito: ["Busia"],
  Kabras: [],
};

const reports = {
  "open-requests": {
    name: "Open Request Log",
    description: "Customer care requests that are still open or in progress.",
    variants: {
      summary: `
        WITH source AS (${"__BASE__"})
        SELECT region, zone, section, village, COUNT(*) AS total_requests,
          SUM(CASE WHEN COALESCE(NULLIF(TRIM(rhoa_status), ''), 'Not Started') <> 'Converted' THEN 1 ELSE 0 END) AS pending,
          DATE_DIFF('day', CAST(submission_datetime AS DATE), CURRENT_DATE) AS days_open
        FROM source
        WHERE 1 = 1
        __FILTERS__
        GROUP BY region, zone, section, village, days_open
        ORDER BY pending DESC
      `,
      detailed: `
        WITH source AS (${"__BASE__"})
        SELECT response_id, submission_datetime AS date_of_submission, region, zone, section,
          farmer_name, farmer_phone, request_type, request_details, rhoa_status,
          remarks_customer_care, days_open
        FROM (
          SELECT source.*, DATE_DIFF('day', CAST(submission_datetime AS DATE), CURRENT_DATE) AS days_open
          FROM source
        ) open_requests
        WHERE COALESCE(NULLIF(TRIM(rhoa_status), ''), 'Not Started') IN ('Not Started', 'In Progress')
        __FILTERS__
        ORDER BY days_open DESC, date_of_submission DESC
      `,
    },
  },
  "resolved-requests": {
    name: "Resolved Request Log",
    description: "Customer care requests resolved through field action.",
    variants: {
      summary: `
        WITH source AS (${"__BASE__"})
        SELECT region, zone, section, village, COUNT(*) AS total_requests,
          SUM(CASE WHEN TRIM(rhoa_status) = 'Converted' THEN 1 ELSE 0 END) AS resolved
        FROM source
        WHERE 1 = 1
        __FILTERS__
        GROUP BY region, zone, section, village
        ORDER BY resolved DESC
      `,
      detailed: `
        WITH source AS (${"__BASE__"})
        SELECT response_id, submission_datetime AS date_of_submission, region, zone,
          section, village, farmer_name, request_type, closed_through_field_number,
          rhoa_remarks, remarks_customer_care
        FROM source
        WHERE TRIM(rhoa_status) = 'Converted'
        __FILTERS__
        ORDER BY date_of_submission DESC
      `,
    },
  },
  "farmer-requests": {
    name: "Farmers Request",
    description: "Farmer request history grouped by farmer and request type.",
    variants: {
      summary: `
        WITH source AS (${"__BASE__"})
        SELECT farmer_id, farmer_name, region, zone, section, village,
          COUNT(*) AS total_requests, STRING_AGG(request_type, ', ') AS request_types,
          MAX(submission_datetime) AS most_recent_request
        FROM source
        WHERE 1 = 1
        __FILTERS__
        GROUP BY farmer_id, farmer_name, region, zone, section, village
        ORDER BY total_requests DESC
      `,
      detailed: `
        WITH source AS (${"__BASE__"})
        SELECT farmer_id, farmer_name, farmer_phone, region, zone, section, village,
          request_type, MAX(submission_datetime) AS most_recent_request
        FROM source
        WHERE 1 = 1
        __FILTERS__
        GROUP BY farmer_id, farmer_name, farmer_phone, region, zone, section, village, request_type
        ORDER BY most_recent_request DESC
      `,
    },
  },
};

function escapedWorkbookPath() {
  return workbookPath.replace(/'/g, "''");
}

function baseQuery() {
  return `
  SELECT
    TRIM("Response Id") AS response_id,
    CAST(DATE '1899-12-30' + CAST(FLOOR(TRY_CAST("Date of Submission" AS DOUBLE)) AS INTEGER) AS TIMESTAMP)
      + (TRY_CAST("Date of Submission" AS DOUBLE) - FLOOR(TRY_CAST("Date of Submission" AS DOUBLE))) * INTERVAL '1 day' AS submission_datetime,
    TRIM("Region") AS region,
    TRIM("Zone") AS zone,
    TRIM("Section") AS section,
    TRIM("Block/Village") AS village,
    TRIM("Farmer Id") AS farmer_id,
    TRIM("Famer Name.") AS farmer_name,
    TRIM("Farmer Phone No.") AS farmer_phone,
    TRIM("Requests") AS request_type,
    COALESCE(NULLIF(TRIM("Request Details"), ''), 'Not Started') AS request_details,
    TRIM("RHOA STATUS") AS rhoa_status,
    COALESCE(NULLIF(TRIM("CLOSED THROUGH FIELD NUMBER"), ''), 'Not Started') AS closed_through_field_number,
    COALESCE(NULLIF(TRIM("RHOA REMARKS"), ''), 'Not Started') AS rhoa_remarks,
    COALESCE(NULLIF(TRIM("REMARKS AT CUSTOMER CARE"), ''), 'Not Started') AS remarks_customer_care
  FROM read_xlsx('${escapedWorkbookPath()}', header = true, all_varchar = true)
`;
}

function createError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeFilter(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim() : null;
}

function buildFilters(query) {
  const values = [];
  const filters = [];
  const plant = normalizeFilter(query.plant);
  const region = normalizeFilter(query.region);
  const zone = normalizeFilter(query.zone);
  const section = normalizeFilter(query.section);
  const dateFrom = normalizeFilter(query.dateFrom);
  const dateTo = normalizeFilter(query.dateTo);

  if (plant === "Naitiri") {
    filters.push("UPPER(region) IN ('KITALE', 'MISIKHU', 'NAITIRI')");
  } else if (plant === "Olepito") {
    filters.push("UPPER(region) = 'BUSIA'");
  } else if (plant === "Kabras") {
    filters.push("UPPER(region) NOT IN ('KITALE', 'MISIKHU', 'NAITIRI', 'BUSIA')");
  } else if (plant) {
    throw createError("Invalid plant filter.");
  }

  if (region) {
    filters.push("UPPER(region) = UPPER(?)");
    values.push(region);
  }
  if (zone) {
    filters.push("UPPER(zone) = UPPER(?)");
    values.push(zone);
  }
  if (section) {
    filters.push("UPPER(section) = UPPER(?)");
    values.push(section);
  }
  if (dateFrom) {
    filters.push("CAST(submission_datetime AS DATE) >= CAST(? AS DATE)");
    values.push(dateFrom);
  }
  if (dateTo) {
    filters.push("CAST(submission_datetime AS DATE) <= CAST(? AS DATE)");
    values.push(dateTo);
  }

  return {
    sql: filters.length ? `AND ${filters.join(" AND ")}` : "",
    values,
    summary: { plant, region, zone, section, dateFrom, dateTo },
  };
}

function run(connection, sql, values = []) {
  return new Promise((resolve, reject) => {
    const callback = (error, rows) => (error ? reject(error) : resolve(rows));
    if (values.length === 0) {
      connection.all(sql, callback);
    } else {
      connection.all(sql, ...values, callback);
    }
  });
}

async function withConnection(callback) {
  if (!fs.existsSync(workbookPath)) throw createError("Customer Care.xlsx was not found.", 500);
  const database = new duckdb.Database(":memory:");
  const connection = database.connect();
  try {
    await run(connection, "INSTALL excel; LOAD excel;");
    return await callback(connection);
  } finally {
    connection.close();
    database.close();
  }
}

function columnsFromRows(rows) {
  return rows.length ? Object.keys(rows[0]) : [];
}

function normalizeDatabaseValue(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDatabaseValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeDatabaseValue(item)]),
    );
  }
  return value;
}

export function getReportCatalog() {
  return Object.entries(reports).map(([id, report]) => ({
    id,
    name: report.name,
    description: report.description,
    variants: Object.keys(report.variants),
  }));
}

export async function getReportFilters() {
  const rows = await withConnection((connection) => run(connection, `
    SELECT DISTINCT TRIM("Region") AS region, TRIM("Zone") AS zone, TRIM("Section") AS section
    FROM read_xlsx('${escapedWorkbookPath()}', header = true, all_varchar = true)
    WHERE TRIM("Region") IS NOT NULL AND TRIM("Region") <> ''
    ORDER BY region, zone, section
  `));

  return {
    plants: Object.keys(locations),
    locations: rows.map((row) => ({
      plant: Object.entries(locations).find(([, regions]) => regions.some((name) => name.toUpperCase() === row.region?.toUpperCase()))?.[0] || "Kabras",
      region: row.region,
      zone: row.zone,
      section: row.section,
    })),
  };
}

export async function queryReport(reportId, query = {}) {
  const report = reports[reportId];
  if (!report) throw createError("Report not found.", 404);
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const filterSet = buildFilters(query);
  const sql = report.variants[variant].replace("__BASE__", baseQuery()).replace("__FILTERS__", filterSet.sql);
  const rawRows = await withConnection((connection) => run(connection, sql, filterSet.values));
  const rows = rawRows.map(normalizeDatabaseValue);
  return {
    id: reportId,
    name: report.name,
    description: report.description,
    variant,
    variants: Object.keys(report.variants),
    filters: filterSet.summary,
    columns: columnsFromRows(rows),
    rows,
  };
}

export { locations, reports };