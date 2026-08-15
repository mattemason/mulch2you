import { env } from "@/lib/env";

export type AddressSuggestion = {
  /** Stable-ish id for React keys. */
  id: string;
  /** Street number if the provider knew one. Often absent on rural roads. */
  streetNumber: string | null;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
};

/** Australia's bounding box, west/south/east/north. */
const AU_BBOX = "112,-44,154,-9";

/**
 * Suggests addresses as the user types.
 *
 * Photon rather than Nominatim: Nominatim's usage policy explicitly forbids
 * autocomplete on the public instance, and Photon is built for it — it's
 * fuzzy, so "95 eunumndi noosa road" still finds Eumundi Noosa Road, which is
 * the whole reason to have this.
 *
 * The catch is that OSM house numbers are thin in Australia and, worse,
 * sometimes wrong: asking for 1 Hastings Street returns number 18. So the
 * street number a suggestion carries is only ever a default — the caller keeps
 * whatever the user typed and lets them confirm it. That's safe because we
 * fuzz every pin ~300 m anyway, so street-level coordinates are plenty; what
 * has to be exact is the address text the driver reads.
 */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 4) return [];

  return env.GOOGLE_MAPS_KEY ? viaGoogle(q, env.GOOGLE_MAPS_KEY) : viaPhoton(q);
}

export function geocoderName(): "Google" | "Photon" {
  return env.GOOGLE_MAPS_KEY ? "Google" : "Photon";
}

/**
 * Pulls a leading street number out of what the user typed — "95 Smith St",
 * "5/95 Smith St", "12a Smith St". Used to keep their number when the
 * geocoder didn't supply one, or supplied a different one.
 */
export function parseStreetNumber(input: string): string | null {
  const m = /^\s*(\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)?)\s+/i.exec(input);
  return m ? m[1].replace(/\s+/g, "") : null;
}

/* -------------------------------------------------------------------------- */

type PhotonFeature = {
  properties: {
    osm_id?: number;
    countrycode?: string;
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    district?: string;
    locality?: string;
    county?: string;
    state?: string;
    postcode?: string;
  };
  geometry: { coordinates: [number, number] };
};

const AU_STATE_ABBREV: Record<string, string> = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  Tasmania: "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

async function viaPhoton(query: string): Promise<AddressSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("bbox", AU_BBOX);
  url.searchParams.set("lang", "en");

  const res = await fetch(url, {
    headers: { "User-Agent": "Mulch2You/0.1 (+https://github.com/mattemason/mulch2you)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon failed: ${res.status}`);

  const data = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  return (data.features ?? [])
    // bbox biases but doesn't strictly filter, so drop anything not in AU.
    .filter((f) => f.properties.countrycode === "AU")
    .map(fromPhoton)
    .filter((s): s is AddressSuggestion => s !== null)
    .filter((s) => {
      // Photon happily returns the same road three times from different OSM ways.
      const dedupe = `${s.streetNumber ?? ""}|${s.street}|${s.suburb}|${s.postcode}`.toLowerCase();
      if (seen.has(dedupe)) return false;
      seen.add(dedupe);
      return true;
    })
    .slice(0, 5);
}

function fromPhoton(f: PhotonFeature): AddressSuggestion | null {
  const p = f.properties;
  const street = p.street ?? p.name;
  const suburb = p.city ?? p.locality ?? p.district ?? p.county;

  // A result with no street or no suburb is a region centroid — a truck can't
  // be sent to it, so it's noise in a list of delivery addresses.
  if (!street || !suburb || !p.postcode) return null;

  return {
    id: String(p.osm_id ?? `${street}-${suburb}-${p.postcode}`),
    streetNumber: p.housenumber ?? null,
    street,
    suburb,
    state: AU_STATE_ABBREV[p.state ?? ""] ?? p.state ?? "",
    postcode: p.postcode,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };
}

/* -------------------------------------------------------------------------- */

type GoogleResult = {
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; short_name: string; types: string[] }[];
};

async function viaGoogle(query: string, key: string): Promise<AddressSuggestion[]> {
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

  // ZERO_RESULTS is a legitimate empty answer. Anything else is usually
  // billing not being enabled, and should surface rather than look like a typo.
  if (data.status === "ZERO_RESULTS") return [];
  if (data.status !== "OK") {
    throw new Error(`Google geocoding: ${data.status} ${data.error_message ?? ""}`.trim());
  }

  return (data.results ?? [])
    .map(fromGoogle)
    .filter((s): s is AddressSuggestion => s !== null)
    .slice(0, 5);
}

function fromGoogle(r: GoogleResult): AddressSuggestion | null {
  const pick = (type: string, short = false) => {
    const c = r.address_components.find((c) => c.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : "";
  };

  const street = pick("route");
  const suburb = pick("locality") || pick("sublocality");
  const postcode = pick("postal_code");
  if (!street || !suburb || !postcode) return null;

  return {
    id: r.place_id,
    streetNumber: pick("street_number") || null,
    street,
    suburb,
    state: pick("administrative_area_level_1", true),
    postcode,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  };
}
