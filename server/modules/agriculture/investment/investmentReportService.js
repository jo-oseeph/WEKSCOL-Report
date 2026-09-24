import { loadInvestmentBaseRows } from "./baseQueryLoader.js";
import { getFarmerInvestmentSummary } from "./investmentCsvLoader.js";

const CACHE_TTL_MS = 15 * 60 * 1000;
const GROUPS = ["unit", "sector", "zone", "section"];

let baseCache = null;
let baseCacheExpiresAt = 0;
let baseInFlight = null;

function createError(message, statusCode = 500) {
  return Object.assign(new Error(message), { statusCode });
}

function normalizeText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeId(value) {
  const text = normalizeText(value);
  const digits = text.match(/\d+/g)?.join("") || text;
  return digits.replace(/^0+(?=\d)/, "");
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function columnLookup(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
}

function rowValue(row, ...names) {
  const lookup = row.__lookup || columnLookup(row);
  for (const name of names) {
    const value = lookup[name.toLowerCase()];
    if (value !== undefined && value !== null) return value;
  }
  return "";
}

function normalizeBaseRow(row) {
  return {
    fieldNumber: normalizeText(rowValue(row, "Field_Number", "Field Number")),
    idNumber: normalizeId(rowValue(row, "ID_Number", "ID Number")),
    farmerName: normalizeText(rowValue(row, "First_Name", "First Name")),
    description: normalizeText(rowValue(row, "Description")),
    regionName: normalizeText(rowValue(row, "Region_Name", "Region Name", "Region")),
    sector: normalizeText(rowValue(row, "Sector_Name", "Sector Name", "Sector")),
    zone: normalizeText(rowValue(row, "Zone_Name", "Zone Name", "Zone")),
    section: normalizeText(rowValue(row, "Section_Name", "Section Name", "Section")),
    village: normalizeText(rowValue(row, "Village_Name", "Village Name", "Village")),
    approvalStatus: normalizeText(rowValue(row, "Approval Status")),
    qtyRequested: numberValue(rowValue(row, "Qty_Requested", "Qty Requested")),
    qtyAgri: numberValue(rowValue(row, "Qty_Agri", "Qty Agri")),
    qtyFin: numberValue(rowValue(row, "Qty_Fin", "Qty Fin")),
    qtyAllocated: numberValue(rowValue(row, "Qty_Allocated", "Qty Allocated")),
    qtyDelivered: numberValue(rowValue(row, "Qty_Delivered", "Qty Delivered")),
    qtyPending: numberValue(rowValue(row, "Qty_Pending", "Qty Pending")),
    ageingDays: numberValue(rowValue(row, "Ageing_Days", "Ageing Days")),
    createdOn: normalizeDate(rowValue(row, "Min_Created_On", "Created_On", "Created On")),
    unit: deriveUnit(rowValue(row, "Region_Name", "Region Name", "Region")),
  };
}

function normalizeCsvRow(row) {
  return {
    idNumber: normalizeId(rowValue(row, "ID_Number", "ID Number")),
    farmerName: normalizeText(rowValue(row, "Farmer_Name", "Farmer Name")),
    totalInvestment: numberValue(rowValue(row, "Total_Investment", "Total Investment")),
    cirPending: numberValue(rowValue(row, "CIR_Pending", "CIR Pending")),
    overdueAmount: numberValue(rowValue(row, "Overdue_Amount", "Overdue Amount")),
    investmentFlag: normalizeText(rowValue(row, "Investment_Flag", "Investment Flag")),
    ccRemarks: normalizeText(rowValue(row, "CC_Remarks", "CC Remarks")),
  };
}

async function loadBaseRows() {
  const now = Date.now();
  if (baseCache && now < baseCacheExpiresAt) return baseCache;
  if (!baseInFlight) {
    baseInFlight = loadInvestmentBaseRows()
      .then((result) => {
        if (!result || !Array.isArray(result.rows)) {
          throw createError("The Investment SQL query returned no usable rows.", 500);
        }
        const rows = result.rows.map(normalizeBaseRow);
        if (!rows.length) {
          throw createError("The Investment SQL data source returned no records.", 503);
        }
        baseCache = rows;
        baseCacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return rows;
      })
      .finally(() => {
        baseInFlight = null;
      });
  }
  try {
    return await baseInFlight;
  } catch (error) {
    if (baseCache) return baseCache;
    throw error;
  }
}

function filterValue(value) {
  return typeof value === "string" && value.trim() && value !== "all" ? value.trim() : null;
}

function matches(value, selected) {
  return !selected || normalizeText(value).toLowerCase() === selected.toLowerCase();
}

function deriveUnit(regionName) {
  const region = normalizeText(regionName).toUpperCase();
  if (["NAITIRI", "MISIKHU", "KITALE"].includes(region)) return "WKS-NAITIRI";
  if (region === "BUSIA") return "WKS-OLEPITO";
  return "WKS-KABRAS";
}

function deriveCaneType(description) {
  const text = normalizeText(description);
  if (/seed cane/i.test(text)) return "Seed Cane";
  if (/mill cane/i.test(text)) return "Mill Cane";
  return "Other";
}

function applyFilters(rows, query) {
  const filters = {
    unit: filterValue(query.unit),
    sector: filterValue(query.sector),
    zone: filterValue(query.zone),
    section: filterValue(query.section),
    caneType: filterValue(query.caneType),
    dateFrom: filterValue(query.dateFrom),
    dateTo: filterValue(query.dateTo),
  };
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    throw createError("Date From cannot be after Date To.", 400);
  }
  return {
    filters,
    rows: rows.filter((row) => {
      const caneType = deriveCaneType(row.description);
      return matches(row.unit, filters.unit)
        && matches(row.sector, filters.sector)
        && matches(row.zone, filters.zone)
        && matches(row.section, filters.section)
          && (!filters.caneType || caneType.toLowerCase() === filters.caneType.toLowerCase());
    }),
  };
}

function round(value) {
  return Number(value.toFixed(2));
}

function sumRows(rows) {
  return {
    totalInvestment: round(rows.reduce((sum, row) => sum + (row.investment?.totalInvestment || 0), 0)),
    cirPending: round(rows.reduce((sum, row) => sum + (row.investment?.cirPending || 0), 0)),
    overdueAmount: round(rows.reduce((sum, row) => sum + (row.investment?.overdueAmount || 0), 0)),
    overdueFarmers: new Set(rows.filter((row) => row.investment?.investmentFlag === "Overdue").map((row) => row.idNumber)).size,
    farmersWithInvestment: new Set(rows.filter((row) => row.investment?.investmentFlag).map((row) => row.idNumber)).size,
  };
}

function buildDetailedRows(rows) {
  return rows.map((row) => ({
    Unit: row.unit,
    Sector: row.sector,
    Zone: row.zone,
    Section: row.section,
    Field_Number: row.fieldNumber,
    ID_Number: row.idNumber,
    First_Name: row.farmerName,
    Cane_Type: deriveCaneType(row.description),
    Description: row.description,
    Village: row.village,
    Approval_Status: row.approvalStatus,
    Qty_Requested: row.qtyRequested,
    Qty_Agri: row.qtyAgri,
    Qty_Fin: row.qtyFin,
    Qty_Allocated: row.qtyAllocated,
    Qty_Delivered: row.qtyDelivered,
    Qty_Pending: row.qtyPending,
    Ageing_Days: row.ageingDays,
    Farmer_Name: row.investment?.farmerName || "",
    Total_Investment: row.investment?.totalInvestment ?? null,
    CIR_Pending: row.investment?.cirPending ?? null,
    Overdue_Amount: row.investment?.overdueAmount ?? null,
    Investment_Flag: row.investment?.investmentFlag || "",
    CC_Remarks: row.investment?.ccRemarks || "",
    Min_Created_On: row.createdOn,
  }));
}

function selectedSummaryGroup(filters) {
  if (filters.section) return "section";
  if (filters.zone) return "zone";
  if (filters.sector) return "sector";
  return "unit";
}

function buildSummaryRows(rows, group) {
  const groupIndex = GROUPS.indexOf(group);
  const keys = GROUPS.slice(0, groupIndex + 1);
  const buckets = new Map();

  // Notebook cell 48 first removes duplicate farmers for the selected
  // hierarchy, then aggregates the farmer-level investment totals.
  const deduplicated = new Map();
  rows.forEach((row) => {
    const farmerKey = `${keys.map((field) => row[field]).join("\u001f")}\u001f${row.idNumber}`;
    if (!deduplicated.has(farmerKey)) deduplicated.set(farmerKey, row);
  });

  [...deduplicated.values()].forEach((row) => {
    const key = keys.map((field) => row[field]).join("\u001f");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  });

  const summaryRows = [...buckets.values()].map((bucket) => {
    const totals = sumRows(bucket);
    const row = {};
    keys.forEach((key) => {
      row[key[0].toUpperCase() + key.slice(1)] = bucket[0][key];
    });
    Object.assign(row, {
      Total_Farmers: new Set(bucket.map((item) => item.idNumber)).size,
      Farmers_With_Investment: totals.farmersWithInvestment,
      Farmers_Overdue: totals.overdueFarmers,
      Total_Investment: totals.totalInvestment,
      CIR_Pending: totals.cirPending,
      Overdue_Amount: totals.overdueAmount,
      Recovery_Rate: totals.totalInvestment
        ? Number(((totals.totalInvestment - totals.cirPending) / totals.totalInvestment * 100).toFixed(2))
        : null,
    });
    return row;
  });

  return {
    rows: summaryRows,
    groupLabel: keys.map((key) => key[0].toUpperCase() + key.slice(1)).join(" → "),
  };
}

async function loadJoinedRows() {
  const [baseRows, csvRows] = await Promise.all([loadBaseRows(), getFarmerInvestmentSummary()]);
  if (!csvRows?.length) throw createError("The Investment Dashboard data source returned no farmer summaries.", 503);
  const investmentById = new Map(csvRows.map((row) => {
    const normalized = normalizeCsvRow(row);
    return [normalized.idNumber, normalized];
  }));
  return baseRows.map((row) => ({
    ...row,
    investment: investmentById.get(row.idNumber) || null,
  }));
}

export async function queryInvestmentReport(query = {}) {
  const { filters, rows: filteredRows } = applyFilters(await loadJoinedRows(), query);
  const variant = query.variant === "summary" ? "summary" : "detailed";
  const summaryGroup = selectedSummaryGroup(filters);
  const summary = variant === "summary" ? buildSummaryRows(filteredRows, summaryGroup) : null;
  const rows = variant === "summary" ? summary.rows : buildDetailedRows(filteredRows);
  return {
    variant,
    groupLabel: variant === "summary" ? summary.groupLabel : undefined,
    filters,
    columns: variant === "summary"
      ? [
        ...GROUPS.slice(0, GROUPS.indexOf(summaryGroup) + 1).map((key) => key[0].toUpperCase() + key.slice(1)),
        "Total_Farmers",
        "Farmers_With_Investment",
        "Farmers_Overdue",
        "Total_Investment",
        "CIR_Pending",
        "Overdue_Amount",
        "Recovery_Rate",
      ]
      : rows.length ? Object.keys(rows[0]) : [],
    rows,
  };
}

export async function getInvestmentFilters() {
  const rows = await loadBaseRows();
  const locations = rows.map((row) => ({ unit: row.unit, sector: row.sector, zone: row.zone, section: row.section }));
  return {
    caneTypes: ["Mill Cane", "Seed Cane"],
    units: [...new Set(locations.map((row) => row.unit).filter(Boolean))].sort(),
    locations: [...new Map(locations.map((row) => [JSON.stringify(row), row])).values()].sort((a, b) =>
      `${a.unit}|${a.sector}|${a.zone}|${a.section}`.localeCompare(`${b.unit}|${b.sector}|${b.zone}|${b.section}`)),
  };
}