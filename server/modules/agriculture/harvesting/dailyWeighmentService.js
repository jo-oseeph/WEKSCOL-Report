import { loadCell } from "./notebookLoader.js";
import { executeHarvestingQuery } from "./sqlExecutor.js";
import { getDefinition } from "./queryDefinitions.js";
import { inferSummaryGroup, normalizeFilters, queryParameters } from "./filterUtils.js";
import { injectDirectFilters } from "./sqlFilters.js";

// Normalizes Daily Weighment database rows for the report response.
function normalizeResult(result, variant, group, filters) {
  const columns = result.columns.map((column) => ({ Region_Name: "Unit", Sector_Name: "Sector", "Sector Name": "Sector" }[column] || column));
  const rows = result.rows.map((row) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => { normalized[{ Region_Name: "Unit", Sector_Name: "Sector", "Sector Name": "Sector" }[key] || key] = value; });
    return normalized;
  });
  return { variant, group, groupLabel: group[0].toUpperCase() + group.slice(1), filters, columns, rows };
}

export async function queryDailyWeighment(query = {}) {
  const filters = normalizeFilters(query);
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const group = variant === "summary" ? inferSummaryGroup(filters) : "detailed";
  const definition = getDefinition("daily-weighment", variant, group);
  const sqlText = await loadCell(definition.cell, definition.type);
  const filteredSql = injectDirectFilters(sqlText);
  const result = await executeHarvestingQuery(filteredSql, queryParameters(filters));
  return normalizeResult(result, variant, group, filters);
}