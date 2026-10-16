const createActivityRepository = (db) => ({
  async create({ userId, action, targetUserId, reportId, metadata = {} }) {
    await db.query(
      `INSERT INTO activity_log
         (user_id, action, target_user_id, report_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [userId || null, action, targetUserId || null, reportId || null, JSON.stringify(metadata), Date.now()],
    );
  },

  async list({ page = 1, pageSize = 25, search = "", userId, action, from, to } = {}) {
    const values = [];
    const conditions = [];
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (search) {
      const parameter = add(`%${search}%`);
      conditions.push(`(
        LOWER(COALESCE(actor.email, '')) LIKE LOWER(${parameter}) OR
        LOWER(COALESCE(actor.first_name || ' ' || actor.last_name, '')) LIKE LOWER(${parameter}) OR
        LOWER(activity.action) LIKE LOWER(${parameter}) OR
        LOWER(COALESCE(activity.report_id, '')) LIKE LOWER(${parameter})
      )`);
    }
    if (userId) conditions.push(`activity.user_id = ${add(userId)}`);
    if (action) conditions.push(`activity.action = ${add(action)}`);
    if (from) conditions.push(`activity.created_at >= ${add(Number(from))}`);
    if (to) conditions.push(`activity.created_at <= ${add(Number(to))}`);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM activity_log activity
       LEFT JOIN users actor ON actor.id = activity.user_id
       ${where}`,
      values,
    );
    const limit = Math.max(1, Math.min(100, Number(pageSize) || 25));
    const offset = Math.max(0, (Number(page) - 1) * limit);
    const rows = await db.query(
      `SELECT activity.id, activity.action, activity.user_id, activity.target_user_id,
              activity.report_id, activity.metadata, activity.created_at,
              actor.first_name AS actor_first_name, actor.last_name AS actor_last_name,
              actor.email AS actor_email,
              target.first_name AS target_first_name, target.last_name AS target_last_name,
              target.email AS target_email
       FROM activity_log activity
       LEFT JOIN users actor ON actor.id = activity.user_id
       LEFT JOIN users target ON target.id = activity.target_user_id
       ${where}
       ORDER BY activity.created_at DESC, activity.id DESC
       LIMIT ${add(limit)} OFFSET ${add(offset)}`,
      values,
    );
    return { rows: rows.rows, total: countResult.rows[0]?.total || 0, page: Number(page), pageSize: limit };
  },

  async recent(limit = 7) {
    const result = await db.query(
      `SELECT activity.id, activity.action, activity.report_id, activity.metadata, activity.created_at,
              actor.first_name AS actor_first_name, actor.last_name AS actor_last_name,
              actor.email AS actor_email
       FROM activity_log activity
       LEFT JOIN users actor ON actor.id = activity.user_id
       ORDER BY activity.created_at DESC, activity.id DESC
       LIMIT $1`,
      [Math.max(1, Math.min(50, Number(limit) || 7))],
    );
    return result.rows;
  },

  async countActionsSince(since) {
    const result = await db.query(
      `SELECT action, COUNT(*)::int AS count
       FROM activity_log
       WHERE created_at >= $1
       GROUP BY action`,
      [since],
    );
    return Object.fromEntries(result.rows.map((row) => [row.action, row.count]));
  },

  async reportRunCountsSince(since) {
    const result = await db.query(
      `SELECT report_id, COUNT(*)::int AS count
       FROM activity_log
       WHERE action = 'run' AND created_at >= $1
       GROUP BY report_id`,
      [since],
    );
    return Object.fromEntries(result.rows.map((row) => [row.report_id, row.count]));
  },
});

export default createActivityRepository;