import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/**
 * Applies everything in ./drizzle. Deliberately uses only runtime dependencies
 * (drizzle-orm, pg) rather than drizzle-kit, because the deploy builder may
 * prune devDependencies before the pre-deploy command runs.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  ssl:
    process.env.NODE_ENV === "production" && !url.includes(".railway.internal")
      ? { rejectUnauthorized: false }
      : false,
  max: 1,
});

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("✓ migrations applied");
} catch (err) {
  console.error("✗ migration failed:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
