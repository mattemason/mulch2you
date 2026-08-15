import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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
