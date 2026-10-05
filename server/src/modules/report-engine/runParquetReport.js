import { executeParquetQuery } from "../../db/parquetDb/connection.js";
import { httpError } from "../../shared/errors.js";

const FERTILIZER_REPORTS = {
  "fertilizer-pending": "pending",
  "fertilizer-approved": "approved",
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

// Build the shared location and date filters used by all fertilizer variants.
function buildParquetFilters(query) {
  const clauses = [FERTILIZER_FILTER];
  const parameters = ["__PARQUET_PATH__"];

  addFilter(clauses, parameters, "Unit_name", query.unit);
  addFilter(clauses, parameters, "Sector_Name", query.sector);
  addFilter(clauses, parameters, "Zone_Name", query.zone);
  addFilter(clauses, parameters, "Section_Name", query.section);
  addFilter(clauses, parameters, "Min_Created_On", query.dateFrom, ">=");
  addFilter(clauses, parameters, "Min_Created_On", query.dateTo, "<");

  if (query.dateTo !== undefined && query.dateTo !== "" && query.dateTo !== "all") {
    parameters[parameters.length - 1] = `${query.dateTo}T23:59:59.999Z`;
  }

  return { clauses, parameters };
}

// Build the report-specific approval or delivery predicate for fertilizer data.
function statusFilter(status) {
  if (status === "approved") {
    return "Qty_Agri IS NOT NULL AND Qty_Fin IS NOT NULL AND Qty_Agri = Qty_Fin AND Qty_Agri > 0";
  }
  if (status === "issued") return "COALESCE(Qty_Delivered, 0) > 0";
  return "Qty_Agri IS NULL OR Qty_Fin IS NULL";
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
      WHEN Qty_Fin > 0 AND Qty_Agri > 0 AND Qty_Fin = Qty_Agri THEN 'Finance Approved'
      WHEN Qty_Agri > 0 AND (Qty_Fin IS NULL OR Qty_Fin = 0) THEN 'Agri Approved'
      WHEN Qty_Agri IS NULL OR Qty_Agri = 0 THEN 'Pending Agriculture Approval'
      ELSE 'Pending'
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