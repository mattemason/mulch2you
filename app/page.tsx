import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { FullLogo, Wordmark } from "@/app/logo";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Wordmark className="h-7" href={null} priority />
          <Link href={user ? "/dashboard" : "/signin"} className="btn-secondary py-2 text-sm">
            {user ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <FullLogo className="mb-10 h-auto w-full max-w-md rounded-xl bg-white p-4 shadow-sm" />
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Free wood chip, straight from the truck.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Tree crews pay to dump chip. Gardeners pay to buy mulch. Mulch2You puts
          the two on the same map so the load goes in your garden instead of a
          transfer station.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signin?role=receiver" className="btn-primary">
            I want mulch
          </Link>
          <Link href="/signin?role=supplier" className="btn-secondary">
            I&apos;m an arborist with a load
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card/50">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2">
          <Side
            title="Gardeners"
            steps={[
              "Drop a pin at your place and say how much you'll take.",
              "Tell us what you won't accept — palm, pine, thorny, diseased.",
              "Add a photo of where the truck should tip.",
              "Say yes when a crew is nearby, or let them drop anytime.",
            ]}
          />
          <Side
            title="Arborists"
            steps={[
              "Open the map at the job site and see who wants chip nearby.",
              "Filter to pins that'll take a full truck.",
              "One tap on a pre-approved pin gets you the address.",
              "Tip for free, minutes away, instead of driving to the depot.",
            ]}
          />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-muted">
          Mulch2You introduces gardeners to tree crews. It doesn&apos;t own,
          inspect or warrant the material — loads are accepted as-is.
        </div>
      </footer>
    </main>
  );
}

function Side({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-muted">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-fg">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
