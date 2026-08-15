import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

/* -------------------------------------------------------------------------- */
/*  Domain vocabulary                                                          */
/* -------------------------------------------------------------------------- */

/**
 * "supplier" is an arborist / tree service with chip to get rid of.
 * "receiver" is a gardener, community garden, school or farm that wants it.
 * Deliberately not calling suppliers "loppers" — in the AU trade, lopping is
 * bad practice and qualified arborists take the word as an insult.
 */
export const userRole = pgEnum("user_role", ["receiver", "supplier", "admin"]);

export const listingStatus = pgEnum("listing_status", ["active", "paused", "fulfilled"]);

/**
 * How much the receiver will take. A band rather than a number, because it's
 * what the receiver is billed against and nobody can verify delivered volume.
 * Ceilings and prices live in lib/listing-options.ts.
 */
export const volumeTier = pgEnum("volume_tier", ["small", "medium", "large", "unlimited"]);

/**
 * What the receiver actually wants on the truck. Broadest option first in the
 * driver's mind: "any green waste" takes loads nobody else will, which is
 * exactly the material a crew most wants rid of.
 */
export const materialWanted = pgEnum("material_wanted", [
  "wood_chips",
  "mulch_and_chips",
  "any_green_waste",
]);

export const dropStatus = pgEnum("drop_status", [
  "offered",
  "accepted",
  "declined",
  "expired",
  "completed",
  "no_show",
  "cancelled",
]);

/** Where the truck actually tips the load. Drives the access warnings in the UI. */
export const dropSpot = pgEnum("drop_spot", [
  "driveway",
  "nature_strip",
  "behind_gate",
  "paddock",
  "other",
]);

/** Material a receiver refuses. Stored as text[] so adding kinds needs no migration. */
export const EXCLUSIONS = [
  "palm",
  "pine",
  "conifer",
  "thorny",
  "diseased",
  "camphor_laurel",
  "privet",
  "stump_grindings",
] as const;
export type Exclusion = (typeof EXCLUSIONS)[number];

export const ETA_WINDOWS = ["within_2h", "today", "tomorrow", "this_week"] as const;
export type EtaWindow = (typeof ETA_WINDOWS)[number];

/* -------------------------------------------------------------------------- */
/*  Auth.js tables                                                             */
/*  Shapes are dictated by @auth/drizzle-adapter — text ids, exact column       */
/*  names. Extra columns (role, phone) are ours and safe to add.                */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  image: text("image"),

  /** Null until the user picks a side in /onboarding. */
  role: userRole("role"),
  /** E.164, e.g. +61412345678. Required for suppliers (the accept loop is SMS). */
  phone: text("phone"),
  phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* -------------------------------------------------------------------------- */
/*  Supplier profile                                                           */
/* -------------------------------------------------------------------------- */

export const supplierProfiles = pgTable("supplier_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  abn: text("abn"),
  truckCapacityM3: numeric("truck_capacity_m3", { precision: 4, scale: 1 }),
  insuranceDocUrl: text("insurance_doc_url"),
  /**
   * The gate. Until this is set, the supplier cannot see a single pin — and
   * therefore not a single home address. Approved by hand while volume is low.
   */
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*  Listings — a receiver's "I want mulch" pin                                 */
/* -------------------------------------------------------------------------- */

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    addressLine: text("address_line").notNull(),
    suburb: text("suburb").notNull(),
    postcode: text("postcode").notNull(),
    state: text("state").notNull(),

    /** Exact position. Must never be serialised to a client before a match. */
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    /** ~300m fuzz. This is the only pair the map API is allowed to return. */
    approxLat: doublePrecision("approx_lat").notNull(),
    approxLng: doublePrecision("approx_lng").notNull(),

    // Default exists only so the column can be added NOT NULL; every write
    // path sets it explicitly from the tier the receiver picked.
    wanted: materialWanted("wanted").notNull().default("wood_chips"),
    tier: volumeTier("tier").notNull().default("medium"),
    /**
     * Denormalised ceiling from the tier, so the map's "takes a full truck"
     * filter is a plain indexed comparison. Null means unlimited.
     */
    maxVolumeM3: numeric("max_volume_m3", { precision: 5, scale: 1 }),

    excludes: text("excludes").array().notNull().default([]),
    dropSpot: dropSpot("drop_spot").notNull(),
    accessNotes: text("access_notes"),
    /**
     * Storage key for the photo of where the truck tips. The most useful field
     * in the app — overhead clearance and driveway width are what turn a
     * driver around on arrival, and a photo says both at a glance.
     */
    photoKey: text("photo_key"),

    /**
     * "Just dump it, don't ask me first." Turns the pin into a one-tap claim
     * and is what makes the marketplace work at truck-is-full-right-now speed.
     */
    preAuthorised: boolean("pre_authorised").notNull().default(false),

    status: listingStatus("status").notNull().default("active"),
    /** Staleness clock — auto-paused by cron if not re-confirmed in 30 days. */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("listings_map_idx").on(t.status, t.approxLat, t.approxLng),
    index("listings_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Drops — a supplier offering or claiming a load against a listing           */
/* -------------------------------------------------------------------------- */

export const drops = pgTable(
  "drops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    volumeM3: numeric("volume_m3", { precision: 5, scale: 1 }),
    species: text("species"),
    etaWindow: text("eta_window").$type<EtaWindow>(),

    /**
     * Photo the driver takes of the tipped load. Serves three jobs: proof the
     * drop happened, evidence if the receiver disputes what arrived, and the
     * trigger for taking payment — which only fires on confirmed delivery.
     */
    proofPhotoKey: text("proof_photo_key"),

    status: dropStatus("status").notNull().default("offered"),
    /** Lets a receiver accept from an SMS without ever logging in. Single use. */
    acceptToken: text("accept_token").unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("drops_listing_idx").on(t.listingId, t.status),
    index("drops_supplier_idx").on(t.supplierId, t.status),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Ratings                                                                    */
/* -------------------------------------------------------------------------- */

export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  dropId: uuid("drop_id")
    .notNull()
    .references(() => drops.id, { onDelete: "cascade" }),
  raterId: text("rater_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  positive: boolean("positive").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Listing = typeof listings.$inferSelect;
export type Drop = typeof drops.$inferSelect;
export type SupplierProfile = typeof supplierProfiles.$inferSelect;
