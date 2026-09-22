import { loadCell } from "./notebookLoader.js";
import { executeHarvestingQuery } from "./sqlExecutor.js";
import { queryDailyWeighment } from "./dailyWeighmentService.js";
import { queryCaneSupply } from "./caneSupplyService.js";

// Routes harvesting report requests to the appropriate report implementation.
export async function queryHarvestingReport(query = {}) {
  if (query.reportId === "daily-weighment") return queryDailyWeighment(query);
  if (query.reportId === "cane-supply") return queryCaneSupply(query);
  throw Object.assign(new Error("Unsupported harvesting report."), { statusCode: 404 });
}

// Loads the distinct harvesting locations used by the report filters.
export async function getHarvestingFilters() {
  const source = await loadCell(6);
  const selectIndex = source.lastIndexOf("\nSELECT");
  if (selectIndex < 0) {
    throw Object.assign(new Error("The Daily Weighment Unit query cannot be used to load harvesting filters."), { statusCode: 500 });
  }

  const filterQuery = `${source.slice(0, selectIndex)}
SELECT DISTINCT
    Unit,
    Sector_Name AS Sector,
    Zone,
    Section_Name AS Section
FROM flagged
ORDER BY Unit, Sector, Zone, Section`;
  const result = await executeHarvestingQuery(filterQuery);
  const locations = result.rows.map((row) => ({
    unit: row.Unit,
    sector: row.Sector,
    zone: row.Zone,
    section: row.Section,
  }));

  return {
    units: [...new Set(locations.map((location) => location.unit).filter(Boolean))],
    locations,
  };
}