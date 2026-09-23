import { loadCell } from "./notebookLoader.js";
import { executeHarvestingQuery } from "./sqlExecutor.js";
import { getDefinition } from "./queryDefinitions.js";
import { inferSummaryGroup, normalizeFilters, queryParameters } from "./filterUtils.js";
import { injectDirectFilters, injectMonthlyFilters } from "./sqlFilters.js";

// The notebook queries alias the location columns inconsistently (e.g.
// "Sector Name", "Zone Name", "Section Name" in the pivot queries vs. plain
// "Sector" elsewhere). Normalize all of them to their short form so the
// report consistently shows "Unit", "Sector", "Zone", "Section".
const LOCATION_COLUMN_ALIASES = {
  "Sector Name": "Sector",
  "Zone Name": "Zone",
  "Section Name": "Section",
};

function normalizeLocationColumnName(name) {
  return LOCATION_COLUMN_ALIASES[name] || name;
}

// SQL Server's PIVOT always places the pivoted (day-of-month) columns before
// the grouping columns in the result set, even though the outer SELECT lists
// the grouping columns first. This puts Unit/Sector/Zone/Section location
// columns last in the response, so the report table showed them on the
// right. This ordering brings any location columns to the front, preserving
// the original order of the remaining (day-number) columns.
const LOCATION_COLUMN_ORDER = ["Unit", "Sector", "Zone", "Section"];

function reorderLocationColumnsFirst(columns) {
  const locationColumns = LOCATION_COLUMN_ORDER.filter((name) => columns.includes(name));
  const otherColumns = columns.filter((name) => !LOCATION_COLUMN_ORDER.includes(name));
  return [...locationColumns, ...otherColumns];
}

// Normalizes Cane Supply database rows for the report response.
function normalizeResult(result, variant, group, filters) {
  const renamedColumns = result.columns.map(normalizeLocationColumnName);
  const columns = reorderLocationColumnsFirst(renamedColumns);
  const rows = result.rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeLocationColumnName(key), value]),
  ));
  return { variant, group, groupLabel: group[0].toUpperCase() + group.slice(1), filters, columns, rows };
}

// Formats a Date as "YYYY-MM" (the same shape the client's <input type="month">
// sends), used to default the Daily Detailed report to the current month
// when the user has not explicitly picked one.
function currentMonthValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function queryCaneSupply(query = {}) {
  const filters = normalizeFilters(query);
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const group = inferSummaryGroup(filters);

  // The "Daily Detailed" report (notebook cells 21-24) pivots net weight
  // into one column per day of a given month, at the location depth the
  // user picked (unit only, +sector, +zone, +section). This is always the
  // correct query for the "detailed" variant of Cane Supply -- previously it
  // only ran when a month was explicitly chosen, and otherwise fell back to
  // a flat listing (cell 17) that always groups by Unit + Sector, which is
  // why a unit-level report kept showing a Sector column even when Sector
  // was never selected. Defaulting to the current month whenever the caller
  // hasn't picked one keeps the "Daily Detailed" pivot in effect for every
  // detailed request, regardless of whether a month was chosen.
  if (variant === "detailed" && !filters.month) {
    filters.month = currentMonthValue();
  }

  const definitionVariant = variant === "detailed" ? "detailedByMonth" : "summary";
  const definition = getDefinition("cane-supply", definitionVariant, group);
  const sqlText = await loadCell(definition.cell, definition.type);
  const filteredSql = definition.type === "python-sql"
    ? injectMonthlyFilters(sqlText.replace(/DECLARE @MonthStart DATE = \?;/i, "DECLARE @MonthStart DATE = @SelectedMonth"), filters)
    : injectDirectFilters(sqlText);
  const result = await executeHarvestingQuery(filteredSql, queryParameters(filters));
  return normalizeResult(result, variant, group, filters);
}