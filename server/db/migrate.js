import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

const runMigrations = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrations = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const hasMigration = db.prepare(
    "SELECT 1 FROM schema_migrations WHERE version = ?",
  );
  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const filename of migrations) {
    const version = filename.split("_")[0];
    if (hasMigration.get(version)) continue;

    const sql = fs.readFileSync(path.join(migrationsDirectory, filename), "utf8");
    db.transaction(() => {
      const hasAvatarColumn =
        filename === "003_add_avatar_url.sql" &&
        db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === "avatar_url");
      if (!hasAvatarColumn) db.exec(sql);
      recordMigration.run(version, filename, Date.now());
    })();
  }
};

export default runMigrations;