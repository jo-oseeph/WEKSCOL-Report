import { httpError } from "../../shared/errors.js";

export default function resolveVariant(definition, query = {}) {
  const variant = query.variant || "detailed";
  if (!definition.variants.includes(variant)) {
    throw httpError(`Unsupported report variant: ${variant}.`, 400);
  }

  const group = ["harvesting", "service-request"].includes(definition.queryModule)
    ? query.group || inferLocationGroup(query)
    : query.group || (variant !== "detailed" ? "unit" : null);

  if (variant !== "detailed" && !definition.summaryGroups.includes(group)) {
    throw httpError(`Unsupported summary group: ${group}.`, 400);
  }

  return { variant, group };
}

function inferLocationGroup(query) {
  if (query.section && query.section !== "all") return "section";
  if (query.zone && query.zone !== "all") return "zone";
  if (query.sector && query.sector !== "all") return "sector";
  if (query.unit && query.unit !== "all") return "sector";
  return "unit";
}