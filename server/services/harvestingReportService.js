import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sql from "mssql";
import loadConfig from "../config/env.js";

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const notebookPath = path.resolve(serviceDirectory, "../../reports/reports.ipynb");
const config = loadConfig();

const notebookCells = {
  dailyWeighment: {
    unit: 7,
    sector: 8,
    zone: 9,
    section: 10,
    detailed: 11,
    month: 13,
  },
  caneSupply: {
    unit: 13,
    sector: 14,
    zone: 15,
    section: 16,
    detailed: 16,
    month: 13,
  },
};

const summaryGroups = ["unit", "sector", "zone", "section", "month"];

function createError(message, statusCode = 503) {
  return Object.assign(new Error(message), { statusCode });
}

function normalize(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim().toUpperCase() : null;
}

function removeSqlMagic(source) {
  return source.replace(/^\s*%%sql\s*/i, "").trim().replace(/;\s*$/, "");
}

async function readNotebookQueries(reportId) {
  let notebook;
  try {
    notebook = JSON.parse(await fs.readFile(notebookPath, "utf8"));
  } catch {
    throw createError("The harvesting report notebook could not be loaded.", 500);
  }

  const cells = reportId === "cane-supply" ? notebookCells.caneSupply : notebookCells.dailyWeighment;
  return Object.fromEntries(Object.entries(cells).map(([key, cellIndex]) => {
    const cell = notebook.cells?.[cellIndex];
    const source = Array.isArray(cell?.source) ? cell.source.join("") : "";
    if (!source) throw createError(`Harvesting query cell ${cellIndex} is missing.`, 500);
    return [key, removeSqlMagic(source)];
  }));
}

function databaseConfig() {
  const database = config.harvestingDatabase;
  if (!database.server || !database.database || !database.user || !database.password) {
    throw createError(
      "Harvesting is not configured. Set REPORT_DB_SERVER, REPORT_DB_DATABASE, REPORT_DB_USER, and REPORT_DB_PASSWORD on the server.",
    );
  }
  return {
    server: database.server,
    database: database.database,
    user: database.user,
    password: database.password,
    connectionTimeout: database.connectionTimeout,
    requestTimeout: database.requestTimeout,
    options: {
      encrypt: database.encrypt,
      trustServerCertificate: database.trustServerCertificate,
    },
  };
}

function unitMatches(unitQuery, region, unit) {
  const selected = normalize(unitQuery);
  if (!selected) return true;
  if (selected === "NAITIRI") return ["KITALE", "MISIKHU", "NAITIRI"].includes(String(region || "").toUpperCase());
  if (selected === "OLEPITO") return String(region || "").toUpperCase() === "BUSIA";
  if (selected === "KABRAS") return String(unit || "").toUpperCase() === "WKS-KABRAS"
    || (!["KITALE", "MISIKHU", "NAITIRI", "BUSIA"].includes(String(region || "").toUpperCase()));
  return String(unit || region || "").toUpperCase() === selected;
}

function rowMatches(row, query) {
  const region = row.Region_Name ?? row.region;
  const unit = row.Unit ?? row.unit;
  const sector = row.Sector_Name ?? row["Sector Name"];
  const zone = row.Zone ?? row["Zone Name"];
  const section = row.Section_Name ?? row["Section Name"];
  const dateValue = row.GROSS_DT1 ?? row.Crush_Date ?? row["Month"];
  const date = dateValue ? new Date(dateValue).toISOString().slice(0, 10) : "";
  const from = normalize(query.dateFrom);
  const to = normalize(query.dateTo);
  return unitMatches(query.unit || query.plant, region, unit)
    && (!normalize(query.sector || query.region) || String(sector || "").toUpperCase() === normalize(query.sector || query.region))
    && (!normalize(query.zone) || String(zone || "").toUpperCase() === normalize(query.zone))
    && (!normalize(query.section) || String(section || "").toUpperCase() === normalize(query.section))
    && (!from || date >= from)
    && (!to || date <= to);
}

function normalizeRows(rows) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (typeof value === "bigint") return [key, Number(value)];
    if (value instanceof Date) return [key, value.toISOString()];
    return [key, value];
  })));
}

function normalizeDetailedResult(rows, columns) {
  const normalizedRows = rows.map((row) => {
    const { Region_Name: regionName, Sector_Name: sectorName, ...rest } = row;
    return {
      Unit: unitMatches("NAITIRI", regionName, "") ? "WKS-NAITIRI" : regionName?.toUpperCase() === "BUSIA" ? "WKS-OLEPITO" : "WKS-KABRAS",
      Sector: sectorName,
      ...rest,
    };
  });
  const normalizedColumns = columns.map((column) => {
    if (column === "Region_Name") return "Unit";
    if (column === "Sector_Name") return "Sector";
    return column;
  });
  return { normalizedRows, normalizedColumns };
}

function normalizeSummaryColumns(columns) {
  return columns.map((column) => column === "Sector Name" ? "Sector" : column);
}

function normalizeSummaryRows(rows) {
  return rows.map((row) => {
    if (!Object.prototype.hasOwnProperty.call(row, "Sector Name")) return row;
    const { ["Sector Name"]: sector, ...rest } = row;
    return { ...rest, Sector: sector };
  });
}

// Executes the exact SQL query stored in the selected notebook cell.
export async function queryHarvestingReport(query = {}) {
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const requestedGroup = query.group === "plant" ? "unit" : query.group;
  const group = summaryGroups.includes(requestedGroup) ? requestedGroup : "unit";
  const reportId = query.reportId === "cane-supply" ? "cane-supply" : "daily-weighment";
  const queries = await readNotebookQueries(reportId);
  const sqlText = queries[variant === "detailed" ? "detailed" : group] || queries.month;
  if (!sqlText) throw createError(`Harvesting query for ${reportId} is not available.`, 500);
  let pool;
  try {
    pool = await sql.connect(databaseConfig());
    const result = await pool.request().query(sqlText);
    const rows = normalizeRows(result.recordset).filter((row) => rowMatches(row, query));
    const detailedResult = variant === "detailed"
      ? normalizeDetailedResult(rows, Object.keys(result.recordset[0] || {}))
      : {
        normalizedRows: normalizeSummaryRows(rows),
        normalizedColumns: normalizeSummaryColumns(Object.keys(result.recordset[0] || {})),
      };
    return {
      reportId,
      variant,
      group: group,
      groupLabel: group[0].toUpperCase() + group.slice(1),
      filters: query,
      columns: detailedResult.normalizedColumns,
      rows: detailedResult.normalizedRows,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw createError(`Harvesting database query failed: ${error.message}`, 503);
  } finally {
    if (pool) await pool.close();
  }
}

export { summaryGroups };