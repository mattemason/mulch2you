import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { listings, users } from "@/lib/db/schema";
import {
  MATERIALS_WANTED,
  VOLUME_TIERS,
  daysUntilStale,
  type Exclusion,
  EXCLUSION_LABELS,
} from "@/lib/listing-options";
import { formatAuMobile } from "@/lib/phone";
import { ListingStatusButton } from "../listing-status-button";

export default async function AdminListingsPage() {
  const rows = await db
    .select({
      listing: listings,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
    })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .orderBy(desc(listings.createdAt))
    .limit(200);

  return (
    <>
      <h1 className="text-2xl font-semibold">Listings</h1>
      <p className="mt-2 text-sm text-muted">
        Every pin, newest first. Full addresses are shown here because running
        the site means being able to ring someone about a bad drop — treat this
        screen as the sensitive one it is.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No listings yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map(({ listing: l, ownerName, ownerEmail, ownerPhone }) => {
            const daysLeft = daysUntilStale(l.confirmedAt);
            return (
              <li key={l.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {l.addressLine}, {l.suburb} {l.state} {l.postcode}
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {ownerName}
                      {ownerEmail && ` · ${ownerEmail}`}
                      {ownerPhone && ` · ${formatAuMobile(ownerPhone)}`}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                      <Tag>{MATERIALS_WANTED[l.wanted].label}</Tag>
                      <Tag>{VOLUME_TIERS[l.tier].label}</Tag>
                      {l.preAuthorised && <Tag tone="brand">⚡ drop anytime</Tag>}
                      <Tag tone={l.status === "active" ? "brand" : "muted"}>{l.status}</Tag>
                      {l.status === "active" && daysLeft <= 7 && (
                        <Tag tone="accent">
                          {daysLeft > 0 ? `stale in ${daysLeft}d` : "overdue for confirmation"}
                        </Tag>
                      )}
                    </div>
                    {l.excludes.length > 0 && (
                      <div className="mt-2 text-sm text-muted">
                        Won&apos;t accept:{" "}
                        {l.excludes
                          .map((e) => EXCLUSION_LABELS[e as Exclusion]?.label.replace(/^No /, "") ?? e)
                          .join(", ")}
                      </div>
                    )}
                    {l.accessNotes && (
                      <div className="mt-2 text-sm text-muted">Access: {l.accessNotes}</div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {l.photoKey && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/photos/${l.photoKey}`}
                        alt="Drop spot"
                        loading="lazy"
                        className="h-20 w-32 rounded-lg border border-border object-cover"
                      />
                    )}
                    <ListingStatusButton listingId={l.id} status={l.status} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Tag({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "brand" | "muted" | "accent";
}) {
  const cls = {
    default: "border-border text-foreground",
    brand: "border-brand text-brand",
    muted: "border-border text-muted",
    accent: "border-accent text-accent",
  }[tone];
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}
