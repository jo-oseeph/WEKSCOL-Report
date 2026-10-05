import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
// this is migrate
const runMigrations = async (pool) => {
  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at BIGINT NOT NULL
      );
    `);

    for (const filename of migrations) {
      const version = filename.split("_")[0];
      const migrationResult = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [version],
      );
      if (migrationResult.rowCount > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDirectory, filename), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)",
        [version, filename, Date.now()],
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

export default runMigrations;