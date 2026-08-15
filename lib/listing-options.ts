import type { Exclusion } from "@/lib/db/schema";

/**
 * The receiver picks a tier, not a number of cubic metres.
 *
 * Two reasons. Suppliers need a filter they can trust before driving 25
 * minutes ("will this pin take my whole truck?"), and pricing has to bill
 * against something verifiable — nobody can prove how much chip actually hit
 * the driveway, so we charge for the band that was requested.
 *
 * maxM3 is what the map filters on. Null means unlimited.
 */
export const VOLUME_TIERS = {
  small: {
    label: "Up to 3 m³",
    blurb: "A trailer or ute load. Enough for a few garden beds.",
    maxM3: 3,
    priceCents: 2000,
  },
  medium: {
    label: "Up to 6 m³",
    blurb: "A small truck load. Covers a decent suburban backyard.",
    maxM3: 6,
    priceCents: 3500,
  },
  large: {
    label: "A full truck",
    blurb: "Up to about 10 m³ tipped in one go. You'll need room for it.",
    maxM3: 10,
    priceCents: 5000,
  },
  unlimited: {
    label: "As much as you can send",
    blurb: "Community gardens, schools, Landcare sites, acreage and farms.",
    maxM3: null,
    priceCents: 5000,
  },
} as const satisfies Record<
  string,
  { label: string; blurb: string; maxM3: number | null; priceCents: number }
>;

export type VolumeTierKey = keyof typeof VOLUME_TIERS;
export const VOLUME_TIER_KEYS = Object.keys(VOLUME_TIERS) as VolumeTierKey[];

/** Ceiling in m³ for the supplier's "will take a full truck" filter. */
export function tierMaxM3(tier: VolumeTierKey): number | null {
  return VOLUME_TIERS[tier].maxM3;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/**
 * What a receiver can refuse. Species matter more than people expect: camphor
 * laurel and privet regrow from chip, palm barely breaks down, and diseased
 * wood spreads what killed the tree it came from.
 */
export const EXCLUSION_LABELS: Record<Exclusion, { label: string; why: string }> = {
  palm: { label: "No palm", why: "Stringy, takes years to break down" },
  pine: { label: "No pine", why: "Acidifies soil" },
  conifer: { label: "No conifer", why: "Slow to compost, resinous" },
  thorny: { label: "No thorny species", why: "Hawthorn, citrus, blackberry" },
  diseased: { label: "No diseased wood", why: "Myrtle rust, phytophthora" },
  camphor_laurel: { label: "No camphor laurel", why: "Regrows and suppresses other plants" },
  privet: { label: "No privet", why: "Weed seed, regrows readily" },
  stump_grindings: { label: "No stump grindings", why: "Soil and grit mixed through" },
};

export const DROP_SPOTS = {
  driveway: {
    label: "Driveway",
    hint: "Most common. Check the truck can raise its tray — watch for wires and branches.",
  },
  nature_strip: {
    label: "Nature strip / verge",
    hint: "Easiest for the driver. Check your council allows it.",
  },
  behind_gate: {
    label: "Through a gate",
    hint: "Measure the opening — a tipper needs about 3 m.",
  },
  paddock: { label: "Paddock or open ground", hint: "Ideal. Note any soft ground after rain." },
  other: { label: "Somewhere else", hint: "Describe it in the access notes below." },
} as const;

export type DropSpotKey = keyof typeof DROP_SPOTS;
export const DROP_SPOT_KEYS = Object.keys(DROP_SPOTS) as DropSpotKey[];

/**
 * A pin nobody has confirmed in this long gets paused. Stale pins are what
 * make drivers stop opening the app — three dead calls and they're gone.
 */
export const STALE_AFTER_DAYS = 30;

export function daysUntilStale(confirmedAt: Date): number {
  const elapsedDays = Math.floor((Date.now() - confirmedAt.getTime()) / 86_400_000);
  return STALE_AFTER_DAYS - elapsedDays;
}
