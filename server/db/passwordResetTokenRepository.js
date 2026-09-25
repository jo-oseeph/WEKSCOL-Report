const createPasswordResetTokenRepository = (db) => {
  return {
    deleteForUser: async (userId) => {
      await db.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [userId]);
    },
    create: async ({ tokenHash, userId, expiresAt, createdAt }) => {
      await db.query(
        `INSERT INTO password_reset_tokens
          (token_hash, user_id, expires_at, created_at)
         VALUES ($1, $2, $3, $4)`,
        [tokenHash, userId, expiresAt, createdAt],
      );
    },
    consume: async (tokenHash, now) => {
      const result = await db.query(
        `DELETE FROM password_reset_tokens
         WHERE token_hash = $1 AND expires_at > $2
         RETURNING user_id`,
        [tokenHash, now],
      );
      return result.rows[0];
    },
    deleteExpired: async (now) => {
      await db.query("DELETE FROM password_reset_tokens WHERE expires_at <= $1", [now]);
    },
  };
};

export default createPasswordResetTokenRepository;