import { loadCell } from "./notebookLoader.js";
import { executeHarvestingQuery } from "./sqlExecutor.js";
import { getDefinition } from "./queryDefinitions.js";
import { inferSummaryGroup, normalizeFilters, queryParameters } from "./filterUtils.js";
import { injectDirectFilters, injectMonthlyFilters } from "./sqlFilters.js";

function normalizeResult(result, variant, group, filters) {
  const columns = result.columns.map((column) => column === "Sector Name" ? "Sector" : column);
  const rows = result.rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key === "Sector Name" ? "Sector" : key, value])));
  return { variant, group, groupLabel: group[0].toUpperCase() + group.slice(1), filters, columns, rows };
}

export async function queryCaneSupply(query = {}) {
  const filters = normalizeFilters(query);
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const group = variant === "summary" ? inferSummaryGroup(filters) : "detailed";
  const definition = getDefinition("cane-supply", variant, group);
  const sqlText = await loadCell(definition.cell, definition.type);
  const filteredSql = definition.type === "python-sql"
    ? injectMonthlyFilters(sqlText.replace(/DECLARE @MonthStart DATE = \?;/i, "DECLARE @MonthStart DATE = @SelectedMonth"), filters)
    : injectDirectFilters(sqlText);
  const result = await executeHarvestingQuery(filteredSql, queryParameters(filters));
  return normalizeResult(result, variant, group, filters);
}