
/**
 * The receiver picks a tier, not a number of cubic metres.
 *
 * Suppliers need a filter they can trust before driving 25 minutes ("will this
 * pin take my whole truck?"), and a band is something both sides can agree on
 * — nobody can prove how much chip actually hit the driveway.
 *
 * maxM3 is what the map filters on. Null means unlimited.
 *
 * priceCents is kept but not charged or displayed: the service launched free
 * on both sides, and these are the figures decided for whenever that changes.
 * Nothing reads them today, so removing the free launch means putting the
 * display back rather than re-deciding the numbers.
 */
export const VOLUME_TIERS = {
  small: {
    name: "Small load",
    label: "Up to 3 m³",
    blurb: "A trailer or ute load. Enough for a few garden beds.",
    maxM3: 3,
    priceCents: 2000,
  },
  medium: {
    name: "Backyard load",
    label: "Up to 6 m³",
    blurb: "A small truck load. Covers a decent suburban backyard.",
    maxM3: 6,
    priceCents: 3500,
  },
  large: {
    name: "Full truck",
    label: "A full truck",
    blurb: "Up to about 10 m³ tipped in one go. You'll need room for it.",
    maxM3: 10,
    priceCents: 5000,
  },
  unlimited: {
    name: "Send everything",
    label: "As much as you can send",
    blurb: "Community gardens, schools, Landcare sites, acreage and farms.",
    maxM3: null,
    priceCents: 5000,
  },
} as const satisfies Record<
  string,
  { name: string; label: string; blurb: string; maxM3: number | null; priceCents: number }
>;

/**
 * What the receiver wants. Ordered narrow → broad, and the copy nudges toward
 * the broad end: a pin that accepts anything gets offered loads the fussy ones
 * never see, because "any green waste" is precisely what a crew is stuck with.
 */
export const MATERIALS_WANTED = {
  wood_chips: {
    label: "Wood chips",
    blurb:
      "Straight arborist chip — branches and limbs through the chipper. It's not screened, so expect leaf and bark mixed through it.",
  },
  mulch_and_chips: {
    label: "Garden mulch + wood chips",
    blurb:
      "Chip plus finer material, leaf and bark included. Better on garden beds, but a narrower pool of drivers so it takes longer to arrive.",
  },
  any_green_waste: {
    label: "Any green waste",
    blurb: "Chip, prunings, leaf litter, the lot. Most drivers, shortest wait.",
  },
} as const satisfies Record<string, { label: string; blurb: string }>;

export type MaterialWantedKey = keyof typeof MATERIALS_WANTED;
export const MATERIAL_WANTED_KEYS = Object.keys(MATERIALS_WANTED) as MaterialWantedKey[];

export type VolumeTierKey = keyof typeof VOLUME_TIERS;
export const VOLUME_TIER_KEYS = Object.keys(VOLUME_TIERS) as VolumeTierKey[];

/** Ceiling in m³ for the supplier's "will take a full truck" filter. */
export function tierMaxM3(tier: VolumeTierKey): number | null {
  return VOLUME_TIERS[tier].maxM3;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

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

/**
 * `phrase` completes the sentence "tips …", because a label can't. Gluing
 * "on the" to a label produces "tips on the through a gate", so each option
 * carries the wording that actually reads.
 */
export const DROP_SPOTS = {
  driveway: {
    label: "Driveway",
    phrase: "on the driveway",
    hint: "Most common. Check the truck can raise its tray — watch for wires and branches.",
  },
  nature_strip: {
    label: "Nature strip / verge",
    phrase: "on the nature strip",
    hint: "Easiest for the driver. Check your council allows it.",
  },
  behind_gate: {
    label: "Through a gate",
    phrase: "through a gate",
    hint: "Measure the opening — a tipper needs about 3 m.",
  },
  paddock: {
    label: "Paddock or open ground",
    phrase: "in the paddock",
    hint: "Ideal. Note any soft ground after rain.",
  },
  other: {
    label: "Somewhere else",
    phrase: "somewhere on the property",
    hint: "Describe it in the access notes below.",
  },
} as const;

export type DropSpotKey = keyof typeof DROP_SPOTS;

/** "tips on the driveway" / "tips through a gate" — never "tips on the through a gate". */
export function tipsPhrase(dropSpot: string): string {
  const spot = DROP_SPOTS[dropSpot as DropSpotKey];
  return spot ? `tips ${spot.phrase}` : `tips ${dropSpot.toLowerCase()}`;
}

export const DROP_SPOT_KEYS = Object.keys(DROP_SPOTS) as DropSpotKey[];

/**
 * When a driver says they'd arrive, and how long the gardener gets to answer.
 *
 * The window scales with the promise: someone with a full truck right now
 * can't sit on an unanswered request all day, while "sometime this week" can
 * wait. An expired offer frees the pin rather than leaving it in limbo.
 */
export const ETA_WINDOWS = {
  within_2h: { label: "Within 2 hours", expiryHours: 2 },
  today: { label: "Later today", expiryHours: 6 },
  tomorrow: { label: "Tomorrow", expiryHours: 24 },
  this_week: { label: "Sometime this week", expiryHours: 72 },
} as const;

export type EtaWindowKey = keyof typeof ETA_WINDOWS;
export const ETA_WINDOW_KEYS = Object.keys(ETA_WINDOWS) as EtaWindowKey[];

/**
 * How long a claim holds a site. Six hours is a working day's worth of
 * flexibility without letting one crew sit on a pin nobody else can take.
 *
 * Lives here rather than beside the action that uses it: a "use server" module
 * may only export async functions.
 */
export const CLAIM_WINDOW_HOURS = 6;

/**
 * A pin nobody has confirmed in this long gets paused. Stale pins are what
 * make drivers stop opening the app — three dead calls and they're gone.
 */
export const STALE_AFTER_DAYS = 30;

/** True once an offer's window has closed. Kept out of component bodies. */
export function hasExpired(at: Date): boolean {
  return at.getTime() < Date.now();
}

export function daysUntilStale(confirmedAt: Date): number {
  const elapsedDays = Math.floor((Date.now() - confirmedAt.getTime()) / 86_400_000);
  return STALE_AFTER_DAYS - elapsedDays;
}
