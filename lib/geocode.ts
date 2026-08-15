import { env } from "@/lib/env";

export type GeocodeResult = {
  /** Full single-line address to show the user for confirmation. */
  formatted: string;
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
};

/**
 * Resolves a typed address to coordinates, Australia only.
 *
 * Google has materially better AU address data — it knows unit numbers and
 * new estates that OSM doesn't — but needs a billed key. Nominatim is free and
 * good enough to build and test against, so the provider is chosen at runtime
 * and adding GOOGLE_MAPS_KEY later is the whole upgrade.
 *
 * Called once per listing, so this is a cheap API either way.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 5) return [];

  return env.GOOGLE_MAPS_KEY ? geocodeGoogle(q, env.GOOGLE_MAPS_KEY) : geocodeNominatim(q);
}

export function isUsingFallbackGeocoder(): boolean {
  return !env.GOOGLE_MAPS_KEY;
}

/* -------------------------------------------------------------------------- */

async function geocodeGoogle(query: string, key: string): Promise<GeocodeResult[]> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:AU");
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Google geocoding failed: ${res.status}`);

  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: GoogleResult[];
  };

  // ZERO_RESULTS is a legitimate empty answer; anything else is misconfiguration
  // (usually billing not enabled) and should surface rather than look like a typo.
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    throw new Error(`Google geocoding: ${data.status} ${data.error_message ?? ""}`.trim());
  }

  return (data.results ?? []).slice(0, 5).map(parseGoogle).filter(isComplete);
}

type GoogleResult = {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; short_name: string; types: string[] }[];
};

function parseGoogle(r: GoogleResult): Partial<GeocodeResult> {
  const pick = (type: string, short = false) => {
    const c = r.address_components.find((c) => c.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : "";
  };

  const streetNumber = pick("street_number");
  const route = pick("route");

  return {
    formatted: r.formatted_address,
    addressLine: [streetNumber, route].filter(Boolean).join(" "),
    suburb: pick("locality") || pick("sublocality") || pick("administrative_area_level_2"),
    state: pick("administrative_area_level_1", true),
    postcode: pick("postal_code"),
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}

/* -------------------------------------------------------------------------- */

/** Nominatim asks for a identifying User-Agent and allows ~1 request/second. */
const NOMINATIM_UA = "Mulch2You/0.1 (https://github.com/mattemason/mulch2you)";

async function geocodeNominatim(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "au");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");

  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_UA, "Accept-Language": "en-AU" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Nominatim geocoding failed: ${res.status}`);

  const data = (await res.json()) as NominatimResult[];
  return data.map(parseNominatim).filter(isComplete);
}

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address: Record<string, string>;
};

function parseNominatim(r: NominatimResult): Partial<GeocodeResult> {
  const a = r.address;
  const houseNumber = a.house_number ?? "";
  const road = a.road ?? "";

  return {
    formatted: r.display_name,
    addressLine: [houseNumber, road].filter(Boolean).join(" "),
    suburb: a.suburb ?? a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? "",
    state: AU_STATES[a.state ?? ""] ?? a.state ?? "",
    postcode: a.postcode ?? "",
    lat: Number(r.lat),
    lng: Number(r.lon),
  };
}

const AU_STATES: Record<string, string> = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  Tasmania: "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

/**
 * A result without a street or postcode is a suburb centroid, not a delivery
 * address — a truck can't be sent there, so drop it rather than let someone
 * list a pin nobody can find.
 */
function isComplete(r: Partial<GeocodeResult>): r is GeocodeResult {
  return Boolean(
    r.addressLine && r.suburb && r.state && r.postcode && Number.isFinite(r.lat) && Number.isFinite(r.lng),
  );
}
