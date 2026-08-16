"use server";

import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { suggestPlaces, type PlaceSuggestion } from "@/lib/geocode";

export type PlaceLookup = { places?: PlaceSuggestion[]; error?: string };

/**
 * Suburb search for the map's "search around" control.
 *
 * Gated on the same approval as the pins themselves: place lookups cost money
 * on the Google path, and this shouldn't be a free geocoding endpoint for
 * anyone with an account.
 */
export async function lookupPlace(query: string): Promise<PlaceLookup> {
  const user = await getCurrentUser();
  if (!isApprovedSupplier(user)) return { error: "Not authorised." };

  try {
    return { places: await suggestPlaces(query) };
  } catch (err) {
    console.error("place search failed", err);
    return { error: "Couldn't search for that place. Try again in a moment." };
  }
}
