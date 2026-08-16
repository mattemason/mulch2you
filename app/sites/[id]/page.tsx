import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, users } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { haversineKm, formatDistance } from "@/lib/geo";
import { listingRef } from "@/lib/refs";
import {
  DROP_SPOTS,
  EXCLUSION_LABELS,
  MATERIALS_WANTED,
  VOLUME_TIERS,
  CLAIM_WINDOW_HOURS,
  type DropSpotKey,
  type Exclusion,
} from "@/lib/listing-options";
import { Icon } from "@/app/map/icons";
import { ClaimBar } from "./claim-bar";
import "@/app/supplier-ui.css";

/**
 * What a driver sees before committing.
 *
 * Everything here is the pre-claim view: suburb, an approximate pin, and the
 * access detail they need to judge whether their truck fits. The street
 * address and a phone number appear only after claiming, on /drops/[id].
 */
export default async function SitePage({ params, searchParams }: PageProps<"/sites/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isApprovedSupplier(user)) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;

  const [row] = await db
    .select({ listing: listings, ownerName: users.name, ownerSince: users.createdAt })
    .from(listings)
    .innerJoin(users, eq(users.id, listings.userId))
    .where(eq(listings.id, id))
    .limit(1);

  if (!row) notFound();
  const { listing } = row;

  // Already claimed by this driver? Send them to the live drop rather than
  // showing a claim button that would fail.
  const [existing] = await db
    .select({ id: drops.id })
    .from(drops)
    .where(and(eq(drops.listingId, id), eq(drops.supplierId, user.id), eq(drops.status, "accepted")))
    .orderBy(desc(drops.createdAt))
    .limit(1);
  if (existing) redirect(`/drops/${existing.id}`);

  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];
  const tier = VOLUME_TIERS[listing.tier];
  const firstName = row.ownerName?.split(" ")[0] ?? "The customer";
  const initials = (row.ownerName ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // The map passes where the driver was searching from, so the distance shown
  // here matches the card they tapped. Absent it, distance is simply omitted
  // rather than invented.
  const from = parseCoords(sp.lat, sp.lng);
  const distanceKm = from
    ? haversineKm(from, { lat: listing.approxLat, lng: listing.approxLng })
    : null;

  const unavailable = listing.status !== "active";

  return (
    <div className="m2y m2y-detail">
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/map" className="icon-btn" aria-label="Back to map">
            <Icon.back />
          </Link>
          <h1>
            {listing.suburb} <span className="ref">· {listingRef(listing.id)}</span>
          </h1>
        </div>
      </header>

      <div className="head">
        <div className="wrap">
          <div className="badges">
            {listing.preAuthorised ? (
              <span className="badge badge--now">
                <Icon.bolt size={10} /> Drop now — no approval
              </span>
            ) : (
              <span className="badge badge--approve">Needs approval first</span>
            )}
            <span className="badge badge--size">
              {listing.tier === "unlimited" ? "Send everything" : tier.label}
            </span>
            <span className="badge">{MATERIALS_WANTED[listing.wanted].label}</span>
          </div>
          <h2 className="title">
            {listing.suburb}, {listing.state} {listing.postcode}
          </h2>
          <p className="sub">
            {distanceKm !== null && `${formatDistance(distanceKm)} from where you searched · `}
            {listedAgo(listing.createdAt)}
          </p>

          <div className="head-stats">
            <div className="hstat">
              <div className="v">{listing.maxVolumeM3 ? `${Number(listing.maxVolumeM3)}m³` : "Any"}</div>
              <div className="k">Max load</div>
            </div>
            <div className="hstat">
              <div className="v">{spot?.label ?? listing.dropSpot}</div>
              <div className="k">Tips on</div>
            </div>
            <div className="hstat">
              <div className="v">{listing.preAuthorised ? "None" : "Required"}</div>
              <div className="k">Approval</div>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap">
        <section className="panelcard">
          <h2>The drop</h2>
          <div className="facts">
            <Fact icon={<Icon.box />} k="Where it tips" v={spot?.label ?? listing.dropSpot} n={spot?.hint} />
            <Fact
              icon={<Icon.leaf />}
              k="What they want"
              v={MATERIALS_WANTED[listing.wanted].label}
              n={MATERIALS_WANTED[listing.wanted].blurb}
            />
            <Fact
              icon={<Icon.truck />}
              k="Max load"
              v={listing.maxVolumeM3 ? `${Number(listing.maxVolumeM3)} m³` : "No limit"}
              n={listing.tier === "unlimited" ? "Send everything you've got" : "Don't tip more than this"}
            />
            <Fact
              icon={<Icon.bolt />}
              k="Claiming"
              v={listing.preAuthorised ? "Instant" : "Needs approval"}
              n={
                listing.preAuthorised
                  ? "Address released straight away"
                  : "The gardener has to say yes first"
              }
            />
          </div>
        </section>

        <section className="panelcard">
          <h2>What they won&apos;t take</h2>
          <div className="chips">
            {listing.excludes.length === 0 ? (
              <span className="chip-ok">Anything goes</span>
            ) : (
              <>
                {listing.excludes.map((e) => (
                  <span className="chip-no" key={e}>
                    <Icon.ban />
                    {EXCLUSION_LABELS[e as Exclusion]?.label.replace(/^No /, "") ?? e}
                  </span>
                ))}
                <span className="chip-ok">Everything else is fine</span>
              </>
            )}
          </div>
        </section>

        <section className="panelcard">
          <h2>The drop spot</h2>
          <div className="photo">
            {listing.photoKey ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/api/photos/${listing.photoKey}`} alt="The drop spot at this site" />
            ) : (
              <div className="photo-empty">
                <Icon.photo size={40} />
                <p>No photo — ring ahead if you&apos;re unsure of access</p>
              </div>
            )}
          </div>
        </section>

        {listing.accessNotes && (
          <section className="panelcard">
            <h2>Access notes from the customer</h2>
            <div className="notes">
              <p>{listing.accessNotes}</p>
            </div>
          </section>
        )}

        <section className="panelcard">
          <h2>Roughly here</h2>
          <div className="minimap">
            <ApproxMap suburb={listing.suburb} />
          </div>
          <div className="approx">
            <Icon.shield />
            <span>
              We show an approximate location until the drop is claimed. The exact
              address and a contact number are released the moment you claim it.
            </span>
          </div>
        </section>

        <section className="panelcard">
          <h2>The customer</h2>
          <div className="person">
            <div className="avatar">{initials}</div>
            <div>
              <div className="nm">{firstName}</div>
              <div className="mt">
                Member since{" "}
                {row.ownerSince.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
        </section>

        <div style={{ height: 8 }} />
      </div>

      <ClaimBar
        listingId={listing.id}
        preAuthorised={listing.preAuthorised}
        unavailable={unavailable}
        maxVolume={listing.maxVolumeM3 ? `${Number(listing.maxVolumeM3)} m³` : "any amount"}
        excludes={listing.excludes.map(
          (e) => EXCLUSION_LABELS[e as Exclusion]?.label.replace(/^No /, "") ?? e,
        )}
        dropSpot={spot?.label ?? listing.dropSpot}
        holdHours={CLAIM_WINDOW_HOURS}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Fact({
  icon,
  k,
  v,
  n,
}: {
  icon: React.ReactNode;
  k: string;
  v: string;
  n?: string;
}) {
  return (
    <div className="fact">
      <div className="k">
        {icon}
        {k}
      </div>
      <div className="v">{v}</div>
      {n && <div className="n">{n}</div>}
    </div>
  );
}

/** Illustrative — the real position is deliberately not on this page. */
function ApproxMap({ suburb }: { suburb: string }) {
  return (
    <svg viewBox="0 0 600 220" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Approximate location">
      <rect width="600" height="220" fill="#EEF2E8" />
      <path d="M20 150 q60-34 130-12 q34 50-18 86 q-78 20-112-26z" fill="#DCE9D3" />
      <path
        d="M-20 70 q120 34 214-8 q104-46 214 8 q78 38 256 6"
        stroke="#CBDDE8"
        strokeWidth="30"
        fill="none"
        strokeLinecap="round"
      />
      <g stroke="#fff" fill="none" strokeLinecap="round">
        <path d="M0 40h600" strokeWidth="10" />
        <path d="M0 120h600" strokeWidth="13" />
        <path d="M0 186h600" strokeWidth="8" />
        <path d="M120 0v220" strokeWidth="11" />
        <path d="M320 0v220" strokeWidth="9" />
        <path d="M470 0v220" strokeWidth="10" />
      </g>
      <g fill="#E2E7DA">
        <rect x="150" y="140" width="60" height="34" rx="4" />
        <rect x="360" y="52" width="66" height="36" rx="4" />
        <rect x="500" y="140" width="58" height="34" rx="4" />
      </g>
      <circle cx="300" cy="112" r="62" fill="#2E7D22" opacity=".14" />
      <circle
        cx="300"
        cy="112"
        r="62"
        fill="none"
        stroke="#2E7D22"
        strokeWidth="2"
        strokeDasharray="7 6"
        opacity=".55"
      />
      <g transform="translate(300,112)">
        <path
          d="M0-34a16 16 0 0 1 16 16c0 12-16 25-16 25S-16 -6-16 -18A16 16 0 0 1 0-34z"
          fill="#E8631A"
          stroke="#fff"
          strokeWidth="2.4"
        />
        <circle cx="0" cy="-18" r="6" fill="#fff" />
      </g>
      <text x="16" y="206" fontSize="12" fontWeight="700" fill="#8A9280">
        {suburb.toUpperCase()}
      </text>
    </svg>
  );
}

function parseCoords(lat: unknown, lng: unknown) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) ? { lat: a, lng: b } : null;
}

function listedAgo(createdAt: Date): string {
  const days = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
  if (days < 1) return "listed today";
  if (days === 1) return "listed yesterday";
  return `listed ${days} days ago`;
}
