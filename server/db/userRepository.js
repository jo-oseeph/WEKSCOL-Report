const createUserRepository = (db) => {
  const findByIdStatement = db.prepare("SELECT * FROM users WHERE id = ?");
  const findByEmailStatement = db.prepare(
    "SELECT * FROM users WHERE email = ? COLLATE NOCASE",
  );
  const findByIdNumberStatement = db.prepare(
    "SELECT * FROM users WHERE id_number = ?",
  );
  const insertUserStatement = db.prepare(
    "INSERT INTO users (first_name, last_name, email, id_number, avatar_url, password_hash) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const updateProfileStatement = db.prepare(
    "UPDATE users SET first_name = ?, last_name = ?, email = ?, id_number = ?, avatar_url = ? WHERE id = ?",
  );
  const updatePasswordStatement = db.prepare(
    "UPDATE users SET password_hash = ? WHERE id = ?",
  );

  return {
    findById: (id) => findByIdStatement.get(id),
    findByEmail: (email) => findByEmailStatement.get(email),
    findByIdNumber: (idNumber) => findByIdNumberStatement.get(idNumber),
    create({ firstName, lastName, email, idNumber, avatarUrl, passwordHash }) {
      const result = insertUserStatement.run(
        firstName,
        lastName,
        email,
        idNumber,
        avatarUrl || null,
        passwordHash,
      );
      return findByIdStatement.get(result.lastInsertRowid);
    },
    updateProfile({ id, firstName, lastName, email, idNumber, avatarUrl }) {
      updateProfileStatement.run(
        firstName,
        lastName,
        email,
        idNumber,
        avatarUrl || null,
        id,
      );
      return findByIdStatement.get(id);
    },
    updatePassword(id, passwordHash) {
      updatePasswordStatement.run(passwordHash, id);
    },
  };
};

export default createUserRepository;