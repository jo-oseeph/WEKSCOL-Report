import { executeParquetQuery } from "../../db/parquetDb/connection.js";
import { httpError } from "../../shared/errors.js";

const REPORT_RULES = {
  "fertilizer-requests": { service: "fertilizer", status: "requests" },
  "fertilizer-pending-agriculture": { service: "fertilizer", status: "pending-agriculture" },
  "fertilizer-pending-finance": { service: "fertilizer", status: "pending-finance" },
  "fertilizer-pending-issuance": { service: "fertilizer", status: "pending-issuance" },
  "fertilizer-issued": { service: "fertilizer", status: "issued" },
  "seedcane-requests": { service: "seedcane", status: "requests" },
  "seedcane-pending-agriculture": { service: "seedcane", status: "pending-agriculture" },
  "seedcane-pending-finance": { service: "seedcane", status: "pending-finance" },
  "seedcane-pending-issuance": { service: "seedcane", status: "pending-issuance" },
  "seedcane-issued": { service: "seedcane", status: "issued" },
  "fertilizer-qc": {
    service: "fertilizer",
    dataset: "qc",
    dateColumn: "Request_Created_On",
    columns: [
      "Contract_Number",
      "Field_Number",
      "ID_Number",
      "First_Name",
      "OVERLAP",
      "IPRS",
      "Description",
      "Unit_name",
      "Sector_Name",
      "Zone_Name",
      "Section_Name",
      "SubLocation",
      "Village_Name",
      "Measured_Cane_Area",
      "Qty_Requested",
      "Qty_Agri",
      "Qty_Fin",
      "Qty_Delivered",
      "Issuance_Status",
      "Age_Months",
      "Current_Crop_Cycle",
      "Actual_Date_Of_Plant_Ratoon",
      "Fertilizer_Issuance_Flag",
      "Fertilizer_Issuance_Remarks",
      "Request_Created_On",
    ],
    orderBy: "Unit_name, Sector_Name, Zone_Name, Section_Name, Field_Number",
  },
};

const GROUP_COLUMNS = {
  unit: ["Unit_name"],
  sector: ["Unit_name", "Sector_Name"],
  zone: ["Unit_name", "Sector_Name", "Zone_Name"],
  section: ["Unit_name", "Sector_Name", "Zone_Name", "Section_Name"],
};

// Keep this fertilizer filter aligned with the approved clean report query.
const FERTILIZER_FILTER = `(
  Description LIKE '%TSP FERTILIZER 50KG%'
  OR Description LIKE '%ELGON THABITI TOP DRESSING 50KG%'
  OR Description LIKE '%MAVUNO TOP DRESSING FERT 50KG%'
)`;
const SEEDCANE_FILTER = "Description LIKE '%SEED CANE%'";

function addFilter(clauses, parameters, column, value, operator = "=") {
  if (value === undefined || value === "" || value === "all") return;
  clauses.push(`${column} ${operator} ?`);
  parameters.push(value);
}

function isDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function nextDateOnly(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildFilters(rule, query) {
  const clauses = rule.dataset === "qc"
    ? []
    : [rule.service === "fertilizer" ? FERTILIZER_FILTER : SEEDCANE_FILTER];
  const parameters = [rule.dataset === "qc" ? "__QC_PARQUET_PATH__" : "__PARQUET_PATH__"];
  const dateFrom = query.dateFrom && query.dateFrom !== "all" ? query.dateFrom : undefined;
  const dateTo = query.dateTo && query.dateTo !== "all" ? query.dateTo : undefined;

  addFilter(clauses, parameters, "Unit_name", query.unit);
  addFilter(clauses, parameters, "Sector_Name", query.sector);
  addFilter(clauses, parameters, "Zone_Name", query.zone);
  addFilter(clauses, parameters, "Section_Name", query.section);

  if (dateFrom && !isDateOnly(dateFrom)) {
    throw httpError("dateFrom must be a valid date in YYYY-MM-DD format.", 400);
  }
  if (dateTo && !isDateOnly(dateTo)) {
    throw httpError("dateTo must be a valid date in YYYY-MM-DD format.", 400);
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw httpError("dateFrom cannot be after dateTo.", 400);
  }

  const dateColumn = rule.dateColumn || "Max_Created_On";
  addFilter(clauses, parameters, dateColumn, dateFrom ? `${dateFrom}T00:00:00` : undefined, ">=");
  addFilter(clauses, parameters, dateColumn, dateTo ? `${nextDateOnly(dateTo)}T00:00:00` : undefined, "<");

  return { clauses, parameters };
}

function statusFilter(status) {
  if (status === "requests") return "Qty_Requested > 0";
  if (status === "pending-agriculture") return "(Qty_Agri IS NULL OR Qty_Agri = 0)";
  if (status === "pending-finance") return "Qty_Agri > 0 AND (Qty_Fin IS NULL OR Qty_Fin = 0)";
  if (status === "pending-issuance") {
    return "Qty_Agri > 0 AND Qty_Fin > 0 AND (Qty_Delivered IS NULL OR Qty_Delivered = 0)";
  }
  if (status === "issued") return "Qty_Delivered > 0";
  throw httpError(`Unsupported service request status: ${status}.`, 500);
}

const BASE_COLUMNS = [
  "Field_Number",
  "OVERLAP",
  "ID_Number",
  "IPRS",
  "First_Name",
  "Description",
  "Region_Name",
  "Sector_Name",
  "Zone_Name",
  "Section_Name",
  "SubLocation",
  "Unit_name",
  "Village_Name",
  "Measured_Cane_Area",
  "Qty_Requested",
];

const REPORT_COLUMNS = {
  requests: [
    ...BASE_COLUMNS,
    "Ageing_Days",
    "Max_Created_On",
    "Current_Crop_Cycle",
    "Actual_Date_Of_Plant_Ratoon",
    "Contract_Number",
  ],
  "pending-agriculture": [
    ...BASE_COLUMNS,
    "Ageing_Days",
    "Max_Created_On",
    "Current_Crop_Cycle",
    "Actual_Date_Of_Plant_Ratoon",
    "Contract_Number",
  ],
  "pending-finance": [
    ...BASE_COLUMNS,
    "Qty_Agri",
    "Ageing_Days",
    "Max_Created_On",
    "Current_Crop_Cycle",
    "Actual_Date_Of_Plant_Ratoon",
    "Contract_Number",
  ],
  "pending-issuance": [
    ...BASE_COLUMNS,
    "Qty_Agri",
    "Qty_Fin",
    "Qty_Allocated",
    "Qty_Delivered",
    "Ageing_Days",
    "Max_Created_On",
    "Current_Crop_Cycle",
    "Actual_Date_Of_Plant_Ratoon",
    "Contract_Number",
  ],
  issued: [
    ...BASE_COLUMNS,
    "Qty_Agri",
    "Qty_Fin",
    "Qty_Allocated",
    "Qty_Delivered",
    "Qty_Pending",
    "Ageing_Days",
    "Max_Created_On",
    "Current_Crop_Cycle",
    "Actual_Date_Of_Plant_Ratoon",
    "Contract_Number",
  ],
};

const ORDER_BY = "Region_Name, Sector_Name, Zone_Name, Section_Name, Field_Number";

function reportColumns(rule) {
  const columns = rule.columns || REPORT_COLUMNS[rule.status];
  if (!columns) throw httpError(`Unsupported service request status: ${rule.status}.`, 500);
  return columns.join(",\n      ");
}

function sourceSql(filters, rule) {
  return `
    SELECT
      ${reportColumns(rule)}
    FROM read_parquet(?)
    ${filters.clauses.length > 0 ? `WHERE ${filters.clauses.join(" AND ")}${rule.status ? `\n      AND ${statusFilter(rule.status)}` : ""}` : ""}`;
}

function detailedQuery(filters, rule) {
  return `
    SELECT *
    FROM (${sourceSql(filters, rule)}) AS service_request_result
    ORDER BY ${rule.orderBy || ORDER_BY}`;
}

function summaryQuery(filters, rule, group) {
  const groupColumns = GROUP_COLUMNS[group];
  if (!groupColumns) throw httpError(`Unsupported summary group: ${group}.`, 400);
  const groupSql = groupColumns.map((column) => `"${column}"`).join(", ");
  const quantityName = rule.service === "fertilizer" ? "Quantity_Bags" : "Quantity_Tonnes";

  return `
    WITH filtered AS (${sourceSql(filters, rule)}),
    fields AS (
      SELECT ${groupSql}, Field_Number, Measured_Cane_Area
      FROM (
        SELECT ${groupSql}, Field_Number, TRY_CAST(Measured_Cane_Area AS DOUBLE) AS Measured_Cane_Area,
          ROW_NUMBER() OVER (PARTITION BY ${groupSql}, Field_Number ORDER BY Field_Number) AS field_row
        FROM filtered
      ) AS distinct_fields
      WHERE field_row = 1
    ),
    field_summary AS (
      SELECT ${groupSql}, COUNT(DISTINCT Field_Number) AS Total_Fields, SUM(Measured_Cane_Area) AS Total_Acreage
      FROM fields
      GROUP BY ${groupSql}
    ),
    quantity_summary AS (
      SELECT ${groupSql}, SUM(TRY_CAST(Qty_Requested AS DOUBLE)) AS ${quantityName}
      FROM filtered
      GROUP BY ${groupSql}
    )
    SELECT f.*, q.${quantityName}
    FROM field_summary f
    INNER JOIN quantity_summary q USING (${groupSql})
    ORDER BY ${groupSql}`;
}

export async function runParquetReport({ reportId, variant, group, query }) {
  const rule = REPORT_RULES[reportId];
  if (!rule) throw httpError("This service request report is not configured for Parquet execution.", 500);

  const filters = buildFilters(rule, query);
  const sql = variant === "detailed"
    ? detailedQuery(filters, rule)
    : summaryQuery(filters, rule, group);
  const rows = await executeParquetQuery(sql, filters.parameters);

  return {
    rows,
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    parameters: Object.fromEntries(
      ["unit", "sector", "zone", "section", "dateFrom", "dateTo"]
        .filter((name) => query[name] !== undefined && query[name] !== "" && query[name] !== "all")
        .map((name) => [name, query[name]]),
    ),
  };
}