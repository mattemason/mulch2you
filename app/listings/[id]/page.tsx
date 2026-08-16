import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { AppHeader } from "@/app/app-header";
import { getCurrentUser } from "@/lib/session";
import {
  DROP_SPOTS,
  EXCLUSION_LABELS,
  MATERIALS_WANTED,
  VOLUME_TIERS,
  type Exclusion,
  daysUntilStale,
  formatPrice,
  type DropSpotKey,
} from "@/lib/listing-options";
import { deleteListing, setListingStatus } from "../actions";
import { ListingPhotoForm } from "./photo-form";
import { Photo } from "@/app/photo";

export default async function ListingPage({ params }: PageProps<"/listings/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const [listing] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.id, id), eq(listings.userId, user.id)))
    .limit(1);

  if (!listing) notFound();

  // What's actually turned up here. The pin is only half the story once a
  // crew has been — and the proof photo is the record if anything's disputed.
  const deliveries = await db
    .select({ drop: drops, businessName: supplierProfiles.businessName, crewName: users.name })
    .from(drops)
    .innerJoin(users, eq(users.id, drops.supplierId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, drops.supplierId))
    .where(and(eq(drops.listingId, id), eq(drops.status, "completed")))
    .orderBy(desc(drops.completedAt));

  // Anything a crew is currently holding on this pin. "Active" says the pin is
  // live; it doesn't say a truck is already coming, which is the thing an
  // owner actually wants to know when they open this page.
  const [inFlight] = await db
    .select({ status: drops.status, businessName: supplierProfiles.businessName, crewName: users.name })
    .from(drops)
    .innerJoin(users, eq(users.id, drops.supplierId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, drops.supplierId))
    .where(and(eq(drops.listingId, id), inArray(drops.status, ["accepted", "offered"])))
    .limit(1);

  const tier = VOLUME_TIERS[listing.tier];
  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];
  const daysLeft = daysUntilStale(listing.confirmedAt);

  return (
    <main className="flex-1">
      <AppHeader />

      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Back to my listings
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {listing.suburb} {listing.state} {listing.postcode}
            </h1>
            <p className="mt-1 text-sm text-muted">{listing.addressLine}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusPill status={listing.status} />
            <form
              action={async () => {
                "use server";
                await setListingStatus(id, listing.status === "active" ? "paused" : "active");
              }}
            >
              <button type="submit" className="btn-secondary py-2 text-sm">
                {listing.status === "active" ? "Pause" : "Reactivate"}
              </button>
            </form>
            <form
              action={async () => {
                "use server";
                await deleteListing(id);
              }}
            >
              <button type="submit" className="btn-secondary py-2 text-sm text-accent">
                Delete
              </button>
            </form>
          </div>
        </div>

        {/* What's happening right now, above the settings that never change. */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="font-medium">
            {inFlight?.status === "accepted"
              ? `${inFlight.businessName ?? inFlight.crewName ?? "A crew"} is on the way`
              : inFlight?.status === "offered"
                ? `${inFlight.businessName ?? inFlight.crewName ?? "A crew"} has asked to drop here`
                : listing.status === "active"
                  ? "Live on the map"
                  : "Paused — drivers can't see this pin"}
          </div>
          <div className="mt-1 text-sm text-muted">
            {inFlight?.status === "accepted"
              ? "They have your address. You'll see their photo here once it's tipped."
              : inFlight?.status === "offered"
                ? "Check your email to say yes or no. They don't have your address yet."
                : listing.status === "active"
                  ? deliveries.length > 0
                    ? `${deliveries.length} load${deliveries.length === 1 ? "" : "s"} delivered here so far.`
                    : "Waiting for a crew with a full truck nearby."
                  : "Reactivate it below when you want mulch again."}
          </div>
        </div>

        <dl className="mt-8 space-y-4">
          <Row label="Wants">{MATERIALS_WANTED[listing.wanted].label}</Row>
          <Row label="Taking">
            {tier.label} · {formatPrice(tier.priceCents)} on delivery
          </Row>
          <Row label="Tip it">{spot?.label ?? listing.dropSpot}</Row>
          {listing.accessNotes && <Row label="Access notes">{listing.accessNotes}</Row>}
          <Row label="Won't accept">
            {listing.excludes.length === 0 ? (
              <span className="text-muted">Anything goes — good, that widens your pool</span>
            ) : (
              listing.excludes
                .map((e) => EXCLUSION_LABELS[e as Exclusion]?.label ?? e)
                .join(", ")
            )}
          </Row>
          <Row label="Before they come">
            {listing.callFirst
              ? "Drivers ring you first"
              : "Drivers can just turn up"}
          </Row>
        </dl>

        {deliveries.length > 0 && (
          <section className="mt-10 border-t border-border pt-8">
            <h2 className="font-semibold">
              Delivered here ({deliveries.length})
            </h2>
            <ul className="mt-4 space-y-4">
              {deliveries.map(({ drop, businessName, crewName }) => (
                <li key={drop.id} className="card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{businessName ?? crewName ?? "A tree service"}</span>
                    <span className="text-sm text-muted">
                      {drop.completedAt?.toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {drop.volumeM3 ? `About ${drop.volumeM3} m³` : "Volume not recorded"}
                    {drop.species && ` · ${drop.species}`}
                  </div>
                  {drop.proofPhotoKey && (
                    <Photo
                      src={`/api/photos/${drop.proofPhotoKey}`}
                      alt="The load as it was tipped"
                      className="mt-3 w-full rounded-xl border border-border"
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="font-semibold">Photo of the drop spot</h2>
          <p className="mt-1 text-sm text-muted">
            {listing.photoKey
              ? "Drivers see this before they decide whether their truck fits."
              : "You haven't added one. It's the single most useful thing on your listing — drivers check it before committing."}
          </p>
          <ListingPhotoForm
            key={listing.photoKey ?? "none"}
            listingId={listing.id}
            currentPhotoKey={listing.photoKey}
          />
        </section>

        {listing.status === "active" && (
          <p className="mt-8 text-sm text-muted">
            {daysLeft > 0
              ? `We'll check you still want mulch in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Pins that go unconfirmed are paused so drivers don't waste trips.`
              : "This pin is overdue for confirmation and may be paused shortly."}
          </p>
        )}

      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-brand text-brand-fg"
      : "border border-border bg-card text-muted";
  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}
