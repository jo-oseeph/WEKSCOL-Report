export function paginate(rows, query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const pageSize = Math.min(1000, Math.max(1, Number(query.pageSize || rows.length || 1)));
  return { page, pageSize, total: rows.length, rows: rows.slice((page - 1) * pageSize, page * pageSize) };
}