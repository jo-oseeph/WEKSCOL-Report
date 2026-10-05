import { loadModules } from "../loadModules.js";
import buildFilters from "./buildFilters.js";
import resolveVariant from "./resolveVariant.js";
import normalizeRows from "./normalizeRows.js";
import { httpError } from "../../shared/errors.js";
import { runInvestmentQuery } from "../agriculture/investment/investment.query.js";
import { runHarvestingQuery } from "../agriculture/harvesting/harvesting.query.js";
import { runServiceRequestQuery } from "../agriculture/service-request/service-request.query.js";
import { runParquetReport } from "./runParquetReport.js";

export default async function runReport(reportId, query = {}) {
  const { reports } = await loadModules();
  const definition = reports.get(reportId);
  if (!definition) throw httpError("Report not found.", 404);

  const { variant, group } = resolveVariant(definition, query);
  let filters = { parameters: {} };
  let result;
  if (definition.backend === "parquet") {
    result = await runParquetReport({ reportId, variant, group, query });
    filters = { parameters: result.parameters };
  } else {
    filters = buildFilters(definition, query);
  }
  const queryRunners = {
    harvesting: runHarvestingQuery,
    investment: runInvestmentQuery,
    "service-request": runServiceRequestQuery,
  };
  const queryRunner = queryRunners[definition.queryModule] || runInvestmentQuery;
  if (definition.backend !== "parquet") {
    result = await queryRunner({
      reportId,
      variant,
      group,
      clauses: filters.clauses,
      parameters: filters.parameters,
    });
  }
  const rows = normalizeRows(result.rows);
  const monthSource = query.dateFrom || new Date().toISOString().slice(0, 10);
  const monthLabel = definition.id === "cane-supply"
    ? new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${monthSource.slice(0, 7)}-01T00:00:00Z`))
    : null;

  return {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    variant,
    variants: definition.variants,
    variantLabels: definition.variantLabels || {},
    group,
    groupLabel: group ? `${group[0].toUpperCase()}${group.slice(1)}` : null,
    monthLabel,
    filters: filters.parameters,
    columns: result.columns,
    rows,
  };
}