const createSessionRepository = (db) => {
  return {
    create: async ({ tokenHash, userId, expiresAt }) => {
      await db.query(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        [tokenHash, userId, expiresAt],
      );
    },
    findValid: async (tokenHash, now) => {
      const result = await db.query(
        "SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > $2",
        [tokenHash, now],
      );
      return result.rows[0];
    },
    delete: async (tokenHash) => {
      await db.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    },
    deleteExpired: async (now) => {
      await db.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
    },
    deleteForUser: async (userId) => {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    },
  };
};

export default createSessionRepository;