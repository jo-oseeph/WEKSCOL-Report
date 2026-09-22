const values = ["unit", "sector", "zone", "section", "dateFrom", "dateTo", "month"];

export function normalizeValue(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim() : null;
}

export function normalizeFilters(query = {}) {
  const filters = Object.fromEntries(values.map((key) => [key, normalizeValue(query[key])]));
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw Object.assign(new Error("Date From cannot be after Date To."), { statusCode: 400 });
  }
  return filters;
}

export function inferSummaryGroup(filters) {
  if (filters.month) return "month";
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