import loadConfig from "../src/config/env.js";
import createDatabase from "../src/db/connection.js";
import runMigrations from "../src/db/migrate.js";

const emailFlagIndex = process.argv.indexOf("--email");
const email = emailFlagIndex >= 0 ? process.argv[emailFlagIndex + 1] : "";

if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:seed -- --email admin@example.com");
  process.exit(1);
}

const run = async () => {
  const config = loadConfig();
  const db = createDatabase(config.databaseUrl);
  try {
    await runMigrations(db);
    const result = await db.query(
      `UPDATE users
       SET role = 'admin', status = 'approved'
       WHERE LOWER(email) = LOWER($1)
       RETURNING id, email, role, status`,
      [email.trim()],
    );

    if (result.rowCount === 0) {
      throw new Error(`No user was found for ${email}. Register the account first, then run this command again.`);
    }

    console.log("Administrator account ready:", result.rows[0]);
  } finally {
    await db.end();
  }
};

run().catch((error) => {
  console.error("Unable to seed administrator:", error.message);
  process.exit(1);
});