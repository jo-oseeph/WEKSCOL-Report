import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import duckdb from "duckdb";
import ExcelJS from "exceljs";
import { queryHarvestingReport } from "../modules/agriculture/harvesting/harvestingReportService.js";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const workbookPath = path.resolve(serverDirectory, "../../reports/Customer Care.xlsx");
const weighmentDataPath = process.env.WEIGHMENT_DATA_PATH
  ? path.resolve(serverDirectory, "..", process.env.WEIGHMENT_DATA_PATH)
  : "";

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
  "daily-weighment": {
    name: "Daily Weighment Report",
    description: "Daily weighment details and summaries by unit, sector, zone, section and month.",
    variants: {
      detailed: "__NOTEBOOK__",
      summary: "__NOTEBOOK__",
    },
    summaryGroups: ["unit", "sector", "zone", "section", "month"],
    source: "notebook",
  },
  "cane-supply": {
    name: "Cane Supply",
    description: "Cane supply details and summaries by unit, sector, zone, section and month.",
    variants: {
      detailed: "__NOTEBOOK__",
      summary: "__NOTEBOOK__",
    },
    summaryGroups: ["unit", "sector", "zone", "section", "month"],
    source: "notebook",
  },
};

const weighmentSummaryGroups = {
  plant: { label: "Plant", select: "plant AS \"Plant\"", group: "plant", order: "plant" },
  sector: { label: "Sector", select: "sector AS \"Sector\"", group: "sector", order: "sector" },
  zone: { label: "Zone", select: "zone AS \"Zone\"", group: "zone", order: "zone" },
  section: { label: "Section", select: "section AS \"Section\"", group: "section", order: "section" },
  month: { label: "Month", select: "DATE_TRUNC('month', weighment_date) AS \"Month\"", group: "DATE_TRUNC('month', weighment_date)", order: "DATE_TRUNC('month', weighment_date)" },
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

// Loads the configured weighment export into normalized row objects.
async function loadWeighmentRows() {
  if (!weighmentDataPath) throw createError("Daily weighment data is not configured. Set WEIGHMENT_DATA_PATH on the server.", 503);
  if (!fs.existsSync(weighmentDataPath)) throw createError("The configured daily weighment data file was not found.", 503);
  const extension = path.extname(weighmentDataPath).toLowerCase();
  const workbook = new ExcelJS.Workbook();
  if (extension === ".xlsx" || extension === ".xls") {
    await workbook.xlsx.readFile(weighmentDataPath);
  } else {
    await workbook.csv.readFile(weighmentDataPath);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw createError("The configured daily weighment data file has no worksheet.", 503);
  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value || "").trim());
  return sheetToObjects(sheet, headers).map(normalizeWeighmentRow).filter((row) => row.weighment_date);
}

// Converts spreadsheet rows into the report’s normalized data shape.
function sheetToObjects(sheet, headers) {
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  });
  return rows;
}

// Applies source aliases and numeric/date normalization to one weighment row.
function normalizeWeighmentRow(row) {
  const value = (name, aliases = []) => {
    const key = [name, ...aliases].find((candidate) => Object.prototype.hasOwnProperty.call(row, candidate));
    return key ? row[key] : "";
  };
  const text = (name, aliases = []) => String(value(name, aliases) ?? "").trim();
  const number = (name, aliases = []) => {
    const parsed = Number(value(name, aliases));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const rawDate = value("GROSS_DT1", ["Gross_Date", "Date"]);
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  return {
    weighment_date: Number.isNaN(date.getTime()) ? null : date,
    weigh_no: text("Weigh_No", ["Weigh No."]),
    permit_no: text("Permit_No", ["Permit No."]),
    ccs_slip_no: text("CCS_Slip_No", ["CCS Slip No."]),
    farmer_name: text("Farmer_Name", ["Farmer Name"]),
    farmer_id: text("Farmer_Id", ["Farmer ID"]),
    field_number: text("field_number", ["Field_No", "Field No."]),
    region: text("Region_Name", ["Region"]),
    plant: text("Plant") || mapPlant(text("Region_Name", ["Region"])),
    sector: text("Sector_Name", ["Sector"]),
    zone: text("Zone"),
    section: text("Section_Name", ["Section"]),
    sub_location: text("SubLocation", ["Sub-location"]),
    village: text("Village_Name", ["Village"]),
    harvester_name: text("Harvester_Name", ["Harvester"]),
    tractor_trailer: text("Tractor_Trailer", ["Tractor / Trailer"]),
    driver_name: text("Driver_Name", ["Driver"]),
    material: text("Material_Desc", ["Material"]),
    gross_weight: number("Gross_Wt", ["Gross Weight (t)"]),
    tare_weight: number("Tare_Wt", ["Tare Weight (t)"]),
    external_matter: number("Ext_Mtr", ["External Matter (t)"]),
    net_weight: number("Net_Wt", ["Net Weight (t)"]),
    in_time: text("In_Time", ["In Time"]),
    out_time: text("Out_Time", ["Out Time"]),
    sync_status: text("Is_Synch", ["Sync Status"]),
    iprs_status: text("Iprs_Status", ["IPRS Status"]),
    business_partner_type: text("BP_Type", ["BP Type"]),
    loading_station: text("Loading_Station", ["Loading Station"]),
    weighbridge_type: text("Weighbridge_Type", ["Weighbridge"]),
    slip_type: text("SlipType", ["Slip Type"]),
  };
}

// Maps source regions to the application’s plant names.
function mapPlant(region) {
  const normalized = region.toUpperCase();
  if (["NAITIRI", "MISIKHU", "KITALE"].includes(normalized)) return "WKS-NAITIRI";
  if (normalized === "BUSIA") return "WKS-OLEPITO";
  return "WKS-KABRAS";
}

// Applies report filters and returns the selected weighment rows.
function filterWeighmentRows(rows, query) {
  const matches = (value, selected) => !selected || selected === "all" || value.toUpperCase() === selected.toUpperCase();
  const dateFrom = normalizeFilter(query.dateFrom);
  const dateTo = normalizeFilter(query.dateTo);
  return rows.filter((row) => {
    const date = row.weighment_date.toISOString().slice(0, 10);
    return matches(row.plant, normalizeFilter(query.plant))
      && matches(row.region, normalizeFilter(query.region))
      && matches(row.zone, normalizeFilter(query.zone))
      && matches(row.section, normalizeFilter(query.section))
      && (!dateFrom || date >= dateFrom)
      && (!dateTo || date <= dateTo);
  });
}

// Runs the detailed or grouped daily weighment query in memory.
async function queryWeighmentReport(query) {
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const groupKey = query.group || "plant";
  const group = weighmentSummaryGroups[groupKey] || weighmentSummaryGroups.plant;
  const rows = filterWeighmentRows(await loadWeighmentRows(), query);
  if (variant === "detailed") {
    const detailedRows = rows.sort((a, b) => b.weighment_date - a.weighment_date || b.weigh_no.localeCompare(a.weigh_no)).map((row) => ({
      Date: row.weighment_date.toISOString(), "Weigh No.": row.weigh_no, "Permit No.": row.permit_no, "CCS Slip No.": row.ccs_slip_no,
      "Farmer Name": row.farmer_name, "Farmer ID": row.farmer_id, "Field No.": row.field_number, Plant: row.plant, Sector: row.sector,
      Zone: row.zone, Section: row.section, "Sub-location": row.sub_location, Village: row.village, Harvester: row.harvester_name,
      "Tractor / Trailer": row.tractor_trailer, Driver: row.driver_name, Material: row.material, "Gross Weight (t)": row.gross_weight,
      "Tare Weight (t)": row.tare_weight, "External Matter (t)": row.external_matter, "Net Weight (t)": row.net_weight,
      "In Time": row.in_time, "Out Time": row.out_time, "Sync Status": row.sync_status, "IPRS Status": row.iprs_status,
      "BP Type": row.business_partner_type, "Loading Station": row.loading_station, Weighbridge: row.weighbridge_type, "Slip Type": row.slip_type,
    }));
    return { variant, group: groupKey, groupLabel: group.label, filters: query, columns: columnsFromRows(detailedRows), rows: detailedRows };
  }
  const grouped = new Map();
  rows.forEach((row) => {
    const key = groupKey === "month"
      ? row.weighment_date.toISOString().slice(0, 7)
      : row[groupKey] || "Unspecified";
    const current = grouped.get(key) || { label: key, rows: [] };
    current.rows.push(row);
    grouped.set(key, current);
  });
  const summaryRows = [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label)).map(({ label, rows: groupRows }) => ({
    [group.label]: label,
    Weighments: groupRows.length,
    Farmers: new Set(groupRows.map((row) => row.farmer_id).filter(Boolean)).size,
    Fields: new Set(groupRows.map((row) => row.field_number).filter(Boolean)).size,
    "CCS Slips": new Set(groupRows.map((row) => row.ccs_slip_no).filter(Boolean)).size,
    "Net Weight (t)": Number(groupRows.reduce((total, row) => total + row.net_weight, 0).toFixed(3)),
  }));
  return { variant, group: groupKey, groupLabel: group.label, filters: query, columns: columnsFromRows(summaryRows), rows: summaryRows };
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
      unit: Object.entries(locations).find(([, regions]) => regions.some((name) => name.toUpperCase() === row.region?.toUpperCase()))?.[0] || "Kabras",
      region: row.region,
      sector: row.region,
      zone: row.zone,
      section: row.section,
    })),
  };
}

export async function queryReport(reportId, query = {}) {
  const report = reports[reportId];
  if (!report) throw createError("Report not found.", 404);
  if (report.source === "notebook") {
    const result = await queryHarvestingReport({ ...query, reportId });
    return { id: reportId, name: report.name, description: report.description, variants: Object.keys(report.variants), ...result };
  }
  if (report.source === "weighment") {
    const result = await queryWeighmentReport(query);
    return { id: reportId, name: report.name, description: report.description, variants: Object.keys(report.variants), ...result };
  }
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