CREATE TYPE "public"."drop_spot" AS ENUM('driveway', 'nature_strip', 'behind_gate', 'paddock', 'other');--> statement-breakpoint
CREATE TYPE "public"."drop_status" AS ENUM('offered', 'accepted', 'declined', 'expired', 'completed', 'no_show', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'paused', 'fulfilled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('receiver', 'supplier', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "drops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"supplier_id" text NOT NULL,
	"volume_m3" numeric(5, 1),
	"species" text,
	"eta_window" text,
	"status" "drop_status" DEFAULT 'offered' NOT NULL,
	"accept_token" text,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drops_accept_token_unique" UNIQUE("accept_token")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"address_line" text NOT NULL,
	"suburb" text NOT NULL,
	"postcode" text NOT NULL,
	"state" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"approx_lat" double precision NOT NULL,
	"approx_lng" double precision NOT NULL,
	"max_volume_m3" numeric(5, 1),
	"min_volume_m3" numeric(5, 1),
	"excludes" text[] DEFAULT '{}' NOT NULL,
	"drop_spot" "drop_spot" NOT NULL,
	"access_notes" text,
	"photo_url" text,
	"pre_authorised" boolean DEFAULT false NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"drop_id" uuid NOT NULL,
	"rater_id" text NOT NULL,
	"positive" boolean NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"business_name" text NOT NULL,
	"abn" text,
	"truck_capacity_m3" numeric(4, 1),
	"insurance_doc_url" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "user_role",
	"phone" text,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drops" ADD CONSTRAINT "drops_supplier_id_users_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_drop_id_drops_id_fk" FOREIGN KEY ("drop_id") REFERENCES "public"."drops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drops_listing_idx" ON "drops" USING btree ("listing_id","status");--> statement-breakpoint
CREATE INDEX "drops_supplier_idx" ON "drops" USING btree ("supplier_id","status");--> statement-breakpoint
CREATE INDEX "listings_map_idx" ON "listings" USING btree ("status","approx_lat","approx_lng");--> statement-breakpoint
CREATE INDEX "listings_user_idx" ON "listings" USING btree ("user_id");