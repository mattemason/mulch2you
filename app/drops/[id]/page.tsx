import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { formatAuMobile } from "@/lib/phone";
import { DROP_SPOTS, VOLUME_TIERS, type DropSpotKey } from "@/lib/listing-options";
import { CompleteDropForm } from "./complete-form";

export default async function DropPage({ params }: PageProps<"/drops/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const [row] = await db
    .select({ drop: drops, listing: listings, owner: users })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(drops.id, id))
    .limit(1);

  if (!row) notFound();

  const isSupplier = row.drop.supplierId === user.id;
  const isOwner = row.owner.id === user.id;
  // Only the two parties to a drop, and 404 rather than 403 so a stranger
  // can't confirm the drop exists at all.
  if (!isSupplier && !isOwner) notFound();

  const { drop, listing, owner } = row;
  const done = drop.status === "completed";
  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];

  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-4">
          <Link
            href={isSupplier ? "/map" : "/dashboard"}
            className="text-sm text-muted hover:text-foreground"
          >
            ← {isSupplier ? "Map" : "Dashboard"}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {done ? "Delivered" : "Claimed — go now"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">
          {isSupplier ? `${listing.suburb} ${listing.state}` : "Your mulch delivery"}
        </h1>

        {/* Contact details, released because the drop is accepted ------------ */}
        {isSupplier && (
          <div className="card mt-6">
            <div className="text-xs text-muted">Deliver to</div>
            <div className="mt-1 text-lg font-medium">
              {listing.addressLine}, {listing.suburb} {listing.state} {listing.postcode}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                className="btn-secondary py-2 text-sm"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  `${listing.addressLine}, ${listing.suburb} ${listing.state} ${listing.postcode}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
              {owner.phone && (
                <a className="btn-secondary py-2 text-sm" href={`tel:${owner.phone}`}>
                  Call {owner.name?.split(" ")[0] ?? "them"} · {formatAuMobile(owner.phone)}
                </a>
              )}
            </div>
          </div>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Will take</dt>
            <dd>{VOLUME_TIERS[listing.tier].label}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Tip it</dt>
            <dd>{spot?.label ?? listing.dropSpot}</dd>
          </div>
          {listing.accessNotes && (
            <div className="flex gap-3">
              <dt className="w-32 shrink-0 text-muted">Access</dt>
              <dd>{listing.accessNotes}</dd>
            </div>
          )}
        </dl>

        {/* Where to put it -------------------------------------------------- */}
        {listing.photoKey && (
          <figure className="mt-6">
            <figcaption className="label">Where they want it</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${listing.photoKey}`}
              alt="The spot the gardener wants the mulch tipped"
              className="w-full rounded-xl border border-border"
            />
          </figure>
        )}

        {/* Proof ------------------------------------------------------------ */}
        {done ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="font-semibold">Delivered</h2>
            <p className="mt-1 text-sm text-muted">
              {drop.completedAt?.toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {drop.volumeM3 && ` · about ${drop.volumeM3} m³`}
              {drop.species && ` · ${drop.species}`}
            </p>
            {drop.proofPhotoKey && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/photos/${drop.proofPhotoKey}`}
                alt="The tipped load"
                className="mt-4 w-full rounded-xl border border-border"
              />
            )}
          </div>
        ) : isSupplier ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="font-semibold">Once you&apos;ve tipped it</h2>
            <p className="mt-1 text-sm text-muted">
              A photo of the load on the ground closes the job off and is what
              the gardener is billed against.
            </p>
            <CompleteDropForm dropId={drop.id} />
          </div>
        ) : (
          <p className="mt-8 border-t border-border pt-8 text-sm text-muted">
            The driver will add a photo here once the load has been tipped.
          </p>
        )}
      </div>
    </main>
  );
}
