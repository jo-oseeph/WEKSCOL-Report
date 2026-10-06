const createReportPermissionRepository = (db) => {
  const findForUser = async (userId) => {
    const result = await db.query(
      "SELECT report_id FROM user_report_permissions WHERE user_id = $1 ORDER BY report_id",
      [userId],
    );
    return result.rows.map((row) => String(row.report_id));
  };

  const replaceForUser = async (userId, reportIds, grantedBy) => {
    const normalizedReportIds = [...new Set(reportIds.map((reportId) => String(reportId)))];
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "DELETE FROM user_report_permissions WHERE user_id = $1",
        [userId],
      );

      for (const reportId of normalizedReportIds) {
        await client.query(
          `INSERT INTO user_report_permissions
             (user_id, report_id, granted_by, created_at)
           VALUES ($1, $2, $3, $4)`,
          [userId, reportId, grantedBy, Date.now()],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  return { findForUser, replaceForUser };
};

export default createReportPermissionRepository;