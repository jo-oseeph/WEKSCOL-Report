import { executeParquetQuery } from "../../db/parquetDb/connection.js";
import { httpError } from "../../shared/errors.js";
import normalizeIdentifierSearch from "./normalizeIdentifierSearch.js";
import validateDateRange from "./validateDateRange.js";

const REPORT_RULES = {
  "billing-fully-billed": {
    dataset: "fully-billed",
    dateColumn: "GROSS_DT1",
    columns: [
      "Sup_Unit_name",
      "Sup_Sector_Name",
      "Sup_Zone_Name",
      "Sup_Section_Name",
      "CCS_Slip",
      "GROSS_DT1",
      "Billing_Status",
      "Sup_Field_No",
      "Sup_Farmer_Name",
      "Sup_Farmer_Id",
      "Sup_Field_Area",
      "Sup_SubLocation",
      "Sup_Village_Name",
      "DN_Number",
      "DN_Date",
      "Rec_Field_No",
      "Rec_Farmer_Name",
      "Rec_Farmer_Id",
      "Rec_Field_Area",
      "Rec_Unit_name",
      "Rec_Sector_Name",
      "Rec_Zone_Name",
      "Rec_Section_Name",
      "Rec_SubLocation",
      "Rec_Village_Name",
      "Net_Weight",
      "Slip_Billed_Qty",
      "Delivered_Qty",
      "Billed_Diff",
      "SC_Actual_Rate",
      "SC_Actual_Cost",
      "TZ_Actual_Rate",
      "TZ_Actual_Cost",
    ],
    orderBy: "Sup_Unit_name, Sup_Sector_Name, Sup_Zone_Name, Sup_Section_Name, GROSS_DT1, CCS_Slip, DN_Number",
  },
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
  OR Description LIKE '%MAVUNOPLANTING FERT 50KG%'
  OR Description LIKE '%MAVUNO PLANTING FERT 50KG%'
)`;
const SEEDCANE_FILTER = "Description LIKE '%SEED CANE%'";

function addFilter(clauses, parameters, column, value, operator = "=") {
  if (value === undefined || value === "" || value === "all") return;
  clauses.push(`${column} ${operator} ?`);
  parameters.push(value);
}

function addIdentifierFilter(clauses, parameters, value, columns = ["ID_Number", "Field_Number"]) {
  const normalized = normalizeIdentifierSearch(value);
  if (!normalized) return;
  clauses.push(`(REPLACE(UPPER(TRIM(CAST(${columns[0]} AS VARCHAR))), 'FN-', '') = ? OR REPLACE(UPPER(TRIM(CAST(${columns[1]} AS VARCHAR))), 'FN-', '') = ?)`);
  parameters.push(normalized, normalized);
}

function nextDateOnly(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function buildFilters(rule, query) {
  const { dateFrom, dateTo } = validateDateRange(query);
  const clauses = rule.dataset === "qc" || rule.dataset === "fully-billed"
    ? []
    : [rule.service === "fertilizer" ? FERTILIZER_FILTER : SEEDCANE_FILTER];
  const parameters = [
    rule.dataset === "qc"
      ? "__QC_PARQUET_PATH__"
      : rule.dataset === "fully-billed"
      ? "__FULLY_BILLED_PARQUET_PATH__"
      : "__PARQUET_PATH__",
  ];

  const locationColumns = rule.dataset === "fully-billed"
    ? { unit: "Sup_Unit_name", sector: "Sup_Sector_Name", zone: "Sup_Zone_Name", section: "Sup_Section_Name" }
    : { unit: "Unit_name", sector: "Sector_Name", zone: "Zone_Name", section: "Section_Name" };
  addFilter(clauses, parameters, locationColumns.unit, query.unit);
  addFilter(clauses, parameters, locationColumns.sector, query.sector);
  addFilter(clauses, parameters, locationColumns.zone, query.zone);
  addFilter(clauses, parameters, locationColumns.section, query.section);
  addIdentifierFilter(
    clauses,
    parameters,
    query.identifierSearch,
    rule.dataset === "fully-billed" ? ["Sup_Farmer_Id", "Sup_Field_No"] : undefined,
  );

  const dateColumn = rule.dateColumn || "Max_Created_On";
  addFilter(clauses, parameters, dateColumn, `${dateFrom}T00:00:00`, ">=");
  addFilter(clauses, parameters, dateColumn, `${nextDateOnly(dateTo)}T00:00:00`, "<");

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

function fullyBilledSummaryQuery(filters, group) {
  const groupColumns = {
    unit: ["Sup_Unit_name"],
    sector: ["Sup_Unit_name", "Sup_Sector_Name"],
    zone: ["Sup_Unit_name", "Sup_Sector_Name", "Sup_Zone_Name"],
    section: ["Sup_Unit_name", "Sup_Sector_Name", "Sup_Zone_Name", "Sup_Section_Name"],
  }[group];
  if (!groupColumns) throw httpError(`Unsupported summary group: ${group}.`, 400);
  const groupSql = groupColumns.map((column) => `"${column}"`).join(", ");
  return `
    SELECT ${groupSql},
      SUM(TRY_CAST(Delivered_Qty AS DOUBLE)) AS "Total Billed (Tonnes)",
      COUNT(DISTINCT CCS_Slip) AS "Total CCS Slips"
    FROM (
      SELECT ${ruleColumns("billing-fully-billed")}
      FROM read_parquet(?)
      ${filters.clauses.length ? `WHERE ${filters.clauses.join(" AND ")}` : ""}
    ) AS fully_billed
    GROUP BY ${groupSql}
    ORDER BY ${groupSql}`;
}

function ruleColumns(reportId) {
  return REPORT_RULES[reportId].columns.map((column) => `"${column}"`).join(", ");
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
    : reportId === "billing-fully-billed"
    ? fullyBilledSummaryQuery(filters, group)
    : summaryQuery(filters, rule, group);
  const rows = await executeParquetQuery(sql, filters.parameters);

  return {
    rows,
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    parameters: Object.fromEntries(
      ["unit", "sector", "zone", "section", "dateFrom", "dateTo", "identifierSearch"]
        .filter((name) => query[name] !== undefined && query[name] !== "" && query[name] !== "all")
        .map((name) => [name, name === "identifierSearch" ? normalizeIdentifierSearch(query[name]) : query[name]]),
    ),
  };
}