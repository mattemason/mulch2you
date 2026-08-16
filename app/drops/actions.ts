"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { ImageError, processUploadedImage } from "@/lib/images";
import { newKey, putObject } from "@/lib/storage";
import {
  CLAIM_WINDOW_HOURS,
  ETA_WINDOWS,
  ETA_WINDOW_KEYS,
  type EtaWindowKey,
} from "@/lib/listing-options";
import {
  sendDropCancelledEmail,
  sendDropOfferEmail,
  sendOfferAcceptedEmail,
} from "@/lib/email";
import { formatAuMobile } from "@/lib/phone";
import { env } from "@/lib/env";

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

  const [held] = await db
    .select({ id: drops.id })
    .from(drops)
    .where(and(eq(drops.listingId, listingId), inArray(drops.status, ["accepted", "offered"])))
    .limit(1);
  if (held) return { error: "Another crew got to this one first." };

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

/* -------------------------------------------------------------------------- */
/*  Ask-first pins: offer → gardener responds                                  */
/* -------------------------------------------------------------------------- */

export type OfferState = { error?: string; dropId?: string };

/**
 * Requests a drop on a pin whose owner wants to approve first.
 *
 * Nothing is released here. The gardener gets an email with the load size and
 * when the crew could come, and only their acceptance hands over an address —
 * which is the whole point of the setting.
 */
export async function offerDrop(
  listingId: string,
  _prev: OfferState,
  formData: FormData,
): Promise<OfferState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isApprovedSupplier(user)) return { error: "Your account isn't approved yet." };

  const eta = String(formData.get("eta") ?? "");
  if (!isEtaWindow(eta)) return { error: "Pick when you could get there." };

  const volumeRaw = formData.get("volumeM3");
  const volume = typeof volumeRaw === "string" && volumeRaw.trim() ? Number(volumeRaw) : null;
  const species = formData.get("species");

  const [row] = await db
    .select({
      listing: listings,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(listings.id, listingId))
    .limit(1);

  if (!row || row.listing.status !== "active") {
    return { error: "That pin is no longer available." };
  }

  // One live request per crew per pin, so a driver tapping twice doesn't send
  // the gardener two emails about the same load.
  const [held] = await db
    .select({ id: drops.id, supplierId: drops.supplierId })
    .from(drops)
    .where(and(eq(drops.listingId, listingId), inArray(drops.status, ["accepted", "offered"])))
    .limit(1);
  if (held) {
    return {
      error:
        held.supplierId === user.id
          ? "You've already asked about this one — they haven't replied yet."
          : "Another crew is already on this one.",
    };
  }

  // The token is the credential, so it's random rather than derived, stored
  // rather than signed, and cleared the moment it's used.
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + ETA_WINDOWS[eta].expiryHours * 3600_000);

  const [drop] = await db
    .insert(drops)
    .values({
      listingId,
      supplierId: user.id,
      status: "offered",
      etaWindow: eta,
      volumeM3: volume !== null && Number.isFinite(volume) ? String(volume) : null,
      species: typeof species === "string" && species.trim() ? species.trim().slice(0, 200) : null,
      acceptToken: token,
      expiresAt,
    })
    .returning({ id: drops.id });

  if (row.ownerEmail) {
    try {
      await sendDropOfferEmail({
        to: row.ownerEmail,
        gardenerName: row.ownerName,
        businessName: user.supplierProfile?.businessName ?? user.name ?? "A local tree service",
        suburb: row.listing.suburb,
        eta: ETA_WINDOWS[eta].label,
        volume: volume !== null && Number.isFinite(volume) ? `about ${volume} m³` : null,
        respondUrl: `${await siteUrl()}/respond/${token}`,
        expiresAt,
      });
    } catch (err) {
      // The request stands even if the mail provider is down — it'll show on
      // their dashboard — but say so rather than implying they've been told.
      console.error("offer email failed", err);
      revalidatePath("/dashboard");
      return { dropId: drop.id, error: "Request sent, but the email didn't go through." };
    }
  }

  revalidatePath("/dashboard");
  return { dropId: drop.id };
}

export type RespondState = { error?: string; ok?: "accepted" | "declined" };

/**
 * The gardener's answer, from a link in an email.
 *
 * Deliberately a POST-only action behind a page with buttons. Mail scanners
 * follow links before the recipient does — the same behaviour that burns magic
 * links — so a GET that accepted a drop would hand out addresses to a security
 * appliance.
 */
export async function respondToOffer(
  token: string,
  answer: "accept" | "decline",
): Promise<RespondState> {
  const [row] = await db
    .select({ drop: drops, listing: listings })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .where(eq(drops.acceptToken, token))
    .limit(1);

  if (!row) return { error: "That link isn't valid any more." };
  if (row.drop.status !== "offered") {
    return { error: `This request was already ${row.drop.status}.` };
  }
  if (row.drop.expiresAt.getTime() < Date.now()) {
    await db.update(drops).set({ status: "expired", acceptToken: null }).where(eq(drops.id, row.drop.id));
    return { error: "This request expired — the crew will have moved on." };
  }

  await db
    .update(drops)
    .set({
      status: answer === "accept" ? "accepted" : "declined",
      respondedAt: new Date(),
      // Single use: spend the token whichever way they answered.
      acceptToken: null,
    })
    .where(eq(drops.id, row.drop.id));

  // A yes is useless to the crew if nobody tells them. This is the moment the
  // address is released, so it's also the moment they can act on it.
  if (answer === "accept") {
    const [crew] = await db
      .select({
        email: users.email,
        businessName: supplierProfiles.businessName,
      })
      .from(users)
      .leftJoin(supplierProfiles, eq(supplierProfiles.userId, users.id))
      .where(eq(users.id, row.drop.supplierId))
      .limit(1);

    const [owner] = await db
      .select({ name: users.name, phone: users.phone })
      .from(users)
      .where(eq(users.id, row.listing.userId))
      .limit(1);

    if (crew?.email) {
      try {
        await sendOfferAcceptedEmail({
          to: crew.email,
          businessName: crew.businessName,
          addressLine: row.listing.addressLine,
          suburb: row.listing.suburb,
          state: row.listing.state,
          postcode: row.listing.postcode,
          gardenerName: owner?.name ?? null,
          gardenerPhone: owner?.phone ? formatAuMobile(owner.phone) : null,
          dropUrl: `${await siteUrl()}/drops/${row.drop.id}`,
        });
      } catch (err) {
        // The acceptance stands — it's on their dashboard either way.
        console.error("acceptance email failed", err);
      }
    }
  }

  revalidatePath("/dashboard");
  return { ok: answer === "accept" ? "accepted" : "declined" };
}

function isEtaWindow(v: string): v is EtaWindowKey {
  return (ETA_WINDOW_KEYS as string[]).includes(v);
}

async function siteUrl(): Promise<string> {
  if (env.AUTH_URL) return env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/* -------------------------------------------------------------------------- */

export type CancelState = { error?: string; ok?: boolean };

/**
 * Releases a claim.
 *
 * Needed because a claim currently has only one exit — delivering it. A crew
 * whose truck filled elsewhere, or who got there and found the driveway
 * impassable, would otherwise sit on a pin nobody else can take until it
 * expires. Better they hand it back deliberately, and better the gardener
 * hears rather than waits for a truck that isn't coming.
 */
export async function cancelDrop(
  dropId: string,
  _prev: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const [row] = await db
    .select({ drop: drops, listing: listings, ownerEmail: users.email, ownerName: users.name })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .innerJoin(users, eq(users.id, listings.userId))
    .where(and(eq(drops.id, dropId), eq(drops.supplierId, user.id)))
    .limit(1);

  if (!row) return { error: "We couldn't find that drop." };
  if (row.drop.status === "completed") {
    return { error: "This one's already delivered — nothing to cancel." };
  }
  if (row.drop.status !== "accepted" && row.drop.status !== "offered") {
    return { error: "This drop isn't active." };
  }

  const reason = formData.get("reason");
  await db
    .update(drops)
    .set({
      status: "cancelled",
      cancelledReason:
        typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null,
      // Spend any outstanding token so an emailed link can't revive it.
      acceptToken: null,
    })
    .where(eq(drops.id, dropId));

  // Only worth telling them if they were expecting a truck.
  if (row.drop.status === "accepted" && row.ownerEmail) {
    try {
      await sendDropCancelledEmail({
        to: row.ownerEmail,
        gardenerName: row.ownerName,
        businessName: user.supplierProfile?.businessName ?? user.name ?? "The tree service",
        suburb: row.listing.suburb,
        reason: typeof reason === "string" && reason.trim() ? reason.trim() : null,
      });
    } catch (err) {
      console.error("cancellation email failed", err);
    }
  }

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
