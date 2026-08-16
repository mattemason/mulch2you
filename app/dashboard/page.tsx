import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { AppHeader } from "@/app/app-header";
import { MATERIALS_WANTED, VOLUME_TIERS } from "@/lib/listing-options";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");

  return (
    <main className="flex-1">
      <AppHeader />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">
          G&apos;day{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>

        {user.role === "supplier" ? (
          <SupplierPanel approved={isApprovedSupplier(user)} userId={user.id} />
        ) : (
          <ReceiverPanel userId={user.id} />
        )}

      </div>
    </main>
  );
}

async function ReceiverPanel({ userId }: { userId: string }) {
  const mine = await db.select().from(listings).where(eq(listings.userId, userId));

  if (mine.length === 0) {
    return (
      <div className="card mt-6">
        <h2 className="font-semibold">Drop your first pin</h2>
        <p className="mt-1 text-sm text-muted">
          Tell us where you want mulch, how much you&apos;ll take and what you
          won&apos;t accept. Tree crews nearby will see it.
        </p>
        <Link href="/listings/new" className="btn-primary mt-5">
          Create a listing
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-6 space-y-3">
        {mine.map((l) => (
          <li key={l.id} className="card flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium">
                {l.suburb} {l.state} {l.postcode}
              </div>
              <div className="mt-0.5 text-sm text-muted">
                {MATERIALS_WANTED[l.wanted].label} · {VOLUME_TIERS[l.tier].label}
                {l.preAuthorised && " · drop anytime"} · {l.status}
              </div>
            </div>
            <Link
              href={`/listings/${l.id}`}
              className="shrink-0 text-sm text-brand hover:underline"
            >
              Manage
            </Link>
          </li>
        ))}
      </ul>

      <Link href="/listings/new" className="btn-secondary mt-4">
        Add another listing
      </Link>
      <p className="mt-2 text-sm text-muted">
        Got a second property, or want mulch somewhere else? Each spot needs its
        own pin.
      </p>
    </>
  );
}

async function SupplierPanel({ approved, userId }: { approved: boolean; userId: string }) {
  if (!approved) {
    return (
      <div className="card mt-6">
        <h2 className="font-semibold">We&apos;re checking your details</h2>
        <p className="mt-1 text-sm text-muted">
          Every tree service is approved by hand before we show the map — pins
          are people&apos;s homes, so we don&apos;t open that up automatically.
          We&apos;ll email you as soon as you&apos;re through, usually within a
          business day.
        </p>
      </div>
    );
  }

  // Anything still open, newest first. A driver holding a claim needs to see it
  // the moment they open the app — it's the thing with a clock on it.
  const openDrops = await db
    .select({ drop: drops, listing: listings })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .where(and(eq(drops.supplierId, userId), inArray(drops.status, ["accepted", "offered"])))
    .orderBy(desc(drops.createdAt));

  return (
    <>
      {openDrops.length > 0 && (
        <section className="mt-6">
          <h2 className="font-semibold">On the go</h2>
          <ul className="mt-3 space-y-3">
            {openDrops.map(({ drop, listing }) => (
              <li key={drop.id}>
                <Link
                  href={`/drops/${drop.id}`}
                  className="card flex items-center justify-between gap-4 transition-colors hover:border-brand"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      {drop.status === "accepted"
                        ? `${listing.addressLine}, ${listing.suburb}`
                        : `${listing.suburb} ${listing.state}`}
                    </div>
                    <div className="mt-0.5 text-sm text-muted">
                      {drop.status === "accepted"
                        ? "Claimed — tip it and add a photo"
                        : "Waiting on the gardener to say yes"}
                      {" · "}
                      {VOLUME_TIERS[listing.tier].label}
                    </div>
                  </div>
                  <span aria-hidden className="shrink-0 text-brand">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card mt-6">
        <h2 className="font-semibold">
          {openDrops.length > 0 ? "Room for another?" : "Got a full truck?"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          Open the map to see who wants chip near your current job.
        </p>
        <Link href="/map" className="btn-primary mt-5">
          Find a drop nearby
        </Link>
      </div>
    </>
  );
}
