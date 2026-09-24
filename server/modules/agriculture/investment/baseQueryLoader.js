import { loadCellRange } from "../harvesting/notebookLoader.js";
import { executeHarvestingQuery } from "../harvesting/sqlExecutor.js";

// The Investment/Overdue report's SQL source spans notebook cells 26-41:
// it builds a chain of temp tables (#FERT -> #HDR -> #POH -> #POM -> #VW2
// -> #BASE -> #PGI) before producing the final, ungrouped "base_result" rows
// (one row per field/material/PGI record). All statements must run in the
// same batch/session so the temp tables stay visible to later steps.
const BASE_QUERY_START_CELL = 26;
const BASE_QUERY_END_CELL = 41;
// Filter dropdowns only need the report's fertilizer/header population and
// location attributes. Do not build #POH/#POM/#BASE/#PGI for this request.
const FILTER_QUERY_END_CELL = 30;

function reportSectorExpression(finalQuery) {
  const aliasIndex = finalQuery.search(/\bAS\s+Sector_Name\b/i);
  if (aliasIndex < 0) {
    throw Object.assign(new Error("The Investment report query does not define Sector_Name."), { statusCode: 500 });
  }

  // The report's sector mapping is the CASE expression immediately preceded
  // by `,CASE` in the final SELECT. Reuse that expression for filters instead
  // of creating a second, potentially divergent hierarchy mapping.
  const caseMatches = [...finalQuery.matchAll(/,\s*CASE\b/gi)]
    .filter((match) => match.index < aliasIndex);
  const caseStart = caseMatches.at(-1)?.index ?? -1;
  if (caseStart < 0) {
    throw Object.assign(new Error("The Investment report Sector_Name expression could not be extracted."), { statusCode: 500 });
  }
  return finalQuery.slice(caseStart + 1, aliasIndex).trim();
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function filterValue(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim() : null;
}

async function reportPredicates(query = {}) {
  const unit = filterValue(query.unit);
  const sector = filterValue(query.sector);
  const zone = filterValue(query.zone);
  const section = filterValue(query.section);
  const caneType = filterValue(query.caneType);
  const dateFrom = filterValue(query.dateFrom);
  const dateTo = filterValue(query.dateTo);
  if (![unit, sector, zone, section, caneType, dateFrom, dateTo].some(Boolean)) return [];

  const finalQuery = await loadCellRange(41, 41);
  const sectorExpression = reportSectorExpression(finalQuery).replace(/\bB\./g, "VW.");
  const unitExpression = `CASE
    WHEN VW.Region_Name IN ('NAITIRI','MISIKHU','KITALE') THEN 'WKS-NAITIRI'
    WHEN VW.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
    ELSE 'WKS-KABRAS'
  END`;
  const predicates = [];
  if (unit) predicates.push(`${unitExpression} = ${sqlText(unit)}`);
  if (sector) predicates.push(`${sectorExpression} = ${sqlText(sector)}`);
  if (zone) predicates.push(`VW.Zone_Name = ${sqlText(zone)}`);
  if (section) predicates.push(`VW.Section_Name = ${sqlText(section)}`);
  if (caneType) {
    if (caneType.toLowerCase() === "seed cane") predicates.push("MM.Description LIKE '%SEED CANE%'");
    else if (caneType.toLowerCase() === "mill cane") predicates.push("MM.Description LIKE '%MILL CANE%'");
    else predicates.push("MM.Description NOT LIKE '%SEED CANE%' AND MM.Description NOT LIKE '%MILL CANE%'");
  }
  if (dateFrom) predicates.push(`F.Created_On >= ${sqlText(dateFrom)}`);
  if (dateTo) predicates.push(`F.Created_On < DATEADD(DAY, 1, ${sqlText(dateTo)})`);
  return predicates;
}

async function earlyReportPredicates(query = {}) {
  const unit = filterValue(query.unit);
  const sector = filterValue(query.sector);
  const zone = filterValue(query.zone);
  const section = filterValue(query.section);
  const caneType = filterValue(query.caneType);
  const dateFrom = filterValue(query.dateFrom);
  const dateTo = filterValue(query.dateTo);
  const finalQuery = unit || sector || zone || section
    ? await loadCellRange(41, 41)
    : "";
  const sectorExpression = finalQuery
    ? reportSectorExpression(finalQuery).replace(/\bB\./g, "VW.")
    : "";
  const unitExpression = `CASE
    WHEN VW.Region_Name IN ('NAITIRI','MISIKHU','KITALE') THEN 'WKS-NAITIRI'
    WHEN VW.Region_Name = 'BUSIA' THEN 'WKS-OLEPITO'
    ELSE 'WKS-KABRAS'
  END`;
  const fertPredicates = [];
  if (dateFrom) fertPredicates.push(`A.Created_On >= ${sqlText(dateFrom)}`);
  if (dateTo) fertPredicates.push(`A.Created_On < DATEADD(DAY, 1, ${sqlText(dateTo)})`);
  if (caneType) {
    const materialCondition = caneType.toLowerCase() === "seed cane"
      ? "MM.Description LIKE '%SEED CANE%'"
      : caneType.toLowerCase() === "mill cane"
        ? "MM.Description LIKE '%MILL CANE%'"
        : "MM.Description NOT LIKE '%SEED CANE%' AND MM.Description NOT LIKE '%MILL CANE%'";
    fertPredicates.push(`EXISTS (SELECT 1 FROM MD_MATERIAL_MASTER MM WHERE MM.Material_Master_ID = A.Item_ID AND ${materialCondition})`);
  }
  const locationPredicates = [];
  if (unit) locationPredicates.push(`${unitExpression} = ${sqlText(unit)}`);
  if (sector) locationPredicates.push(`${sectorExpression} = ${sqlText(sector)}`);
  if (zone) locationPredicates.push(`VW.Zone_Name = ${sqlText(zone)}`);
  if (section) locationPredicates.push(`VW.Section_Name = ${sqlText(section)}`);
  return {
    fert: fertPredicates,
    header: locationPredicates.length
      ? `EXISTS (
    SELECT 1
    FROM DT_BUS_PARTNER_LOCATION_ATTRIBUTES D
    LEFT JOIN vW_Village_Related_Data VW
      ON D.village_id = VW.Village_ID
    WHERE D.LeadOpportunity_ID = REPLACE(MH.Field_Number,'FN-','')
      AND ${locationPredicates.join("\n      AND ")}
  )`
      : null,
  };
}

// Runs the full Investment base-data SQL pipeline against SQL Server and
// returns the raw, ungrouped rows (before merging with the CSV investment
// data or applying any location/cane-type filters).
export async function loadInvestmentBaseRows(query = {}) {
  const predicates = await reportPredicates(query);
  const earlyPredicates = await earlyReportPredicates(query);
  const cellIndexes = [26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];
  const cells = Object.fromEntries(await Promise.all(
    cellIndexes.map(async (index) => [index, await loadCellRange(index, index)]),
  ));
  let fertCell = cells[27];
  let headerCell = cells[29];
  if (earlyPredicates.fert.length) {
    fertCell = fertCell.replace(
      /;\s*$/,
      `\n  AND ${earlyPredicates.fert.join("\n  AND ")}\n;`,
    );
  }
  if (earlyPredicates.header) {
    headerCell = headerCell.replace(
      /;\s*$/,
      `\nWHERE\n      ${earlyPredicates.header}\n;`,
    );
  }
  const beforeBase = [
    cells[26], fertCell, cells[28], headerCell, cells[30], cells[31],
    cells[32], cells[33], cells[34], cells[35], cells[36],
  ].join(";\n\n");
  let baseCell = cells[37];
  const afterBase = [cells[38], cells[39], cells[40], cells[41]].join(";\n\n");
  if (predicates.length) {
    // Cell 37 is the notebook statement that creates #BASE. Inject the
    // predicates before its terminating semicolon so the existing report
    // joins and aliases remain authoritative and PGI only sees matching
    // process-order materials in cells 39-41.
    baseCell = baseCell.replace(
      /;\s*$/,
      `\nWHERE\n       ${predicates.join("\n  AND ")}\n;`,
    );
  }
  const batch = [beforeBase, baseCell, afterBase].join(";\n\n");
  return executeHarvestingQuery(batch);
}

// Loads only the notebook's #BASE pipeline and returns distinct hierarchy
// values for the filter controls. The expensive #PGI pipeline and final
// detailed result cells are intentionally not executed for this request.
export async function loadInvestmentLocationRows() {
  const [baseBatch, finalQuery] = await Promise.all([
    loadCellRange(BASE_QUERY_START_CELL, FILTER_QUERY_END_CELL),
    loadCellRange(41, 41),
  ]);
  const sectorExpression = reportSectorExpression(finalQuery).replace(/\bB\./g, "VW.");
  const filterQuery = `${baseBatch};\n\nSELECT DISTINCT
    VW.Region_Name AS Region_Name,
    ${sectorExpression} AS Sector_Name,
    VW.Zone_Name AS Zone_Name,
    VW.Section_Name AS Section_Name,
    VW.PlantName2 AS Unit_name
FROM #HDR H
INNER JOIN DT_BUS_PARTNER_LOCATION_ATTRIBUTES D
    ON H.Lead_no = D.LeadOpportunity_ID
LEFT JOIN vW_Village_Related_Data VW
    ON D.village_id = VW.Village_ID
ORDER BY VW.Region_Name, Sector_Name, VW.Zone_Name, VW.Section_Name, VW.PlantName2`;
  return executeHarvestingQuery(filterQuery);
}
