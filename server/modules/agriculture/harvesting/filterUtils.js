const values = ["unit", "sector", "zone", "section", "dateFrom", "dateTo", "month"];

// The underlying notebook SQL scans from 2025-01-01 through "tomorrow" when
// no date filter is supplied, which forces a full-history aggregation on
// every unfiltered report load (observed taking 10-40+ seconds). When the
// caller hasn't picked a date range or month, default to a recent rolling
// window so first loads stay fast; users can still widen the range manually.
const DEFAULT_LOOKBACK_DAYS = 180;

export function normalizeValue(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim() : null;
}

export function normalizeFilters(query = {}) {
  const filters = Object.fromEntries(values.map((key) => [key, normalizeValue(query[key])]));
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw Object.assign(new Error("Date From cannot be after Date To."), { statusCode: 400 });
  }
  if (!filters.dateFrom && !filters.dateTo && !filters.month) {
    const defaultFrom = new Date();
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - DEFAULT_LOOKBACK_DAYS);
    filters.dateFrom = defaultFrom.toISOString().slice(0, 10);
  }
  return filters;
}

// Infers the location depth (unit/sector/zone/section) to group or pivot by,
// based on which location filters are selected. Month is a separate,
// orthogonal dimension (it controls the date window / pivot columns, not the
// location depth) and must not be conflated with the group here, otherwise
// a unit-level month view would incorrectly resolve to a "month" group and
// lose the ability to distinguish unit-only from sector-level results.
export function inferSummaryGroup(filters) {
  if (filters.section) return "section";
  if (filters.zone) return "zone";
  if (filters.sector) return "sector";
  return "unit";
}

export function queryParameters(filters) {
  const nextMonth = filters.month
    ? new Date(`${filters.month}-01T00:00:00Z`)
    : null;
  if (nextMonth) nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  return {
    Unit: filters.unit,
    Sector: filters.sector,
    Zone: filters.zone,
    Section: filters.section,
    DateFrom: filters.dateFrom,
    DateTo: filters.dateTo,
    SelectedMonth: filters.month ? `${filters.month}-01` : null,
    NextMonth: nextMonth ? nextMonth.toISOString().slice(0, 10) : null,
  };
}

export const harvestingLevels = ["unit", "sector", "zone", "section"];