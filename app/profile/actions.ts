"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { normaliseAuMobile } from "@/lib/phone";

export type ProfileState = { error?: string; ok?: string };

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  businessName: z.string().trim().min(2, "Please enter your business name"),
  phone: z.string().trim().min(1, "A mobile number is required"),
  abn: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "An ABN is 11 digits"),
  truckCapacityM3: z
    .string()
    .trim()
    .refine((v) => v === "" || (Number(v) > 0 && Number(v) <= 50), "Between 1 and 50 m³"),
});

const receiverSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  phone: z.string().trim(),
});

export async function saveProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const raw = Object.fromEntries(formData) as Record<string, string>;

  if (user.role === "supplier") {
    const parsed = supplierSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    const phone = normaliseAuMobile(parsed.data.phone);
    if (!phone) return { error: "That doesn't look like an Australian mobile number." };

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: parsed.data.name, phone })
        .where(eq(users.id, user.id));
      await tx
        .update(supplierProfiles)
        .set({
          businessName: parsed.data.businessName,
          abn: parsed.data.abn || null,
          truckCapacityM3: parsed.data.truckCapacityM3 || null,
        })
        .where(eq(supplierProfiles.userId, user.id));
    });

    revalidatePath("/profile");
    return { ok: "Saved." };
  }

  const parsed = receiverSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Optional for a gardener: they're reachable by email, and a mobile only
  // matters once a crew is on the way.
  let phone: string | null = null;
  if (parsed.data.phone) {
    phone = normaliseAuMobile(parsed.data.phone);
    if (!phone) return { error: "That doesn't look like an Australian mobile number." };
  }

  await db
    .update(users)
    .set({ name: parsed.data.name, phone })
    .where(eq(users.id, user.id));

  revalidatePath("/profile");
  return { ok: "Saved." };
}
