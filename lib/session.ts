import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { supplierProfiles, users } from "@/lib/db/schema";
import type { SupplierProfile, User } from "@/lib/db/schema";

export type CurrentUser = User & { supplierProfile: SupplierProfile | null };

/**
 * Role lives in the database, never in the JWT. A token minted before someone
 * picked their side — or before an admin approved them — would otherwise keep
 * asserting stale authority for the life of the session. `cache` collapses the
 * repeat lookups within a single render.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [row] = await db
    .select()
    .from(users)
    .leftJoin(supplierProfiles, eq(supplierProfiles.userId, users.id))
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!row) return null;
  return { ...row.users, supplierProfile: row.supplier_profiles };
});

/** For pages that must have a user; callers handle the redirect. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/**
 * The privacy gate. A supplier sees pins — i.e. the approximate location of
 * strangers' homes — only once a human has approved them.
 */
export function isApprovedSupplier(user: CurrentUser | null): boolean {
  return user?.role === "supplier" && !!user.supplierProfile?.verifiedAt;
}

/**
 * Where the marketing CTAs should actually send this visitor.
 *
 * Every public call to action is really "start the thing I came here for", and
 * for someone already signed in that is never the sign-in page. Computed in
 * one place because the homepage alone has ten of these buttons, and each one
 * getting its own guess is how half of them end up wrong.
 */
export function receiverHref(user: CurrentUser | null): string {
  if (!user) return "/signin?role=receiver";
  if (!user.role) return "/onboarding?role=receiver";
  // A tree service tapping "I want mulch" is almost certainly exploring, and
  // createListing would refuse them anyway — the dashboard is the honest landing.
  return user.role === "receiver" ? "/listings/new" : "/dashboard";
}

export function supplierHref(user: CurrentUser | null): string {
  if (!user) return "/signin?role=supplier";
  if (!user.role) return "/onboarding?role=supplier";
  if (user.role !== "supplier") return "/dashboard";
  // Unapproved suppliers can't see the map; the dashboard explains why.
  return isApprovedSupplier(user) ? "/map" : "/dashboard";
}

/**
 * Admin is independent of role, so the same person can run the site and also
 * have a listing. Driven by ADMIN_EMAILS rather than a column, because a
 * database flag has no way to grant itself the first time.
 */
export function isAdmin(user: CurrentUser | null): boolean {
  if (!user?.email) return false;
  return adminEmails().includes(user.email.trim().toLowerCase());
}

function adminEmails(): string[] {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
