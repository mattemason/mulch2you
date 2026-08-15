"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { supplierProfiles, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/session";
import { normaliseAuMobile } from "@/lib/phone";

export type OnboardingState = { error?: string };

const receiverSchema = z.object({
  role: z.literal("receiver"),
  name: z.string().trim().min(2, "Please enter your name"),
});

const supplierSchema = z.object({
  role: z.literal("supplier"),
  name: z.string().trim().min(2, "Please enter your name"),
  businessName: z.string().trim().min(2, "Please enter your business name"),
  abn: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ""))
    .refine((v) => v === "" || /^\d{11}$/.test(v), "An ABN is 11 digits")
    .optional(),
  phone: z.string().trim().min(1, "A mobile number is required"),
});

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const raw = Object.fromEntries(formData) as Record<string, string>;

  if (raw.role === "supplier") {
    const parsed = supplierSchema.safeParse(raw);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    // Suppliers get texted the moment a receiver accepts, so a reachable
    // mobile is a hard requirement rather than a nice-to-have.
    const phone = normaliseAuMobile(parsed.data.phone);
    if (!phone) return { error: "That doesn't look like an Australian mobile number" };

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role: "supplier", name: parsed.data.name, phone })
        .where(eq(users.id, user.id));

      await tx
        .insert(supplierProfiles)
        .values({
          userId: user.id,
          businessName: parsed.data.businessName,
          abn: parsed.data.abn || null,
        })
        .onConflictDoUpdate({
          target: supplierProfiles.userId,
          set: { businessName: parsed.data.businessName, abn: parsed.data.abn || null },
        });
    });

    redirect("/dashboard");
  }

  const parsed = receiverSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db
    .update(users)
    .set({ role: "receiver", name: parsed.data.name })
    .where(eq(users.id, user.id));

  redirect("/dashboard");
}
