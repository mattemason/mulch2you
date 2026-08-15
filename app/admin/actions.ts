"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { listings, supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { sendSupplierApprovedEmail } from "@/lib/email";
import { GeocodeError, geocoderName, suggestAddresses } from "@/lib/geocode";
import { env } from "@/lib/env";

export type AdminResult = { error?: string; ok?: string };

/**
 * Approving a supplier is the moment they gain sight of strangers' home
 * locations, so it's deliberately a human decision rather than anything
 * automatic. Every action here re-checks admin server-side — the /admin page
 * guard is convenience, this is the actual control.
 */
export async function approveSupplier(userId: string): Promise<AdminResult> {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return { error: "Not authorised." };

  const [row] = await db
    .select({ email: users.email, name: users.name, verifiedAt: supplierProfiles.verifiedAt })
    .from(supplierProfiles)
    .innerJoin(users, eq(users.id, supplierProfiles.userId))
    .where(eq(supplierProfiles.userId, userId))
    .limit(1);

  if (!row) return { error: "No such supplier." };
  if (row.verifiedAt) return { ok: "Already approved." };

  await db
    .update(supplierProfiles)
    .set({ verifiedAt: new Date() })
    .where(eq(supplierProfiles.userId, userId));

  // The dashboard promises "we'll email you as soon as you're through", so
  // send it — but don't fail the approval if the mail provider is down.
  if (row.email) {
    try {
      await sendSupplierApprovedEmail({
        to: row.email,
        name: row.name,
        mapUrl: `${await baseUrl()}/map`,
      });
    } catch (err) {
      console.error("approval email failed", err);
      revalidatePath("/admin");
      return { ok: "Approved, but the notification email didn't send." };
    }
  }

  revalidatePath("/admin");
  return { ok: "Approved and notified." };
}

export async function revokeSupplier(userId: string): Promise<AdminResult> {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return { error: "Not authorised." };

  await db
    .update(supplierProfiles)
    .set({ verifiedAt: null })
    .where(eq(supplierProfiles.userId, userId));

  revalidatePath("/admin");
  return { ok: "Access revoked." };
}

/**
 * Admin override for a listing's status — for pins that are clearly abandoned,
 * abusive, or where the owner has asked by phone. Unlike the owner's own
 * control this isn't scoped by userId, which is exactly why it re-checks admin.
 */
export async function adminSetListingStatus(
  listingId: string,
  status: "active" | "paused",
): Promise<AdminResult> {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return { error: "Not authorised." };

  await db
    .update(listings)
    // Reactivating counts as confirming the pin is still wanted, so the
    // staleness clock restarts rather than immediately re-pausing it.
    .set(status === "active" ? { status, confirmedAt: new Date() } : { status })
    .where(eq(listings.id, listingId));

  revalidatePath("/admin/listings");
  return { ok: status === "active" ? "Reactivated." : "Paused." };
}

/* -------------------------------------------------------------------------- */

export type GeocoderTest = {
  ok: boolean;
  provider: string;
  count: number;
  sample?: string;
  summary?: string;
  detail?: string;
};

/** A real address, so the test exercises the same path a gardener would. */
const TEST_QUERY = "95 Eumundi Noosa Road Noosaville";

export async function testGeocoder(): Promise<GeocoderTest> {
  const admin = await getCurrentUser();
  const provider = geocoderName();
  if (!isAdmin(admin)) return { ok: false, provider, count: 0, summary: "Not authorised." };

  try {
    const results = await suggestAddresses(TEST_QUERY, crypto.randomUUID());
    return {
      ok: results.length > 0,
      provider,
      count: results.length,
      sample: results[0] ? `${results[0].primary} — ${results[0].secondary}` : undefined,
      summary: results.length === 0 ? "The provider answered but matched nothing." : undefined,
    };
  } catch (err) {
    // Surface the provider's own words here — this screen exists precisely so
    // a misconfiguration doesn't have to be guessed at from a log.
    const isGeocode = err instanceof GeocodeError;
    return {
      ok: false,
      provider,
      count: 0,
      summary: isGeocode ? err.message : "The lookup threw before reaching the provider.",
      detail: isGeocode
        ? `HTTP ${err.status}\n${err.providerMessage}`
        : err instanceof Error
          ? err.message
          : String(err),
    };
  }
}

async function baseUrl(): Promise<string> {
  if (env.AUTH_URL) return env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
