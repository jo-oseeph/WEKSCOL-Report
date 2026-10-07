export default function normalizeIdentifierSearch(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().toUpperCase().replace(/^FN-/, "");
}