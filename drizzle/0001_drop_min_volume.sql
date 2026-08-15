CREATE TYPE "public"."volume_tier" AS ENUM('small', 'medium', 'large', 'unlimited');--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN "min_volume_m3";