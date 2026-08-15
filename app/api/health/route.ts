import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Railway's healthcheck target. Green here means the DB is actually reachable.
 *
 * Also reports the hostname the app believes it's serving. Auth.js builds
 * magic-link URLs from these headers when AUTH_URL isn't set, so when links
 * come out pointing at localhost this is where you find out why. Nothing here
 * is secret — it's the caller's own request headers plus a boolean.
 */
export async function GET(req: Request) {
  const h = req.headers;
  const origin = {
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    forwardedProto: h.get("x-forwarded-proto"),
    authUrlConfigured: Boolean(process.env.AUTH_URL ?? process.env.NEXTAUTH_URL),
  };

  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, origin });
  } catch (err) {
    console.error("healthcheck failed", err);
    return Response.json(
      { ok: false, error: "database unreachable", origin },
      { status: 503 },
    );
  }
}
