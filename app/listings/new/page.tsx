import { redirect } from "next/navigation";
import { AppHeader } from "@/app/app-header";
import { getCurrentUser } from "@/lib/session";
import { geocoderName } from "@/lib/geocode";
import { NewListingForm } from "./form";

export default async function NewListingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.role) redirect("/onboarding");
  if (user.role !== "receiver") redirect("/dashboard");

  return (
    <main className="flex-1">
      <AppHeader />

      <div className="mx-auto max-w-2xl px-6 py-10">
        <NewListingForm geocoder={geocoderName()} />
      </div>
    </main>
  );
}
