import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { etagFor, getObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves an uploaded photo, but only to someone entitled to see it.
 *
 * These are never public URLs. A photo of a driveway plus the suburb we do
 * publish is enough to identify a house, so access is decided per object:
 *
 *   listing photo — the owner, or any approved supplier (they need it to
 *                   judge access before driving out; it's the whole point)
 *   proof photo   — only the two parties to that drop
 */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/api/photos/[...key]">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { key: segments } = await params;
  const key = segments.join("/");

  const allowed = await canView(key, user);
  if (!allowed) return new Response("Not found", { status: 404 });

  let data: Buffer | null;
  try {
    data = await getObject(key);
  } catch {
    // Malformed key — treat as missing rather than leaking that it was invalid.
    return new Response("Not found", { status: 404 });
  }
  if (!data) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.byteLength),
      ETag: etagFor(data),
      // Private: the CDN and any shared cache must not hold someone's driveway.
      "Cache-Control": "private, max-age=3600, must-revalidate",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function canView(
  key: string,
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Promise<boolean> {
  if (key.startsWith("listing/")) {
    if (isApprovedSupplier(user)) return true;
    const [row] = await db
      .select({ userId: listings.userId })
      .from(listings)
      .where(eq(listings.photoKey, key))
      .limit(1);
    return row?.userId === user.id;
  }

  if (key.startsWith("proof/")) {
    const [row] = await db
      .select({ supplierId: drops.supplierId, ownerId: listings.userId })
      .from(drops)
      .innerJoin(listings, eq(listings.id, drops.listingId))
      .where(eq(drops.proofPhotoKey, key))
      .limit(1);
    return row?.supplierId === user.id || row?.ownerId === user.id;
  }

  return false;
}
