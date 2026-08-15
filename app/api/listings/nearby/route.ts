import { z } from "zod";
import { findNearbyListings } from "@/lib/db/queries";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(100).default(25),
  minCapacityM3: z.coerce.number().min(0).max(50).optional(),
  preAuthorisedOnly: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

/**
 * The only endpoint that exposes listing locations, so the authorisation check
 * is the point of the file. An unapproved supplier — or any receiver — gets
 * 403, not an empty list, because "no pins near you" and "you may not look"
 * are different answers and only one of them is true.
 *
 * findNearbyListings selects suburb and fuzzed coordinates only; there is no
 * street address, name or phone in this response by construction.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!isApprovedSupplier(user)) {
    return Response.json({ error: "Your account isn't approved yet" }, { status: 403 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid search area" }, { status: 400 });
  }

  const { lat, lng, radiusKm, minCapacityM3, preAuthorisedOnly } = parsed.data;

  try {
    const results = await findNearbyListings(
      { lat, lng },
      { radiusKm, minCapacityM3, preAuthorisedOnly },
    );
    return Response.json({ listings: results });
  } catch (err) {
    console.error("nearby search failed", err);
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
