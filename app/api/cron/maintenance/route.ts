import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { sendDeliveryReminderEmail } from "@/lib/email";
import { STALE_AFTER_DAYS } from "@/lib/listing-options";

export const dynamic = "force-dynamic";

/** How long a claim can sit unclosed before the driver gets a nudge. */
const REMIND_AFTER_HOURS = 3;

/**
 * Housekeeping, run on a schedule.
 *
 * Three jobs that all fix the same failure: state that goes stale because a
 * human stopped paying attention. Left alone, an unanswered offer holds a pin
 * forever, a forgotten claim leaves a gardener waiting for a truck that isn't
 * coming, and an abandoned listing sends drivers to a door nobody answers —
 * which is what makes crews stop opening the app.
 *
 * Idempotent: safe to run twice, and safe to run late.
 */
export async function GET(req: Request) {
  // A shared secret rather than a session — there's nobody signed in at 3am.
  const auth = req.headers.get("authorization");
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  const now = new Date();
  const result = { offersExpired: 0, remindersSent: 0, listingsPaused: 0, errors: [] as string[] };

  /* --- 1. Offers nobody answered ----------------------------------------- */
  const expired = await db
    .update(drops)
    .set({ status: "expired", acceptToken: null })
    .where(and(eq(drops.status, "offered"), lt(drops.expiresAt, now)))
    .returning({ id: drops.id });
  result.offersExpired = expired.length;

  /* --- 2. Claims nobody closed off --------------------------------------- */
  const staleClaims = await db
    .select({
      dropId: drops.id,
      createdAt: drops.createdAt,
      email: users.email,
      businessName: supplierProfiles.businessName,
      suburb: listings.suburb,
      addressLine: listings.addressLine,
    })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .innerJoin(users, eq(users.id, drops.supplierId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, drops.supplierId))
    .where(
      and(
        eq(drops.status, "accepted"),
        isNull(drops.reminderSentAt),
        lt(drops.createdAt, new Date(now.getTime() - REMIND_AFTER_HOURS * 3600_000)),
      ),
    )
    .limit(100);

  for (const claim of staleClaims) {
    if (!claim.email) continue;
    try {
      await sendDeliveryReminderEmail({
        to: claim.email,
        businessName: claim.businessName,
        suburb: claim.suburb,
        addressLine: claim.addressLine,
        claimedAt: claim.createdAt,
        dropUrl: `${baseUrl()}/drops/${claim.dropId}`,
      });
      // Stamped only after a successful send, so a mail outage means the
      // reminder is retried rather than silently skipped.
      await db.update(drops).set({ reminderSentAt: now }).where(eq(drops.id, claim.dropId));
      result.remindersSent++;
    } catch (err) {
      console.error("reminder failed", claim.dropId, err);
      result.errors.push(`reminder ${claim.dropId}`);
    }
  }

  /* --- 3. Pins nobody has confirmed --------------------------------------- */
  const paused = await db
    .update(listings)
    .set({ status: "paused" })
    .where(
      and(
        eq(listings.status, "active"),
        lt(listings.confirmedAt, new Date(now.getTime() - STALE_AFTER_DAYS * 86_400_000)),
      ),
    )
    .returning({ id: listings.id });
  result.listingsPaused = paused.length;

  console.log("maintenance", result);
  return Response.json({ ok: true, ranAt: now.toISOString(), ...result });
}

function baseUrl(): string {
  return (env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
