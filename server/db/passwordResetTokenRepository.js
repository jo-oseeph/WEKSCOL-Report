const createPasswordResetTokenRepository = (db) => {
  const deleteForUserStatement = db.prepare(
    "DELETE FROM password_reset_tokens WHERE user_id = ?",
  );
  const insertStatement = db.prepare(
    "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  );
  const consumeStatement = db.prepare(
    "DELETE FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ? RETURNING user_id",
  );
  const deleteExpiredStatement = db.prepare(
    "DELETE FROM password_reset_tokens WHERE expires_at <= ?",
  );

  return {
    deleteForUser: (userId) => deleteForUserStatement.run(userId),
    create: ({ tokenHash, userId, expiresAt, createdAt }) =>
      insertStatement.run(tokenHash, userId, expiresAt, createdAt),
    consume: (tokenHash, now) => consumeStatement.get(tokenHash, now),
    deleteExpired: (now) => deleteExpiredStatement.run(now),
  };
};

export default createPasswordResetTokenRepository;