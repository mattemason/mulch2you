"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { ImageError, processUploadedImage } from "@/lib/images";
import { newKey, putObject } from "@/lib/storage";

/** How long a claimed drop stays live before we assume it fell through. */
const CLAIM_WINDOW_HOURS = 24;

export type ClaimResult = { dropId?: string; error?: string };

/**
 * Claims a pre-authorised pin: the one-tap path that makes this work at
 * truck-is-full-right-now speed. The receiver already said "drop anytime", so
 * there's nothing to wait for and the drop is created already accepted.
 *
 * Pins that need approval go through the offer/accept loop instead, which is
 * the next thing to build.
 */
export async function claimListing(listingId: string): Promise<ClaimResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isApprovedSupplier(user)) return { error: "Your account isn't approved yet." };

  const [listing] = await db
    .select({ id: listings.id, preAuthorised: listings.preAuthorised, status: listings.status })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!listing || listing.status !== "active") {
    return { error: "That pin is no longer available." };
  }
  if (!listing.preAuthorised) {
    return { error: "This one needs the gardener's approval first." };
  }

  const expiresAt = new Date(Date.now() + CLAIM_WINDOW_HOURS * 3600_000);
  const [drop] = await db
    .insert(drops)
    .values({
      listingId: listing.id,
      supplierId: user.id,
      status: "accepted",
      respondedAt: new Date(),
      expiresAt,
    })
    .returning({ id: drops.id });

  revalidatePath("/dashboard");
  return { dropId: drop.id };
}

/* -------------------------------------------------------------------------- */

export type CompleteState = { error?: string };

/**
 * Marks a drop delivered. The proof photo is mandatory: it's the evidence if
 * the receiver disputes what turned up, and it's the event that will trigger
 * payment once Stripe is wired in. A "delivered" with nothing behind it would
 * be worth very little of either.
 */
export async function completeDrop(
  dropId: string,
  _prev: CompleteState,
  formData: FormData,
): Promise<CompleteState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const [drop] = await db
    .select({ id: drops.id, status: drops.status })
    .from(drops)
    .where(and(eq(drops.id, dropId), eq(drops.supplierId, user.id)))
    .limit(1);

  if (!drop) return { error: "We couldn't find that drop." };
  if (drop.status === "completed") return { error: "This drop is already marked delivered." };
  if (drop.status !== "accepted") return { error: "This drop isn't active." };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Please add a photo of the tipped load." };
  }

  let proofPhotoKey: string;
  try {
    const processed = await processUploadedImage(await photo.arrayBuffer());
    proofPhotoKey = newKey("proof");
    await putObject(proofPhotoKey, processed.data);
  } catch (err) {
    if (err instanceof ImageError) return { error: err.message };
    console.error("proof photo upload failed", err);
    return { error: "We couldn't save that photo. Try again." };
  }

  const volumeRaw = formData.get("volumeM3");
  const volume = typeof volumeRaw === "string" && volumeRaw.trim() ? Number(volumeRaw) : null;
  const species = formData.get("species");

  await db
    .update(drops)
    .set({
      status: "completed",
      completedAt: new Date(),
      proofPhotoKey,
      volumeM3: volume !== null && Number.isFinite(volume) ? String(volume) : null,
      species: typeof species === "string" && species.trim() ? species.trim().slice(0, 200) : null,
    })
    .where(eq(drops.id, dropId));

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/dashboard");
  return {};
}
