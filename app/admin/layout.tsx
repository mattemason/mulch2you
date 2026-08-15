import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { Wordmark } from "@/app/logo";
import { AdminNav } from "./nav";

/**
 * One guard for the whole admin area. Every action underneath re-checks
 * independently — this is convenience, not the control — but putting it in the
 * layout means a new admin page can't be added without it.
 *
 * 404 rather than 403: no reason to tell a stranger the admin area exists.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!isAdmin(user)) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Wordmark className="h-6" />
            <span className="rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted">
              admin
            </span>
          </div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            Back to site
          </Link>
        </div>
        <div className="mx-auto max-w-5xl px-6">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
