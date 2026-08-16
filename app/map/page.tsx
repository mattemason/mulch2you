import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getCurrentUser, isApprovedSupplier } from "@/lib/session";
import { AppHeader } from "@/app/app-header";
import { SupplierMap } from "./map-client";

export default async function MapPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");
  // Receivers and unapproved suppliers never reach the map; the API enforces
  // the same rule independently, so this is convenience rather than the gate.
  if (!isApprovedSupplier(user)) redirect("/dashboard");

  // MapTiler keys are public by design and restricted by domain; absent one,
  // the map falls back to OpenFreeMap, which needs no key at all.
  return (
    // h-dvh + min-h-0 so the map takes exactly what's left under the header
    // rather than overflowing the viewport by its height.
    <div className="flex h-dvh flex-col">
      <AppHeader />
      <SupplierMap maptilerKey={env.MAPTILER_KEY ?? null} />
    </div>
  );
}
