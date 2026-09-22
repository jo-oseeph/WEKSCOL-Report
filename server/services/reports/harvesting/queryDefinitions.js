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
    detailed: { cell: 17, type: "sql" },
    summary: {
      unit: { cell: 13, type: "sql" },
      sector: { cell: 14, type: "sql" },
      zone: { cell: 15, type: "sql" },
      section: { cell: 16, type: "sql" },
      month: { cell: 21, type: "python-sql" },
    },
  },
};

export function getDefinition(reportId, variant, group) {
  const report = queryDefinitions[reportId];
  if (!report) throw Object.assign(new Error(`Unsupported harvesting report: ${reportId}.`), { statusCode: 404 });
  const definition = variant === "detailed" ? report.detailed : report.summary[group];
  if (!definition) throw Object.assign(new Error(`No ${group} ${variant} query is configured for ${reportId}.`), { statusCode: 400 });
  return definition;
}