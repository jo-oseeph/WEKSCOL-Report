const createAccessRepository = (db) => ({
  async getSubcategories(userId) {
    const result = await db.query(
      "SELECT subcategory_id FROM user_subcategory_access WHERE user_id = $1 ORDER BY subcategory_id",
      [userId],
    );
    return result.rows.map((row) => String(row.subcategory_id));
  },

  async getOverrides(userId) {
    const result = await db.query(
      `SELECT report_id, effect
       FROM user_report_override
       WHERE user_id = $1
       ORDER BY report_id`,
      [userId],
    );
    return result.rows.map((row) => ({ reportId: String(row.report_id), effect: row.effect }));
  },

  async getForUser(userId) {
    const [subcategories, overrides] = await Promise.all([
      this.getSubcategories(userId),
      this.getOverrides(userId),
    ]);
    return { subcategories, overrides };
  },

  async replaceForUser(userId, { subcategoryIds, overrides }, grantedBy) {
    const client = await db.connect();
    const now = Date.now();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM user_subcategory_access WHERE user_id = $1", [userId]);
      await client.query("DELETE FROM user_report_override WHERE user_id = $1", [userId]);

      for (const subcategoryId of [...new Set(subcategoryIds)]) {
        await client.query(
          `INSERT INTO user_subcategory_access
             (user_id, subcategory_id, granted_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $4)`,
          [userId, subcategoryId, grantedBy, now],
        );
      }

      for (const override of overrides) {
        await client.query(
          `INSERT INTO user_report_override
             (user_id, report_id, effect, granted_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [userId, override.reportId, override.effect, grantedBy, now],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
});

export default createAccessRepository;