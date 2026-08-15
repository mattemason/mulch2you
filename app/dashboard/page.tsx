import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { listings } from "@/lib/db/schema";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");

  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Mulch<span className="text-brand">2</span>You
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="text-sm text-muted hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">
          G&apos;day{user.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>

        {user.role === "supplier" ? (
          <SupplierPanel approved={isApprovedSupplier(user)} />
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
    <ul className="mt-6 space-y-3">
      {mine.map((l) => (
        <li key={l.id} className="card flex items-center justify-between">
          <div>
            <div className="font-medium">
              {l.suburb} {l.state} {l.postcode}
            </div>
            <div className="mt-0.5 text-sm text-muted">
              {l.maxVolumeM3 ? `Up to ${l.maxVolumeM3} m³` : "Unlimited"}
              {l.preAuthorised && " · drop anytime"} · {l.status}
            </div>
          </div>
          <Link href={`/listings/${l.id}`} className="text-sm text-brand hover:underline">
            Edit
          </Link>
        </li>
      ))}
    </ul>
  );
}

function SupplierPanel({ approved }: { approved: boolean }) {
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

  return (
    <div className="card mt-6">
      <h2 className="font-semibold">Got a full truck?</h2>
      <p className="mt-1 text-sm text-muted">
        Open the map to see who wants chip near your current job.
      </p>
      <Link href="/map" className="btn-primary mt-5">
        Find a drop nearby
      </Link>
    </div>
  );
}
