import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { Wordmark } from "@/app/logo";
import {
  ETA_WINDOWS,
  MATERIALS_WANTED,
  hasExpired,
  tipsPhrase,
  type EtaWindowKey,
} from "@/lib/listing-options";
import { RespondButtons } from "./buttons";

/**
 * Where an emailed request gets answered. No sign-in: the token in the URL is
 * the credential, and it's spent on the first answer either way.
 *
 * Rendering is all this page does. Accepting happens through a POST from the
 * buttons below, because mail scanners follow links before the recipient does
 * — a GET that accepted would hand an address to a security appliance.
 */
export default async function RespondPage({ params }: PageProps<"/respond/[token]">) {
  const { token } = await params;

  const [row] = await db
    .select({
      drop: drops,
      listing: listings,
      supplierName: users.name,
      businessName: supplierProfiles.businessName,
    })
    .from(drops)
    .innerJoin(listings, eq(listings.id, drops.listingId))
    .innerJoin(users, eq(users.id, drops.supplierId))
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, drops.supplierId))
    .where(eq(drops.acceptToken, token))
    .limit(1);

  // A spent token is the normal end state, not an error worth a 404 page —
  // but there's nothing to show either, so treat an unknown token plainly.
  if (!row) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">This link has been used</h1>
        <p className="mt-3 text-muted">
          You&apos;ve already answered this request, or it lapsed and the crew
          moved on. Nothing more to do here.
        </p>
      </Shell>
    );
  }

  const { drop, listing } = row;
  if (drop.status !== "offered") notFound();

  const crew = row.businessName ?? row.supplierName ?? "A local tree service";
  const eta = drop.etaWindow ? ETA_WINDOWS[drop.etaWindow as EtaWindowKey]?.label : null;
  const expired = hasExpired(drop.expiresAt);

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">{crew} can drop mulch</h1>
      <p className="mt-3 text-muted">
        For your listing at {listing.suburb} {listing.state} {listing.postcode}.
      </p>

      <dl className="card mt-6 space-y-3 text-sm">
        <Row label="Crew">{crew}</Row>
        {eta && <Row label="When">{eta}</Row>}
        <Row label="How much">
          {drop.volumeM3 ? `About ${drop.volumeM3} m³` : "They didn't say — ask when they call"}
        </Row>
        {drop.species && <Row label="What">{drop.species}</Row>}
        <Row label="You asked for">{MATERIALS_WANTED[listing.wanted].label}</Row>
        <Row label="Tipping">{tipsPhrase(listing.dropSpot)}</Row>
      </dl>

      {expired ? (
        <p className="mt-6 rounded-lg border border-border bg-card p-4 text-sm text-accent">
          This request has lapsed — the crew will have moved on. You don&apos;t
          need to do anything.
        </p>
      ) : (
        <>
          <RespondButtons token={token} crew={crew} />
          <p className="mt-4 text-xs text-muted">
            Saying yes gives {crew} your street address and phone number so they
            can find you. Saying no tells them to look elsewhere — your pin stays
            on the map either way.
          </p>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-lg items-center px-6 py-4">
          <Wordmark className="h-6" />
        </div>
      </header>
      <div className="mx-auto max-w-lg px-6 py-10">{children}</div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
