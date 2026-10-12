import { httpError } from "../../shared/errors.js";

const LOCATION_FILTERS = ["unit", "sector", "zone", "section"];
const SUMMARY_PARENT_FILTERS = {
  unit: [],
  sector: ["unit"],
  zone: ["unit", "sector"],
  section: ["unit", "sector", "zone"],
};

export default function resolveVariant(definition, query = {}) {
  const variant = query.variant || "detailed";
  if (!definition.variants.includes(variant)) {
    throw httpError(`Unsupported report variant: ${variant}.`, 400);
  }

  const group = ["harvesting", "service-request", "plantation"].includes(definition.queryModule)
    ? query.group || inferLocationGroup(query)
    : query.group || (variant !== "detailed" ? "unit" : null);

  if (variant !== "detailed" && !definition.summaryGroups.includes(group)) {
    throw httpError(`Unsupported summary group: ${group}.`, 400);
  }

  return { variant, group };
}

export function scopeSummaryQuery(query = {}, group = "unit") {
  const allowedParentFilters = new Set(SUMMARY_PARENT_FILTERS[group] || SUMMARY_PARENT_FILTERS.unit);

  return Object.fromEntries(
    Object.entries(query).filter(([key]) => (
      !LOCATION_FILTERS.includes(key) || allowedParentFilters.has(key)
    )),
  );
}

function inferLocationGroup(query) {
  if (query.section && query.section !== "all") return "section";
  if (query.zone && query.zone !== "all") return "zone";
  if (query.sector && query.sector !== "all") return "sector";
  if (query.unit && query.unit !== "all") return "unit";
  return "unit";
}