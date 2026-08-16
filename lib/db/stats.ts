import { and, count, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { drops, listings } from "./schema";

export type SupplierStats = {
  delivered: number;
  active: number;
  cancelled: number;
  expired: number;
  /** Share of finished claims that became deliveries, 0–1. Null with none yet. */
  completionRate: number | null;
};

/**
 * A crew's record.
 *
 * The completion rate deliberately ignores claims still in flight — counting
 * those would punish a driver for having a live job — and counts expiries
 * alongside cancellations, since a pin held until it lapsed is just a
 * cancellation nobody bothered to make.
 */
export async function getSupplierStats(userId: string): Promise<SupplierStats> {
  const [row] = await db
    .select({
      delivered: sql<number>`count(*) filter (where ${drops.status} = 'completed')::int`,
      active: sql<number>`count(*) filter (where ${drops.status} in ('accepted','offered'))::int`,
      cancelled: sql<number>`count(*) filter (where ${drops.status} = 'cancelled')::int`,
      expired: sql<number>`count(*) filter (where ${drops.status} in ('expired','no_show'))::int`,
    })
    .from(drops)
    .where(eq(drops.supplierId, userId));

  const delivered = row?.delivered ?? 0;
  const finished = delivered + (row?.cancelled ?? 0) + (row?.expired ?? 0);

  return {
    delivered,
    active: row?.active ?? 0,
    cancelled: row?.cancelled ?? 0,
    expired: row?.expired ?? 0,
    completionRate: finished > 0 ? delivered / finished : null,
  };
}

export type ReceiverStats = {
  loadsReceived: number;
  totalM3: number;
  activeListings: number;
  totalListings: number;
};

export async function getReceiverStats(userId: string): Promise<ReceiverStats> {
  const [pins] = await db
    .select({
      activeListings: sql<number>`count(*) filter (where ${listings.status} = 'active')::int`,
      totalListings: count(),
    })
    .from(listings)
    .where(eq(listings.userId, userId));

  const [received] = await db
    .select({
      loadsReceived: sql<number>`count(*)::int`,
      // Volume is optional on a drop, so this is a floor rather than a total.
      totalM3: sql<number>`coalesce(sum(${drops.volumeM3}), 0)::float`,
    })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .where(and(eq(listings.userId, userId), eq(drops.status, "completed")));

  return {
    loadsReceived: received?.loadsReceived ?? 0,
    totalM3: Number(received?.totalM3 ?? 0),
    activeListings: pins?.activeListings ?? 0,
    totalListings: pins?.totalListings ?? 0,
  };
}
