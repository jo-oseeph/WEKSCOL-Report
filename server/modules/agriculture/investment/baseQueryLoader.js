import { loadCellRange } from "../harvesting/notebookLoader.js";
import { executeHarvestingQuery } from "../harvesting/sqlExecutor.js";

// The Investment/Overdue report's SQL source spans notebook cells 26-41:
// it builds a chain of temp tables (#FERT -> #HDR -> #POH -> #POM -> #VW2
// -> #BASE -> #PGI) before producing the final, ungrouped "base_result" rows
// (one row per field/material/PGI record). All statements must run in the
// same batch/session so the temp tables stay visible to later steps.
const BASE_QUERY_START_CELL = 26;
const BASE_QUERY_END_CELL = 41;

// Runs the full Investment base-data SQL pipeline against SQL Server and
// returns the raw, ungrouped rows (before merging with the CSV investment
// data or applying any location/cane-type filters).
export async function loadInvestmentBaseRows() {
  const batch = await loadCellRange(BASE_QUERY_START_CELL, BASE_QUERY_END_CELL);
  return executeHarvestingQuery(batch);
}
