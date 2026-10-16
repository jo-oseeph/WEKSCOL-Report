const createPresetRepository = (db) => ({
  async list() {
    const result = await db.query(
      `SELECT presets.id, presets.name, presets.description, presets.created_by, presets.created_at,
              COALESCE(array_agg(DISTINCT access.subcategory_id) FILTER (WHERE access.subcategory_id IS NOT NULL), '{}') AS subcategory_ids,
              COALESCE(jsonb_object_agg(overrides.report_id, overrides.effect) FILTER (WHERE overrides.report_id IS NOT NULL), '{}'::jsonb) AS overrides
       FROM access_presets presets
       LEFT JOIN access_preset_subcategory access ON access.preset_id = presets.id
       LEFT JOIN access_preset_override overrides ON overrides.preset_id = presets.id
       GROUP BY presets.id
       ORDER BY presets.name`,
    );
    return result.rows;
  },

  async create({ name, description, subcategoryIds, overrides, createdBy }) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `INSERT INTO access_presets (name, description, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4) RETURNING *`,
        [name, description || null, createdBy, Date.now()],
      );
      const presetId = result.rows[0].id;
      for (const subcategoryId of [...new Set(subcategoryIds)]) {
        await client.query(
          "INSERT INTO access_preset_subcategory (preset_id, subcategory_id) VALUES ($1, $2)",
          [presetId, subcategoryId],
        );
      }
      for (const override of overrides) {
        await client.query(
          "INSERT INTO access_preset_override (preset_id, report_id, effect) VALUES ($1, $2, $3)",
          [presetId, override.reportId, override.effect],
        );
      }
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async remove(id) {
    await db.query("DELETE FROM access_presets WHERE id = $1", [id]);
  },
});

export default createPresetRepository;