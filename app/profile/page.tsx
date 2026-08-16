import { redirect } from "next/navigation";
import { AppHeader } from "@/app/app-header";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { getReceiverStats, getSupplierStats } from "@/lib/db/stats";
import { formatAuMobile } from "@/lib/phone";
import { ProfileForm } from "./form";

/**
 * One route, two profiles.
 *
 * A crew and a gardener care about opposite things, so they get different
 * fields and different numbers. Showing a gardener a completion rate, or an
 * arborist a count of loads received, would be noise on both sides.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");

  const isSupplier = user.role === "supplier";
  const stats = isSupplier
    ? await getSupplierStats(user.id)
    : await getReceiverStats(user.id);

  return (
    <main className="flex-1">
      <AppHeader />

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold">
          {isSupplier ? "Your tree service" : "Your details"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {isSupplier
            ? "What gardeners see when you claim a drop, and how you're going."
            : "How crews reach you once you've accepted a drop."}
        </p>

        {/* --- record ------------------------------------------------------ */}
        <section className="mt-8">
          <h2 className="font-semibold">Your record</h2>
          {isSupplier ? (
            <SupplierRecord stats={stats as Awaited<ReturnType<typeof getSupplierStats>>} />
          ) : (
            <ReceiverRecord stats={stats as Awaited<ReturnType<typeof getReceiverStats>>} />
          )}
        </section>

        {/* --- editable ---------------------------------------------------- */}
        <section className="mt-10">
          <h2 className="font-semibold">Details</h2>
          <ProfileForm
            role={user.role}
            defaults={{
              name: user.name ?? "",
              phone: user.phone ? formatAuMobile(user.phone) : "",
              businessName: user.supplierProfile?.businessName ?? "",
              abn: user.supplierProfile?.abn ?? "",
              truckCapacityM3: user.supplierProfile?.truckCapacityM3 ?? "",
            }}
          />
        </section>

        <section className="mt-10 border-t border-border pt-8">
          <h2 className="font-semibold">Account</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Email">{user.email}</Row>
            <Row label="Signed up">
              {user.createdAt.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
            </Row>
            <Row label="Account type">{isSupplier ? "Tree service" : "Gardener"}</Row>
            {isSupplier && (
              <Row label="Approved">
                {isApprovedSupplier(user)
                  ? "Yes — you can see the map"
                  : "Not yet — we're checking your details"}
              </Row>
            )}
          </dl>
          <p className="mt-4 text-xs text-muted">
            Your email is how you sign in, so it can&apos;t be changed here. Email
            us if you need it moved.
          </p>
        </section>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

function SupplierRecord({ stats }: { stats: Awaited<ReturnType<typeof getSupplierStats>> }) {
  const rate = stats.completionRate;
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Stat label="Loads delivered" value={stats.delivered} />
        <Stat label="On the go" value={stats.active} />
        <Stat
          label="Claims that stuck"
          value={rate === null ? "—" : `${Math.round(rate * 100)}%`}
        />
        <Stat label="Dropped out" value={stats.cancelled + stats.expired} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {rate === null
          ? "Once you've finished a few drops this fills in."
          : "“Claims that stuck” is the share of your finished claims that became deliveries. Claims still on the go don’t count either way — a pin held until it lapsed counts the same as one you cancelled."}
      </p>
    </>
  );
}

function ReceiverRecord({ stats }: { stats: Awaited<ReturnType<typeof getReceiverStats>> }) {
  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Loads received" value={stats.loadsReceived} />
        <Stat
          label="Mulch delivered"
          value={stats.totalM3 > 0 ? `${Math.round(stats.totalM3)} m³` : "—"}
        />
        <Stat label="Active pins" value={stats.activeListings} />
      </div>
      <p className="mt-3 text-xs text-muted">
        {stats.loadsReceived === 0
          ? "Nothing delivered yet — this fills in once a crew tips a load."
          : "Volume is what drivers recorded, so treat it as a floor rather than an exact total."}
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
