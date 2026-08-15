import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env, isProd } from "@/lib/env";
import * as schema from "./schema";

/**
 * Reuse the pool across hot reloads, otherwise dev burns through Postgres
 * connections in about a dozen file saves.
 */
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    // Railway's internal network doesn't need TLS; its public proxy does and
    // presents a cert this client won't chain to a root it knows.
    ssl: isProd && !env.DATABASE_URL.includes(".railway.internal")
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
  });

if (!isProd) globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
