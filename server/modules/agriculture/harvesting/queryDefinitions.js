export const queryDefinitions = {
  "daily-weighment": {
    detailed: { cell: 10, type: "sql" },
    summary: {
      unit: { cell: 6, type: "sql" },
      sector: { cell: 7, type: "sql" },
      zone: { cell: 8, type: "sql" },
      section: { cell: 9, type: "sql" },
    },
  },
  "cane-supply": {
    // Notebook cells 21-24 are the "Daily Detailed" report: each pivots net
    // weight into one column per day of a given month, at an increasing
    // location depth (unit only, +sector, +zone, +section). The "detailed"
    // variant of Cane Supply always uses one of these (defaulting to the
    // current month when the caller has not picked one) so a unit-level
    // view never implicitly pulls in a Sector column.
    detailedByMonth: {
      unit: { cell: 21, type: "python-sql" },
      sector: { cell: 22, type: "python-sql" },
      zone: { cell: 23, type: "python-sql" },
      section: { cell: 24, type: "python-sql" },
    },
    summary: {
      unit: { cell: 13, type: "sql" },
      sector: { cell: 14, type: "sql" },
      zone: { cell: 15, type: "sql" },
      section: { cell: 16, type: "sql" },
    },
  },
};

export function getDefinition(reportId, variant, group) {
  const report = queryDefinitions[reportId];
  if (!report) throw Object.assign(new Error(`Unsupported harvesting report: ${reportId}.`), { statusCode: 404 });
  let definition;
  if (variant === "detailed") {
    definition = report.detailed;
  } else if (variant === "detailedByMonth") {
    definition = report.detailedByMonth?.[group];
  } else {
    definition = report.summary?.[group];
  }
  if (!definition) throw Object.assign(new Error(`No ${group} ${variant} query is configured for ${reportId}.`), { statusCode: 400 });
  return definition;
}