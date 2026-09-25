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

// The unit/sector/zone/section hierarchy changes rarely, so the filter list
// is cached in-memory for a short period. This avoids re-running a heavy,

const FILTERS_CACHE_TTL_MS = 15 * 60 * 1000;
let filtersCache = null;
let filtersCacheExpiresAt = 0;
let filtersCacheInFlight = null;

async function loadHarvestingFilters() {
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

// Loads the distinct harvesting locations used by the report filters,
// serving a cached copy when available and coalescing concurrent requests
// into a single upstream query.
export async function getHarvestingFilters({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && filtersCache && now < filtersCacheExpiresAt) {
    return filtersCache;
  }

  if (!filtersCacheInFlight) {
    filtersCacheInFlight = loadHarvestingFilters()
      .then((filters) => {
        filtersCache = filters;
        filtersCacheExpiresAt = Date.now() + FILTERS_CACHE_TTL_MS;
        return filters;
      })
      .finally(() => {
        filtersCacheInFlight = null;
      });
  }

  try {
    return await filtersCacheInFlight;
  } catch (error) {
    // Fall back to a stale cached copy rather than failing the whole page
    // if a refresh attempt fails but we have older data to show.
    if (filtersCache) return filtersCache;
    throw error;
  }
}