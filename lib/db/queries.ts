import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles } from "./schema";
import { boundingBox, type Coords } from "@/lib/geo";

export type NearbyListing = {
  id: string;
  suburb: string;
  state: string;
  postcode: string;
  approxLat: number;
  approxLng: number;
  wanted: "wood_chips" | "mulch_and_chips" | "any_green_waste";
  tier: "small" | "medium" | "large" | "unlimited";
  maxVolumeM3: string | null;
  excludes: string[];
  dropSpot: string;
  accessNotes: string | null;
  photoKey: string | null;
  preAuthorised: boolean;
  callFirst: boolean;
  /** A crew already holds this one, so it can't be claimed again. */
  pending: boolean;
  createdAt: Date;
  distanceKm: number;
};

export type NearbyOptions = {
  radiusKm?: number;
  /** Only one-tap-claim pins, for a driver with a full truck right now. */
  preAuthorisedOnly?: boolean;
  /**
   * Filters mirror the choices a gardener actually makes when listing, so a
   * driver can search on the same terms rather than a translation of them.
   */
  tier?: "small" | "medium" | "large" | "unlimited";
  wanted?: "wood_chips" | "mulch_and_chips" | "any_green_waste";
  /** Hide pins another crew already holds. */
  excludePending?: boolean;
  limit?: number;
};

/**
 * Listings near a point, nearest first.
 *
 * Note the columns: suburb and approximate coordinates only. Street address,
 * true lat/lng, owner name and phone are never selected here — they are
 * released by the drop-acceptance path and nowhere else.
 *
 * A bounding-box prefilter lets listings_map_idx do the work, then Haversine
 * orders the survivors. Good to well past the point where this project would
 * need PostGIS.
 */
export async function findNearbyListings(
  origin: Coords,
  opts: NearbyOptions = {},
  // Injectable so the geo query can be exercised against a throwaway Postgres
  // in scripts/verify-geo.ts. Production always uses the shared pool.
  database: typeof db = db,
): Promise<NearbyListing[]> {
  const { radiusKm = 25, preAuthorisedOnly = false, tier, wanted, excludePending = false, limit = 200 } = opts;
  const box = boundingBox(origin, radiusKm);

  // A pin someone already holds stays visible but unclaimable — vanishing pins
  // make a driver wonder whether the app is broken, and "taken" is useful
  // information when deciding where to run next.
  //
  // Table and column names are written out, with the inner table aliased,
  // because Drizzle interpolates `${listings.id}` into a raw fragment as a
  // bare "id" — and drops has an id of its own, so the correlation silently
  // became drops.listing_id = drops.id and matched nothing.
  const pending = sql<boolean>`exists (
    select 1 from "drops" pd
    where pd."listing_id" = "listings"."id"
      and pd."status" in ('accepted', 'offered')
  )`;

  const distance = sql<number>`
    6371 * acos(least(1,
        cos(radians(${origin.lat})) * cos(radians(${listings.approxLat}))
      * cos(radians(${listings.approxLng}) - radians(${origin.lng}))
      + sin(radians(${origin.lat})) * sin(radians(${listings.approxLat}))
    ))`;

  const rows = await database
    .select({
      id: listings.id,
      suburb: listings.suburb,
      state: listings.state,
      postcode: listings.postcode,
      approxLat: listings.approxLat,
      approxLng: listings.approxLng,
      wanted: listings.wanted,
      tier: listings.tier,
      maxVolumeM3: listings.maxVolumeM3,
      excludes: listings.excludes,
      dropSpot: listings.dropSpot,
      accessNotes: listings.accessNotes,
      photoKey: listings.photoKey,
      preAuthorised: listings.preAuthorised,
      callFirst: listings.callFirst,
      pending: pending.as("pending"),
      createdAt: listings.createdAt,
      distanceKm: distance.as("distance_km"),
    })
    .from(listings)
    .where(
      and(
        eq(listings.status, "active"),
        sql`${listings.approxLat} between ${box.minLat} and ${box.maxLat}`,
        sql`${listings.approxLng} between ${box.minLng} and ${box.maxLng}`,
        preAuthorisedOnly ? eq(listings.preAuthorised, true) : undefined,
        tier ? eq(listings.tier, tier) : undefined,
        wanted ? eq(listings.wanted, wanted) : undefined,
        excludePending ? sql`not ${pending}` : undefined,
      ),
    )
    .orderBy(distance)
    .limit(limit);

  // The box is a rectangle; the radius is a circle. Trim the corners.
  return rows.filter((r) => r.distanceKm <= radiusKm) as NearbyListing[];
}

/* -------------------------------------------------------------------------- */

export type SiteStats = {
  mulchRehomedM3: number;
  loadsDelivered: number;
  drivewaysWaiting: number;
  treeCrews: number;
};

/**
 * Headline numbers for the homepage.
 *
 * Deliberately computed rather than written into the markup: a marketing page
 * quoting invented totals is a fabricated trust signal, and these are cheap
 * enough to just ask the database for.
 */
export async function getSiteStats(database: typeof db = db): Promise<SiteStats> {
  const [row] = await database
    .select({
      // volume_m3 is optional on a drop, so this is a floor, not a guess.
      mulchRehomedM3: sql<number>`coalesce(sum(case when ${drops.status} = 'completed' then ${drops.volumeM3} end), 0)::float`,
      loadsDelivered: sql<number>`count(*) filter (where ${drops.status} = 'completed')::int`,
    })
    .from(drops);

  const [pins] = await database
    .select({
      drivewaysWaiting: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
    })
    .from(listings);

  const [crews] = await database
    .select({
      treeCrews: sql<number>`count(*) filter (where ${supplierProfiles.verifiedAt} is not null)::int`,
    })
    .from(supplierProfiles);

  return {
    mulchRehomedM3: Number(row?.mulchRehomedM3 ?? 0),
    loadsDelivered: row?.loadsDelivered ?? 0,
    drivewaysWaiting: pins?.drivewaysWaiting ?? 0,
    treeCrews: crews?.treeCrews ?? 0,
  };
}
