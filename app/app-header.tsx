import Link from "next/link";
import { signOut } from "@/auth";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { Wordmark } from "@/app/logo";

/**
 * The signed-in header, on every page.
 *
 * Deliberately the same everywhere, including the map: a driver who taps into
 * a site and wants back out shouldn't have to work out which screen they're on
 * to find the way. Kept short so it costs little on the map, where vertical
 * space is the scarcest thing there is.
 */
export async function AppHeader() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isSupplier = user.role === "supplier";

  // The same page means different things to the two sides, so it gets the name
  // each of them would use for it. Both are abbreviated on a phone — the header
  // is one fixed-height row and the full labels crowd it off the screen.
  const home = isSupplier
    ? { short: "Drops", full: "Find & manage drops" }
    : { short: "Listings", full: "My listings" };

  return (
    <header className="shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 sm:gap-4">
        <Link href="/dashboard" aria-label="Mulch2U dashboard" className="inline-flex">
          <Wordmark size={20} href={null} />
        </Link>

        <nav className="flex items-center gap-3 text-sm sm:gap-4">
          <Link href="/dashboard" className="text-muted hover:text-foreground">
            <span className="sm:hidden">{home.short}</span>
            <span className="hidden sm:inline">{home.full}</span>
          </Link>
          <Link href="/profile" className="text-muted hover:text-foreground">
            Profile
          </Link>
          {isAdmin(user) && (
            <Link href="/admin" className="text-muted hover:text-foreground">
              Admin
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button type="submit" className="text-muted hover:text-foreground">
              Sign out
            </button>
          </form>

          {/* Drivers decide to take a load while standing next to the truck, on
              whatever screen they happen to be on — so the way to the map is in
              the corner of every page rather than only on the dashboard.
              Compact: the full btn-primary padding is taller than this header. */}
          {isSupplier && (
            <Link
              href="/map"
              className="btn-primary h-8 shrink-0 rounded-lg px-3 py-0 text-sm"
            >
              Find a drop<span className="hidden sm:inline">&nbsp;nearby</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
