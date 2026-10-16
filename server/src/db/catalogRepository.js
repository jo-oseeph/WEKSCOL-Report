const createCatalogRepository = (db) => ({
  async getStates() {
    const result = await db.query(
      "SELECT report_id, is_active, updated_at FROM report_catalog_state",
    );
    return new Map(result.rows.map((row) => [String(row.report_id), row]));
  },

  async setActive(reportId, isActive, updatedBy) {
    const result = await db.query(
      `INSERT INTO report_catalog_state (report_id, is_active, updated_by, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (report_id) DO UPDATE SET
         is_active = EXCLUDED.is_active,
         updated_by = EXCLUDED.updated_by,
         updated_at = EXCLUDED.updated_at
       RETURNING report_id, is_active, updated_at`,
      [reportId, isActive, updatedBy, Date.now()],
    );
    return result.rows[0];
  },
});

export default createCatalogRepository;