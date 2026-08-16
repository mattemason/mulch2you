import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, users } from "@/lib/db/schema";
import { AppHeader } from "@/app/app-header";
import { getCurrentUser } from "@/lib/session";
import { formatAuMobile } from "@/lib/phone";
import {
  DROP_SPOTS,
  MATERIALS_WANTED,
  VOLUME_TIERS,
  type DropSpotKey,
} from "@/lib/listing-options";
import { CompleteDropForm } from "./complete-form";
import { CancelClaim } from "./cancel-claim";
import { Photo } from "@/app/photo";

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
  // Branch on the actual status, not just "is it done". A released or lapsed
  // claim is neither delivered nor live, and showing it the delivery form was
  // how a cancelled drop kept looking like an active job.
  const done = drop.status === "completed";
  const live = drop.status === "accepted";
  const waiting = drop.status === "offered";
  const closed = !done && !live && !waiting;
  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];

  return (
    <main className="flex-1">
      <AppHeader />

      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">
          {done ? "Delivered" : waiting ? "Waiting on the gardener" : live ? "Claimed — go now" : CLOSED_LABEL[drop.status] ?? "Closed"}
        </div>
        <h1 className="mt-1 text-2xl font-semibold">
          {isSupplier ? `${listing.suburb} ${listing.state}` : "Your mulch delivery"}
        </h1>

        {/* Contact details, released because the drop is accepted. Dark green
            so the address reads as the one thing on this screen that matters,
            with the action in orange beside it. */}
        {isSupplier && drop.status !== "offered" && (
          <div className="mt-6 rounded-xl bg-brand p-5 text-brand-fg">
            <div className="text-xs uppercase tracking-wide opacity-80">Deliver to</div>
            <div className="mt-1 text-lg font-semibold">
              {listing.addressLine}, {listing.suburb} {listing.state} {listing.postcode}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="inline-flex items-center gap-2 rounded-lg bg-[#E8631A] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  `${listing.addressLine}, ${listing.suburb} ${listing.state} ${listing.postcode}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
              {owner.phone && (
                <a
                  className="inline-flex items-center gap-2 rounded-lg border border-white/35 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
                  href={`tel:${owner.phone}`}
                >
                  Call {owner.name?.split(" ")[0] ?? "them"} · {formatAuMobile(owner.phone)}
                </a>
              )}
            </div>
          </div>
        )}

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-muted">Wants</dt>
            <dd>{MATERIALS_WANTED[listing.wanted].label}</dd>
          </div>
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
            <Photo
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
              <Photo
                src={`/api/photos/${drop.proofPhotoKey}`}
                alt="The tipped load"
                className="mt-4 w-full rounded-xl border border-border"
              />
            )}
          </div>
        ) : closed ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="font-semibold">{CLOSED_LABEL[drop.status] ?? "Closed"}</h2>
            <p className="mt-1 text-sm text-muted">
              {CLOSED_BLURB[drop.status] ?? "Nothing more to do here."}
              {drop.cancelledReason && ` Reason given: “${drop.cancelledReason}”.`}
            </p>
            <Link
              href={isSupplier ? "/map" : "/dashboard"}
              className="btn-secondary mt-5"
            >
              {isSupplier ? "Find another drop" : "Back to dashboard"}
            </Link>
          </div>
        ) : waiting ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="font-semibold">
              {isSupplier ? "Waiting on the gardener" : "You haven't answered yet"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isSupplier
                ? `We've emailed them. You'll get the address the moment they say yes, and this lapses on its own if they don't answer by ${drop.expiresAt.toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}.`
                : "Check your email for the request — you can say yes or no from there."}
            </p>
            {isSupplier && <CancelClaim dropId={drop.id} />}
          </div>
        ) : isSupplier ? (
          <div className="mt-8 border-t border-border pt-8">
            <h2 className="font-semibold">Once you&apos;ve tipped it</h2>
            <p className="mt-1 text-sm text-muted">
              A photo of the load on the ground closes the job off and is what
              the gardener is billed against.
            </p>
            <CompleteDropForm dropId={drop.id} />
            <CancelClaim dropId={drop.id} />
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

/** Statuses that mean the job is over without a delivery. */
const CLOSED_LABEL: Record<string, string> = {
  cancelled: "Claim released",
  declined: "The gardener said no",
  expired: "Request lapsed",
  no_show: "Marked as a no-show",
};

const CLOSED_BLURB: Record<string, string> = {
  cancelled: "This pin went back on the map for other crews.",
  declined: "They'd rather wait for a different load. No address was shared.",
  expired: "Nobody answered in time, so the pin went back on the map.",
  no_show: "No load was recorded against this claim.",
};
