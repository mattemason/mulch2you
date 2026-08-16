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

  // The same page means different things to the two sides, so it gets the
  // name each of them would use for it.
  const homeLabel =
    user.role === "supplier" ? "Find & manage drops" : "My listings";

  return (
    <header className="shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/dashboard" aria-label="Mulch2You dashboard" className="inline-flex">
          <Wordmark className="h-5" href={null} />
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-muted hover:text-foreground">
            {homeLabel}
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
        </nav>
      </div>
    </header>
  );
}
