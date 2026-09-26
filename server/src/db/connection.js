import { Pool } from "@neondatabase/serverless";

const createDatabase = (connectionString) => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to connect to Neon Postgres.");
  }

  const pool = new Pool({ connectionString });
  pool.on("error", (error) => {
    console.error("Neon database pool error:", error);
  });
  return pool;
};

export default createDatabase;