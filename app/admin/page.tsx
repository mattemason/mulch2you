import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { drops, listings, supplierProfiles, users } from "@/lib/db/schema";
import { geocoderName } from "@/lib/geocode";
import { env } from "@/lib/env";
import { Diagnostics } from "./diagnostics";
import { testGeocoder } from "./actions";

type Tally = { key: string | null; n: number };

const tally = (rows: Tally[], key: string) => rows.find((r) => r.key === key)?.n ?? 0;
const total = (rows: Tally[]) => rows.reduce((sum, r) => sum + r.n, 0);

export default async function AdminOverviewPage() {
  const [listingRows, dropRows, userRows, supplierRows] = await Promise.all([
    db
      .select({ key: listings.status, n: sql<number>`count(*)::int` })
      .from(listings)
      .groupBy(listings.status),
    db.select({ key: drops.status, n: sql<number>`count(*)::int` }).from(drops).groupBy(drops.status),
    db.select({ key: users.role, n: sql<number>`count(*)::int` }).from(users).groupBy(users.role),
    db
      .select({
        key: sql<string>`case when ${supplierProfiles.verifiedAt} is null then 'pending' else 'approved' end`,
        n: sql<number>`count(*)::int`,
      })
      .from(supplierProfiles)
      .groupBy(sql`case when ${supplierProfiles.verifiedAt} is null then 'pending' else 'approved' end`),
  ]);

  const pending = tally(supplierRows, "pending");

  // Probed on load rather than behind a button: address lookup has been
  // quietly falling back for days, and a warning nobody clicks for is a
  // warning nobody sees.
  const geocoder = await testGeocoder();

  return (
    <>
      <h1 className="text-2xl font-semibold">Overview</h1>

      {pending > 0 && (
        <Link
          href="/admin/suppliers"
          className="card mt-6 flex items-center justify-between gap-4 border-brand transition-colors hover:bg-background"
        >
          <div>
            <div className="font-medium">
              {pending} tree {pending === 1 ? "service is" : "services are"} waiting for approval
            </div>
            <div className="mt-0.5 text-sm text-muted">
              They can&apos;t see a single pin until you approve them.
            </div>
          </div>
          <span aria-hidden className="text-xl text-brand">
            →
          </span>
        </Link>
      )}

      {!geocoder.ok && (
        <div className="card mt-6 border-accent">
          <div className="font-medium text-accent">
            Address lookup is failing — {geocoder.provider} isn&apos;t answering
          </div>
          <p className="mt-1 text-sm text-muted">{geocoder.summary}</p>
          {geocoder.detail && (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">
              {geocoder.detail}
            </pre>
          )}
          <p className="mt-3 text-sm text-muted">
            Listings still work — lookups fall back to Photon, which is free but
            weaker on unit numbers and new estates.
          </p>
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gardeners" value={tally(userRows, "receiver")} />
        <Stat label="Tree services" value={tally(userRows, "supplier")} hint={`${tally(supplierRows, "approved")} approved`} />
        <Stat label="Active pins" value={tally(listingRows, "active")} hint={`${total(listingRows)} all up`} />
        <Stat
          label="Drops delivered"
          value={tally(dropRows, "completed")}
          hint={`${tally(dropRows, "accepted")} in progress`}
        />
      </section>

      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        <Breakdown title="Listings" rows={listingRows} empty="Nobody has listed a pin yet." />
        <Breakdown title="Drops" rows={dropRows} empty="No drops yet." />
      </section>

      <section className="mt-10">
        <h2 className="font-semibold">Configuration</h2>
        <dl className="card mt-3 space-y-2 text-sm">
          <Row label="Address lookup">{geocoderName()}</Row>
          <Row label="Map tiles">
            {env.MAPTILER_KEY ? "MapTiler" : "OpenFreeMap — free, no key needed"}
          </Row>
          <Row label="Outbound email">
            {env.POSTMARK_SERVER_TOKEN ? `Postmark, from ${env.EMAIL_FROM}` : "Not configured"}
          </Row>
          <Row label="SMS">{env.TWILIO_ACCOUNT_SID ? "Twilio" : "Not configured"}</Row>
          <Row label="Photo storage">{env.UPLOAD_DIR}</Row>
          <Row label="Public URL">{env.AUTH_URL ?? "Derived from request headers"}</Row>
        </dl>
      </section>

      <Diagnostics />
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: Tally[]; empty: string }) {
  return (
    <div>
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="card mt-3 space-y-1.5 text-sm">
          {rows
            .slice()
            .sort((a, b) => b.n - a.n)
            .map((r) => (
              <li key={r.key} className="flex justify-between gap-4">
                <span className="text-muted">{r.key?.replace(/_/g, " ") ?? "unknown"}</span>
                <span className="tabular-nums">{r.n}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
