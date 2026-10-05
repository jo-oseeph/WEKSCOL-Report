import { executeParquetQuery } from "../../db/parquetDb/connection.js";
import { httpError } from "../../shared/errors.js";

const FERTILIZER_REPORTS = {
  "fertilizer-requests": "requests",
  "fertilizer-pending-agriculture": "pending-agriculture",
  "fertilizer-pending-finance": "pending-finance",
  "fertilizer-pending-issuance": "pending-issuance",
  "fertilizer-issued": "issued",
};

const GROUP_COLUMNS = {
  unit: ["Unit_name AS Unit"],
  sector: ["Unit_name AS Unit", "Sector_Name"],
  zone: ["Unit_name AS Unit", "Sector_Name", "Zone_Name"],
  section: ["Unit_name AS Unit", "Sector_Name", "Zone_Name", "Section_Name"],
};

const FERTILIZER_FILTER = `(
  Description ILIKE '%TSP FERTILIZER 50KG%'
  OR Description ILIKE '%ELGON THABITI TOP DRESSING 50KG%'
  OR Description ILIKE '%MAVUNO TOP DRESSING FERT 50KG%'
)`;

// Convert a report query value into a DuckDB predicate and parameter pair.
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

// Build the shared location and date filters used by all fertilizer variants.
function buildParquetFilters(query) {
  const clauses = [FERTILIZER_FILTER];
  const parameters = ["__PARQUET_PATH__"];

  addFilter(clauses, parameters, "Unit_name", query.unit);
  addFilter(clauses, parameters, "Sector_Name", query.sector);
  addFilter(clauses, parameters, "Zone_Name", query.zone);
  addFilter(clauses, parameters, "Section_Name", query.section);

  const dateFrom = query.dateFrom && query.dateFrom !== "all" ? query.dateFrom : undefined;
  const dateTo = query.dateTo && query.dateTo !== "all" ? query.dateTo : undefined;
  if (dateFrom && !isDateOnly(dateFrom)) {
    throw httpError("dateFrom must be a valid date in YYYY-MM-DD format.", 400);
  }
  if (dateTo && !isDateOnly(dateTo)) {
    throw httpError("dateTo must be a valid date in YYYY-MM-DD format.", 400);
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw httpError("dateFrom cannot be after dateTo.", 400);
  }
  addFilter(clauses, parameters, "Min_Created_On", dateFrom ? `${dateFrom}T00:00:00` : undefined, ">=");
  addFilter(clauses, parameters, "Min_Created_On", dateTo ? `${nextDateOnly(dateTo)}T00:00:00` : undefined, "<");

  return { clauses, parameters };
}

// Build the mutually exclusive report status predicate for fertilizer data.
function statusFilter(status) {
  if (status === "requests") return "TRUE";
  if (status === "pending-agriculture") return "COALESCE(Qty_Agri, 0) <= 0";
  if (status === "pending-finance") return "Qty_Agri > 0 AND COALESCE(Qty_Fin, 0) <= 0";
  if (status === "pending-issuance") return "Qty_Agri > 0 AND Qty_Fin > 0 AND COALESCE(Qty_Delivered, 0) <= 0";
  if (status === "issued") return "COALESCE(Qty_Delivered, 0) > 0";
  throw httpError(`Unsupported fertilizer status: ${status}.`, 500);
}

// Build the detailed DuckDB query using the same columns returned by SQL reports.
function detailedQuery(status, filters) {
  const columns = `
    Field_Number,
    OVERLAP,
    ID_Number,
    IPRS,
    First_Name,
    Description,
    Region_Name,
    Sector_Name,
    Zone_Name,
    Section_Name,
    SubLocation,
    Unit_name AS Unit,
    Village_Name,
    CASE
      WHEN COALESCE(Qty_Delivered, 0) > 0 THEN 'Issued'
      WHEN Qty_Agri > 0 AND Qty_Fin > 0 THEN 'Pending Issuance'
      WHEN Qty_Agri > 0 AND COALESCE(Qty_Fin, 0) <= 0 THEN 'Pending Finance Approval'
      WHEN COALESCE(Qty_Agri, 0) <= 0 THEN 'Pending Agriculture Approval'
      ELSE 'Request'
    END AS "Approval Status",
    Measured_Cane_Area,
    No_of_SR,
    Qty_Requested,
    Qty_Agri,
    Qty_Fin,
    Qty_Allocated,
    Qty_Delivered,
    NO_OF_PGIs,
    Qty_Pending,
    Ageing_Days,
    Min_Created_On,
    Max_Created_On,
    Current_Crop_Cycle,
    Planned_Date_Of_PC_Ratoon,
    Actual_Date_Of_Plant_Ratoon,
    Contract_Number,
    Is_Synch,
    Is_Company`;

  return `
    SELECT ${columns}
    FROM read_parquet(?)
    WHERE ${filters.clauses.join(" AND ")}
      AND ${statusFilter(status)}
    ORDER BY Region_Name, Sector_Name, Field_Number`;
}

// Build a grouped DuckDB query for the selected fertilizer summary level.
function summaryQuery(status, group, filters) {
  const groupColumns = GROUP_COLUMNS[group];
  if (!groupColumns) throw httpError(`Unsupported summary group: ${group}.`, 400);
  const groupSql = groupColumns.join(", ");

  return `
    SELECT
      ${groupSql},
      COUNT(DISTINCT Field_Number) AS Total_Fields,
      SUM(TRY_CAST(Measured_Cane_Area AS DOUBLE)) AS Total_Acreage,
      SUM(Qty_Requested) AS Quantity_Bags
    FROM read_parquet(?)
    WHERE ${filters.clauses.join(" AND ")}
      AND ${statusFilter(status)}
    GROUP BY ${groupSql.replaceAll(" AS Unit", "")}
    ORDER BY ${groupSql.replaceAll(" AS Unit", "")}`;
}

// Run only the fertilizer reports against the refreshed Parquet dataset.
export async function runParquetReport({ reportId, variant, group, query }) {
  const status = FERTILIZER_REPORTS[reportId];
  if (!status) throw httpError("This report is not configured for Parquet execution.", 500);

  const filters = buildParquetFilters(query);
  const sql = variant === "detailed"
    ? detailedQuery(status, filters)
    : summaryQuery(status, group, filters);
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