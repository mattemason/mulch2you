/**
 * Exercises the real migrations and the real nearby-listings query against a
 * throwaway in-process Postgres (PGlite). No Docker, no local install.
 *
 *   npx tsx scripts/verify-geo.ts
 *
 * Checks the things "it compiles" can't: that the migrations actually apply in
 * order, that the Haversine distance and its ORDER BY alias survive Drizzle's
 * SQL generation, that the bounding box doesn't clip real neighbours, and that
 * the query never selects a column we've promised not to expose.
 */
import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { drops, listings, users } from "../lib/db/schema";
import { findNearbyListings } from "../lib/db/queries";
import { fuzzCoords, haversineKm } from "../lib/geo";
import type { db as ProdDb } from "../lib/db";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

// Real Blue Mountains suburbs — a realistic spread for a radius search.
const KATOOMBA = { lat: -33.7148, lng: 150.3119 };
const LEURA = { lat: -33.7139, lng: 150.3311 };       // ~1.8 km from Katoomba
const PENRITH = { lat: -33.7506, lng: 150.6944 };     // ~35 km
const MELBOURNE = { lat: -37.8136, lng: 144.9631 };   // ~700 km

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  const mark = condition ? "✓" : "✗";
  if (!condition) failures++;
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const client = new PGlite();
  const database = drizzle(client) as unknown as typeof ProdDb;

  // --- migrations --------------------------------------------------------
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  console.log(`\nApplying ${files.length} migration(s):`);
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) {
      if (stmt.trim()) await client.exec(stmt);
    }
    console.log(`  ✓ ${file}`);
  }

  // --- seed --------------------------------------------------------------
  const [owner] = await database
    .insert(users)
    .values({ name: "Test Gardener", email: "gardener@example.com", role: "receiver" })
    .returning();

  async function seed(
    suburb: string,
    at: { lat: number; lng: number },
    extra: Partial<typeof listings.$inferInsert> = {},
  ) {
    const approx = fuzzCoords(at);
    await database.insert(listings).values({
      userId: owner.id,
      addressLine: "1 Test St",
      suburb,
      postcode: "2780",
      state: "NSW",
      lat: at.lat,
      lng: at.lng,
      approxLat: approx.lat,
      approxLng: approx.lng,
      wanted: "wood_chips",
      tier: "medium",
      maxVolumeM3: "6",
      dropSpot: "driveway",
      ...extra,
    });
  }

  await seed("Katoomba", KATOOMBA, { preAuthorised: true });
  await seed("Leura", LEURA);
  await seed("Penrith", PENRITH, { tier: "unlimited", maxVolumeM3: null });
  await seed("Melbourne", MELBOURNE);
  await seed("Katoomba (paused)", KATOOMBA, { status: "paused" });

  // --- radius ------------------------------------------------------------
  console.log("\nRadius search from Katoomba:");
  const near = await findNearbyListings(KATOOMBA, { radiusKm: 25 }, database);
  const suburbs = near.map((l) => l.suburb);
  check("finds local pins", suburbs.includes("Katoomba") && suburbs.includes("Leura"), suburbs.join(", "));
  check("excludes far pins", !suburbs.includes("Penrith") && !suburbs.includes("Melbourne"));
  check("excludes paused pins", !suburbs.includes("Katoomba (paused)"));
  check(
    "orders nearest first",
    near.every((l, i) => i === 0 || l.distanceKm >= near[i - 1].distanceKm),
    near.map((l) => l.distanceKm.toFixed(2)).join(" ≤ "),
  );

  const wide = await findNearbyListings(KATOOMBA, { radiusKm: 50 }, database);
  check("wider radius reaches Penrith", wide.some((l) => l.suburb === "Penrith"));
  check("wider radius still excludes Melbourne", !wide.some((l) => l.suburb === "Melbourne"));

  // --- distance accuracy -------------------------------------------------
  const leura = wide.find((l) => l.suburb === "Leura");
  if (leura) {
    const expected = haversineKm(KATOOMBA, { lat: leura.approxLat, lng: leura.approxLng });
    check(
      "SQL distance matches JS haversine",
      Math.abs(leura.distanceKm - expected) < 0.01,
      `sql=${leura.distanceKm.toFixed(3)} js=${expected.toFixed(3)}`,
    );
  } else {
    check("SQL distance matches JS haversine", false, "Leura missing");
  }

  // --- filters -----------------------------------------------------------
  console.log("\nFilters:");
  const instant = await findNearbyListings(KATOOMBA, { radiusKm: 25, preAuthorisedOnly: true }, database);
  check("instant-claim filter", instant.length === 1 && instant[0].preAuthorised, `${instant.length} pin(s)`);

  const unlimited = await findNearbyListings(KATOOMBA, { radiusKm: 50, tier: "unlimited" }, database);
  check("tier filter keeps matching pins", unlimited.some((l) => l.suburb === "Penrith"));
  check(
    "tier filter drops the rest",
    unlimited.every((l) => l.tier === "unlimited"),
    unlimited.map((l) => l.suburb).join(", ") || "none",
  );

  const chipsOnly = await findNearbyListings(KATOOMBA, { radiusKm: 50, wanted: "any_green_waste" }, database);
  check("material filter excludes non-matching pins", chipsOnly.length === 0, `${chipsOnly.length} pin(s)`);

  // --- claimed pins ------------------------------------------------------
  console.log("\nClaimed pins:");
  const [supplier] = await database
    .insert(users)
    .values({ name: "Test Crew", email: "crew@example.com", role: "supplier" })
    .returning();
  const [katoomba] = await database
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.suburb, "Katoomba"));

  await database.insert(drops).values({
    listingId: katoomba.id,
    supplierId: supplier.id,
    status: "accepted",
    expiresAt: new Date(Date.now() + 3600_000),
  });

  const afterClaim = await findNearbyListings(KATOOMBA, { radiusKm: 25 }, database);
  const claimed = afterClaim.find((l) => l.id === katoomba.id);
  check("a claimed pin is flagged pending", claimed?.pending === true, String(claimed?.pending));
  check(
    "unclaimed pins are not flagged",
    afterClaim.filter((l) => l.id !== katoomba.id).every((l) => !l.pending),
  );

  const hideTaken = await findNearbyListings(KATOOMBA, { radiusKm: 25, excludePending: true }, database);
  check(
    "excludePending drops the claimed pin",
    !hideTaken.some((l) => l.id === katoomba.id),
    `${hideTaken.length} pin(s) left`,
  );

  // Releasing it should put the pin straight back in play.
  await database
    .update(drops)
    .set({ status: "cancelled" })
    .where(eq(drops.listingId, katoomba.id));
  const afterRelease = await findNearbyListings(KATOOMBA, { radiusKm: 25 }, database);
  check(
    "a released claim frees the pin again",
    afterRelease.find((l) => l.id === katoomba.id)?.pending === false,
  );

  // --- the privacy guarantee --------------------------------------------
  console.log("\nPrivacy:");
  const leaked = ["lat", "lng", "addressLine", "userId"].filter(
    (k) => near.length > 0 && k in (near[0] as Record<string, unknown>),
  );
  check("no exact location or address in results", leaked.length === 0, leaked.join(", ") || "clean");
  check(
    "approximate pin is offset from the true one",
    near.every((l) => haversineKm({ lat: l.approxLat, lng: l.approxLng }, KATOOMBA) > 0 || l.suburb !== "Katoomba"),
  );

  await client.close();

  console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
