const createUserRepository = (db) => {
  const findById = async (id) => {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
  };

  const findByEmail = async (email) => {
    const result = await db.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email],
    );
    return result.rows[0];
  };

  const findByIdNumber = async (idNumber) => {
    const result = await db.query("SELECT * FROM users WHERE id_number = $1", [idNumber]);
    return result.rows[0];
  };

  return {
    findById,
    findByEmail,
    findByIdNumber,
    async create({
      firstName,
      lastName,
      email,
      idNumber,
      avatarUrl,
      passwordHash,
      role = "user",
      status = "pending",
    }) {
      const result = await db.query(
        `INSERT INTO users
          (first_name, last_name, email, id_number, avatar_url, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [firstName, lastName, email, idNumber, avatarUrl || null, passwordHash, role, status],
      );
      return result.rows[0];
    },
    async findAllForAdmin() {
      const result = await db.query(
        `SELECT id, first_name, last_name, email, id_number, avatar_url, role, status
         FROM users
         ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                  first_name, last_name`,
      );
      return result.rows;
    },
    async updateProfile({ id, firstName, lastName, email, idNumber, avatarUrl }) {
      const result = await db.query(
        `UPDATE users
         SET first_name = $1, last_name = $2, email = $3,
             id_number = $4, avatar_url = $5
         WHERE id = $6
         RETURNING *`,
        [firstName, lastName, email, idNumber, avatarUrl || null, id],
      );
      return result.rows[0];
    },
    async updatePassword(id, passwordHash) {
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        passwordHash,
        id,
      ]);
    },
    async updateStatus(id, status) {
      const result = await db.query(
        `UPDATE users SET status = $1 WHERE id = $2
         RETURNING id, first_name, last_name, email, id_number, avatar_url, role, status`,
        [status, id],
      );
      return result.rows[0];
    },
  };
};

export default createUserRepository;