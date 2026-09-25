import { loadCell } from "./notebookLoader.js";
import { executeHarvestingQuery } from "./sqlExecutor.js";
import { getDefinition } from "./queryDefinitions.js";
import { inferSummaryGroup, normalizeFilters, normalizeValue, queryParameters } from "./filterUtils.js";
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

// Formats a "YYYY-MM" value as a human-readable month/year label (e.g.
// "August 2026") so the client can show which month a Daily Detailed report
// covers, without needing its own date-formatting logic.
function monthLabelFor(monthValue) {
  if (!monthValue) return null;
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Normalizes Cane Supply database rows for the report response.
function normalizeResult(result, variant, group, filters) {
  const renamedColumns = result.columns.map(normalizeLocationColumnName);
  const columns = reorderLocationColumnsFirst(renamedColumns);
  const rows = result.rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeLocationColumnName(key), value]),
  ));
  return {
    variant,
    group,
    groupLabel: group[0].toUpperCase() + group.slice(1),
    filters,
    monthLabel: variant === "detailed" ? monthLabelFor(filters.month) : null,
    columns,
    rows,
  };
}

// Formats a Date as "YYYY-MM" (the same shape the client's <input type="month">
// previously sent), used to default the Daily Detailed report to the
// current month when the user has not picked any date.
function currentMonthValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Extracts the "YYYY-MM" portion of a "YYYY-MM-DD" date string.
function monthOf(dateString) {
  return dateString.slice(0, 7);
}

// The Cane Supply "Daily Detailed" report only has a single Date Range
// filter (Date From / Date To) -- there is no separate "Month" field. Both
// dates must fall within the same calendar month, since the underlying
// pivot query (notebook cells 21-24) always reports a full month, one
// column per day. When only one date is given, that date's month is used;
// when neither is given, the current month is used.
function resolveMonthFromDateRange(filters) {
  if (filters.dateFrom && filters.dateTo) {
    if (monthOf(filters.dateFrom) !== monthOf(filters.dateTo)) {
      throw Object.assign(
        new Error("Date From and Date To must be within the same month for the Cane Supply Daily Detailed report."),
        { statusCode: 400 },
      );
    }
    return monthOf(filters.dateFrom);
  }
  if (filters.dateFrom) return monthOf(filters.dateFrom);
  if (filters.dateTo) return monthOf(filters.dateTo);
  return currentMonthValue();
}

export async function queryCaneSupply(query = {}) {
  const variant = query.variant === "summary" ? "summary" : "detailed";
  // Read the raw Date From/To before normalizeFilters() applies its 180-day
  // lookback default (that default exists for other report paths and would
  // otherwise be mistaken for a user-selected date when resolving the month
  // below).
  const rawDateFrom = normalizeValue(query.dateFrom);
  const rawDateTo = normalizeValue(query.dateTo);

  const filters = normalizeFilters(query);
  const group = inferSummaryGroup(filters);

  // The "Daily Detailed" report (notebook cells 21-24) pivots net weight
  // into one column per day of a given month, at the location depth the
  // user picked (unit only, +sector, +zone, +section). This is always the
  // correct query for the "detailed" variant of Cane Supply. The month to
  // pivot on is derived from the Date From / Date To range (validated to be
  // within the same month above); Date From/To are then cleared so the
  // pivot always returns the full month rather than only the selected days.
  if (variant === "detailed") {
    filters.month = resolveMonthFromDateRange({ dateFrom: rawDateFrom, dateTo: rawDateTo });
    filters.dateFrom = null;
    filters.dateTo = null;
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