const createSessionRepository = (db) => {
  const insertSessionStatement = db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  );
  const findValidSessionStatement = db.prepare(
    "SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?",
  );
  const deleteSessionStatement = db.prepare(
    "DELETE FROM sessions WHERE token_hash = ?",
  );
  const deleteExpiredSessionsStatement = db.prepare(
    "DELETE FROM sessions WHERE expires_at <= ?",
  );

  return {
    create: ({ tokenHash, userId, expiresAt }) =>
      insertSessionStatement.run(tokenHash, userId, expiresAt),
    findValid: (tokenHash, now) => findValidSessionStatement.get(tokenHash, now),
    delete: (tokenHash) => deleteSessionStatement.run(tokenHash),
    deleteExpired: (now) => deleteExpiredSessionsStatement.run(now),
  };
};

export default createSessionRepository;