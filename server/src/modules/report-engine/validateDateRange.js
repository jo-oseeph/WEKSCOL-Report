import { httpError } from "../../shared/errors.js";

function hasValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "all";
}

export function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export default function validateDateRange(query = {}) {
  const dateFrom = query.dateFrom;
  const dateTo = query.dateTo;

  if (!hasValue(dateFrom)) throw httpError("dateFrom is required.", 400);
  if (!hasValue(dateTo)) throw httpError("dateTo is required.", 400);
  if (!isDateOnly(dateFrom)) throw httpError("dateFrom must be a valid date in YYYY-MM-DD format.", 400);
  if (!isDateOnly(dateTo)) throw httpError("dateTo must be a valid date in YYYY-MM-DD format.", 400);
  if (dateFrom > dateTo) throw httpError("dateFrom cannot be after dateTo.", 400);

  return { dateFrom, dateTo };
}