import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { OnboardingForm } from "./form";

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (user.role) redirect("/dashboard");

  const params = await searchParams;
  const preset = typeof params.role === "string" ? params.role : undefined;
  const role = preset === "supplier" || preset === "receiver" ? preset : null;

  if (!role) return <RolePicker />;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">
          {role === "supplier" ? "Set up your tree service" : "A couple of details"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {role === "supplier"
            ? "We approve every tree service by hand before showing you the map — we're publishing people's home addresses, so we're careful about it."
            : "Next you'll drop a pin where you'd like the mulch delivered."}
        </p>
        <OnboardingForm role={role} defaultName={user.name ?? ""} />
      </div>
    </main>
  );
}

function RolePicker() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">Which are you?</h1>
        <div className="mt-6 space-y-3">
          <Choice
            href="/onboarding?role=receiver"
            title="I want mulch"
            body="You've got a garden, community plot, school patch or paddock and you'll take a load of wood chip."
          />
          <Choice
            href="/onboarding?role=supplier"
            title="I've got mulch to drop"
            body="You're an arborist or tree service and you'd rather tip locally than pay at the transfer station."
          />
        </div>
      </div>
    </main>
  );
}

function Choice({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card block transition-colors hover:border-brand">
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </Link>
  );
}
