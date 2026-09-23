import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import loadConfig from "../config/env.js";
import createDatabase from "../db/connection.js";
import runMigrations from "../db/migrate.js";

const config = loadConfig();
const sqlitePath = process.env.SQLITE_PATH || config.databasePath;

const importData = async () => {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required for the SQLite import.");
  }

  const sqlite = new Database(sqlitePath, { readonly: true });
  const pool = createDatabase(config.databaseUrl);

  try {
    await runMigrations(pool);

    const [{ userCount }] = sqlite
      .prepare("SELECT COUNT(*) AS userCount FROM users")
      .all();
    const existingUsers = await pool.query("SELECT COUNT(*)::int AS count FROM users");

    if (existingUsers.rows[0].count > 0) {
      throw new Error(
        "Neon already contains users. Import into an empty Neon branch or clear the branch first.",
      );
    }

    const users = sqlite.prepare("SELECT * FROM users ORDER BY id").all();
    const sessions = sqlite.prepare("SELECT * FROM sessions").all();
    const resetTokens = sqlite
      .prepare("SELECT * FROM password_reset_tokens")
      .all();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      for (const user of users) {
        await client.query(
          `INSERT INTO users
            (id, first_name, last_name, email, id_number, password_hash, avatar_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.id,
            user.first_name,
            user.last_name,
            user.email,
            user.id_number,
            user.password_hash,
            user.avatar_url || null,
          ],
        );
      }

      for (const session of sessions) {
        await client.query(
          `INSERT INTO sessions (token_hash, user_id, expires_at)
           VALUES ($1, $2, $3)`,
          [session.token_hash, session.user_id, session.expires_at],
        );
      }

      for (const token of resetTokens) {
        await client.query(
          `INSERT INTO password_reset_tokens
            (token_hash, user_id, expires_at, created_at)
           VALUES ($1, $2, $3, $4)`,
          [token.token_hash, token.user_id, token.expires_at, token.created_at],
        );
      }

      if (users.length > 0) {
        await client.query(`
          SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            GREATEST((SELECT MAX(id) FROM users), 1),
            true
          )
        `);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    console.log("SQLite data imported into Neon:", {
      sqlitePath,
      users: userCount,
      sessions: sessions.length,
      passwordResetTokens: resetTokens.length,
    });
  } finally {
    sqlite.close();
    await pool.end();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  importData().catch((error) => {
    console.error("SQLite import failed:", {
      code: error?.code,
      message: error?.message,
    });
    process.exit(1);
  });
}