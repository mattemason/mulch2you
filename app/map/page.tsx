import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { SupplierMap } from "./map-client";

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");
  // Receivers and unapproved suppliers never reach the map; the API enforces
  // the same rule independently, so this is convenience rather than the gate.
  if (!isApprovedSupplier(user)) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Dashboard
          </Link>
          <span className="text-sm font-semibold">Drops near you</span>
        </div>
      </header>

      {/* MapTiler keys are public by design and restricted by domain. */}
      <SupplierMap maptilerKey={env.MAPTILER_KEY ?? null} />
    </main>
  );
}
