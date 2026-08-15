import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Railway's healthcheck target. Green here means the DB is actually reachable. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("healthcheck failed", err);
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503 });
  }
}
