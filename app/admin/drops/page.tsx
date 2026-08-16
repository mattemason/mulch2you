import Link from "next/link";
import { alias } from "drizzle-orm/pg-core";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { formatAuMobile } from "@/lib/phone";
import { VOLUME_TIERS } from "@/lib/listing-options";

export default async function AdminDropsPage() {
  // Two joins onto users — the receiver via the listing, the supplier directly
  // — so one of them needs an alias or Postgres can't tell them apart.
  const receiver = alias(users, "receiver");
  const supplier = alias(users, "supplier");

  const rows = await db
    .select({
      drop: drops,
      listing: listings,
      receiverName: receiver.name,
      receiverPhone: receiver.phone,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      businessName: supplierProfiles.businessName,
    })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .innerJoin(receiver, eq(receiver.id, listings.userId))
    .innerJoin(supplier, eq(supplier.id, drops.supplierId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, drops.supplierId))
    .orderBy(desc(drops.createdAt))
    .limit(200);

  return (
    <>
      <h1 className="text-2xl font-semibold">Drops</h1>
      <p className="mt-2 text-sm text-muted">
        Every claim and delivery. A completed drop carries a proof photo, so
        this is the record to check when someone disputes what turned up.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          No drops yet. They appear once a tree service claims a pin.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.drop.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {r.listing.suburb} {r.listing.state} {r.listing.postcode}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        r.drop.status === "completed"
                          ? "border-brand text-brand"
                          : r.drop.status === "accepted"
                            ? "border-accent text-accent"
                            : "border-border text-muted"
                      }`}
                    >
                      {r.drop.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <dl className="mt-2 space-y-0.5 text-sm text-muted">
                    <div>
                      Gardener: {r.receiverName}
                      {r.receiverPhone && ` · ${formatAuMobile(r.receiverPhone)}`} ·{" "}
                      {VOLUME_TIERS[r.listing.tier].label}
                    </div>
                    <div>
                      Tree service: {r.businessName ?? r.supplierName}
                      {r.supplierPhone && ` · ${formatAuMobile(r.supplierPhone)}`}
                    </div>
                    <div>
                      Claimed{" "}
                      {r.drop.createdAt.toLocaleString("en-AU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {r.drop.completedAt &&
                        ` · delivered ${r.drop.completedAt.toLocaleString("en-AU", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}`}
                      {r.drop.volumeM3 && ` · ~${r.drop.volumeM3} m³`}
                      {r.drop.species && ` · ${r.drop.species}`}
                    </div>
                  </dl>

                  <Link
                    href={`/drops/${r.drop.id}`}
                    className="mt-2 inline-block text-sm text-brand hover:underline"
                  >
                    Open drop
                  </Link>
                </div>

                {r.drop.proofPhotoKey && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={`/api/photos/${r.drop.proofPhotoKey}`}
                    alt="Proof of delivery"
                    loading="lazy"
                    className="h-20 w-32 shrink-0 rounded-lg border border-border object-cover"
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
