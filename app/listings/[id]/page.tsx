import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { listings } from "@/lib/db/schema";
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

  const tier = VOLUME_TIERS[listing.tier];
  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];
  const daysLeft = daysUntilStale(listing.confirmedAt);

  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-4">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {listing.suburb} {listing.state} {listing.postcode}
            </h1>
            <p className="mt-1 text-sm text-muted">{listing.addressLine}</p>
          </div>
          <StatusPill status={listing.status} />
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
          <Row label="Approval">
            {listing.preAuthorised
              ? "Drivers can drop without asking"
              : "We'll text you before each drop"}
          </Row>
        </dl>

        {listing.status === "active" && (
          <p className="mt-8 text-sm text-muted">
            {daysLeft > 0
              ? `We'll check you still want mulch in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Pins that go unconfirmed are paused so drivers don't waste trips.`
              : "This pin is overdue for confirmation and may be paused shortly."}
          </p>
        )}

        <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-8">
          <form
            action={async () => {
              "use server";
              await setListingStatus(id, listing.status === "active" ? "paused" : "active");
            }}
          >
            <button type="submit" className="btn-secondary">
              {listing.status === "active" ? "Pause this pin" : "Make it active again"}
            </button>
          </form>

          <form
            action={async () => {
              "use server";
              await deleteListing(id);
            }}
          >
            <button type="submit" className="btn-secondary text-accent">
              Delete
            </button>
          </form>
        </div>
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
