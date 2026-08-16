ALTER TABLE "drops" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drops" ADD COLUMN "cancelled_reason" text;