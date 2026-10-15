const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function normalizeNumber(value) {
  if (!Number.isFinite(value) || Number.isInteger(value)) return value;
  return Number(value.toFixed(3));
}

function normalize(value) {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return normalizeNumber(value);
  if (typeof value === "string" && ISO_DATE_TIME.test(value)) return value.slice(0, 10);
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}
export default function normalizeRows(rows) {
  return rows.map((row) => normalize(row));
}
