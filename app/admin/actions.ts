"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser, isAdmin } from "@/lib/session";
import { sendSupplierApprovedEmail } from "@/lib/email";
import { env } from "@/lib/env";

export type AdminResult = { error?: string; ok?: string };

/**
 * Approving a supplier is the moment they gain sight of strangers' home
 * locations, so it's deliberately a human decision rather than anything
 * automatic. Every action here re-checks admin server-side — the /admin page
 * guard is convenience, this is the actual control.
 */
export async function approveSupplier(userId: string): Promise<AdminResult> {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return { error: "Not authorised." };

  const [row] = await db
    .select({ email: users.email, name: users.name, verifiedAt: supplierProfiles.verifiedAt })
    .from(supplierProfiles)
    .innerJoin(users, eq(users.id, supplierProfiles.userId))
    .where(eq(supplierProfiles.userId, userId))
    .limit(1);

  if (!row) return { error: "No such supplier." };
  if (row.verifiedAt) return { ok: "Already approved." };

  await db
    .update(supplierProfiles)
    .set({ verifiedAt: new Date() })
    .where(eq(supplierProfiles.userId, userId));

  // The dashboard promises "we'll email you as soon as you're through", so
  // send it — but don't fail the approval if the mail provider is down.
  if (row.email) {
    try {
      await sendSupplierApprovedEmail({
        to: row.email,
        name: row.name,
        mapUrl: `${await baseUrl()}/map`,
      });
    } catch (err) {
      console.error("approval email failed", err);
      revalidatePath("/admin");
      return { ok: "Approved, but the notification email didn't send." };
    }
  }

  revalidatePath("/admin");
  return { ok: "Approved and notified." };
}

export async function revokeSupplier(userId: string): Promise<AdminResult> {
  const admin = await getCurrentUser();
  if (!isAdmin(admin)) return { error: "Not authorised." };

  await db
    .update(supplierProfiles)
    .set({ verifiedAt: null })
    .where(eq(supplierProfiles.userId, userId));

  revalidatePath("/admin");
  return { ok: "Access revoked." };
}

async function baseUrl(): Promise<string> {
  if (env.AUTH_URL) return env.AUTH_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
