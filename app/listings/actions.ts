"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { EXCLUSIONS, listings } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { fuzzCoords } from "@/lib/geo";
import { ImageError, processUploadedImage } from "@/lib/images";
import { deleteObject, newKey, putObject } from "@/lib/storage";
import {
  resolveAddress,
  suggestAddresses,
  type AddressPrediction,
  type ResolvedAddress,
} from "@/lib/geocode";
import {
  DROP_SPOT_KEYS,
  MATERIAL_WANTED_KEYS,
  VOLUME_TIER_KEYS,
  tierMaxM3,
} from "@/lib/listing-options";

export type LookupState = { results?: AddressPrediction[]; error?: string };

/**
 * Called on every (debounced) keystroke in the address field, so it stays
 * cheap: no database writes, no logging of what people type. The session token
 * comes from the client and groups a whole typing session into one billable
 * Google autocomplete session rather than one per keystroke.
 */
export async function lookupAddress(
  query: string,
  sessionToken?: string,
): Promise<LookupState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  try {
    return { results: await suggestAddresses(query, sessionToken) };
  } catch (err) {
    console.error("address autocomplete failed", err);
    return { error: "Address lookup is temporarily unavailable — try again in a moment." };
  }
}

export type ResolveState = { address?: ResolvedAddress; error?: string };

/** Second half of the lookup, for providers that only hand back an id. */
export async function resolvePrediction(
  id: string,
  sessionToken?: string,
): Promise<ResolveState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };

  try {
    const address = await resolveAddress(id, sessionToken);
    if (!address) {
      return { error: "We couldn't get the full address for that one. Try another suggestion." };
    }
    return { address };
  } catch (err) {
    console.error("address resolve failed", err);
    return { error: "Address lookup is temporarily unavailable — try again in a moment." };
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Coordinates arrive from the client because they came from a lookup the user
 * confirmed. Spoofing them only moves the user's own pin, but a sanity check
 * against Australia's bounding box stops a fat-fingered or malicious value
 * putting a listing in the Atlantic where it clutters every radius query.
 */
const AU_BOUNDS = { minLat: -44, maxLat: -9, minLng: 112, maxLng: 154 };

const listingSchema = z.object({
  addressLine: z.string().trim().min(3),
  suburb: z.string().trim().min(2),
  state: z.string().trim().min(2).max(3),
  postcode: z.string().trim().regex(/^\d{4}$/, "Postcode should be four digits"),
  lat: z.coerce.number().min(AU_BOUNDS.minLat).max(AU_BOUNDS.maxLat),
  lng: z.coerce.number().min(AU_BOUNDS.minLng).max(AU_BOUNDS.maxLng),
  wanted: z.enum(MATERIAL_WANTED_KEYS),
  tier: z.enum(VOLUME_TIER_KEYS),
  dropSpot: z.enum(DROP_SPOT_KEYS),
  accessNotes: z.string().trim().max(500).optional(),
  excludes: z.array(z.enum(EXCLUSIONS)).default([]),
  preAuthorised: z.boolean().default(false),
});

export type ListingState = { error?: string };

export async function createListing(
  _prev: ListingState,
  formData: FormData,
): Promise<ListingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role !== "receiver") {
    return { error: "Only gardener accounts can create listings." };
  }

  const parsed = listingSchema.safeParse({
    addressLine: formData.get("addressLine"),
    suburb: formData.get("suburb"),
    state: formData.get("state"),
    postcode: formData.get("postcode"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    wanted: formData.get("wanted"),
    tier: formData.get("tier"),
    dropSpot: formData.get("dropSpot"),
    accessNotes: formData.get("accessNotes") || undefined,
    excludes: formData.getAll("excludes"),
    preAuthorised: formData.get("preAuthorised") === "on",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message === "Required" ? "Please complete every step." : issue.message };
  }

  const d = parsed.data;
  // Fuzz once, at creation. Re-fuzzing per request would let anyone average a
  // handful of reads back to the true position.
  const approx = fuzzCoords({ lat: d.lat, lng: d.lng });
  const maxM3 = tierMaxM3(d.tier);

  let photoKey: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      const processed = await processUploadedImage(await photo.arrayBuffer());
      photoKey = newKey("listing");
      await putObject(photoKey, processed.data);
    } catch (err) {
      if (err instanceof ImageError) return { error: err.message };
      console.error("listing photo upload failed", err);
      return { error: "We couldn't save that photo. Try again, or skip it for now." };
    }
  }

  await db.insert(listings).values({
    userId: user.id,
    addressLine: d.addressLine,
    suburb: d.suburb,
    state: d.state,
    postcode: d.postcode,
    lat: d.lat,
    lng: d.lng,
    approxLat: approx.lat,
    approxLng: approx.lng,
    wanted: d.wanted,
    tier: d.tier,
    maxVolumeM3: maxM3 === null ? null : String(maxM3),
    excludes: d.excludes,
    dropSpot: d.dropSpot,
    accessNotes: d.accessNotes ?? null,
    photoKey,
    preAuthorised: d.preAuthorised,
  });

  redirect("/dashboard");
}

/* -------------------------------------------------------------------------- */

/** Every mutation below scopes on userId as well as id — never trust the id alone. */
async function ownedListing(listingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return { user, where: and(eq(listings.id, listingId), eq(listings.userId, user.id)) };
}

export async function setListingStatus(listingId: string, status: "active" | "paused") {
  const { where } = await ownedListing(listingId);
  await db
    .update(listings)
    // Coming back from paused counts as confirming the pin is still wanted,
    // which resets the 30-day staleness clock.
    .set(status === "active" ? { status, confirmedAt: new Date() } : { status })
    .where(where);
  revalidatePath("/dashboard");
}

export async function confirmStillWanted(listingId: string) {
  const { where } = await ownedListing(listingId);
  await db.update(listings).set({ confirmedAt: new Date() }).where(where);
  revalidatePath("/dashboard");
}

export async function deleteListing(listingId: string) {
  const { where } = await ownedListing(listingId);
  // Remove the file too — a deleted listing shouldn't leave a photo of
  // someone's driveway sitting on disk indefinitely.
  const [row] = await db.select({ photoKey: listings.photoKey }).from(listings).where(where);
  await db.delete(listings).where(where);
  if (row?.photoKey) await deleteObject(row.photoKey);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
