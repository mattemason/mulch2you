// Reads configuration and calls paid APIs — never let this reach the browser.
// The import makes a client component that pulls anything from here a build
// error rather than a blank page at runtime.
import "server-only";
import { env } from "@/lib/env";
import type { AddressPrediction, ResolvedAddress } from "@/lib/address";

export type { AddressPrediction, ResolvedAddress } from "@/lib/address";
export { parseStreetNumber } from "@/lib/address";

/** Australia's bounding box, west/south/east/north — used to bias Photon. */
const AU_BBOX = "112,-44,154,-9";

/** Carries the provider's own words so /admin can show what actually failed. */
export class GeocodeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerMessage: string,
  ) {
    super(message);
    this.name = "GeocodeError";
  }
}

export function geocoderName(): "Google" | "Photon" {
  return env.GOOGLE_MAPS_KEY ? "Google" : "Photon";
}

/**
 * Suggests addresses as the user types.
 *
 * Google Places when a key is configured: better Australian data, and crucially
 * it's designed for partial input, where the Geocoding API expects something
 * close to a complete address. Photon otherwise — free, no key, and fuzzy
 * enough that "95 eunumndi noosa road" still finds Eumundi Noosa Road.
 *
 * `sessionToken` matters for cost: Google bills an autocomplete session — every
 * keystroke plus the closing details call — as one unit, rather than billing
 * each keystroke separately. The caller must reuse one token for a whole typing
 * session and start a fresh one afterwards.
 */
export type SuggestResult = {
  predictions: AddressPrediction[];
  /** Which provider actually answered — may not be the configured one. */
  provider: "Google" | "Photon";
  /** Set when the configured provider failed and we served the fallback. */
  degraded?: string;
};

export async function suggestAddresses(
  query: string,
  sessionToken?: string,
): Promise<SuggestResult> {
  const q = query.trim();
  if (q.length < 4) return { predictions: [], provider: geocoderName() };

  if (!env.GOOGLE_MAPS_KEY) {
    return { predictions: await photonSuggest(q), provider: "Photon" };
  }

  try {
    return {
      predictions: await googleAutocomplete(q, env.GOOGLE_MAPS_KEY, sessionToken),
      provider: "Google",
    };
  } catch (err) {
    // A misconfigured key shouldn't stop someone listing a pin. Photon needs
    // no signup and is good enough to keep the funnel open, so fall back
    // rather than fail — and record why, so /admin can show the real cause
    // instead of everyone seeing "temporarily unavailable".
    const reason = err instanceof GeocodeError ? `${err.message} (${err.providerMessage})` : String(err);
    console.error("Google autocomplete failed, falling back to Photon:", reason);
    return { predictions: await photonSuggest(q), provider: "Photon", degraded: reason };
  }
}

/**
 * Calls the configured provider with no fallback, so a failure surfaces
 * instead of being papered over. Only /admin diagnostics uses this.
 */
export async function probeGeocoder(query: string): Promise<AddressPrediction[]> {
  if (!env.GOOGLE_MAPS_KEY) return photonSuggest(query);
  return googleAutocomplete(query, env.GOOGLE_MAPS_KEY, crypto.randomUUID());
}

/**
 * Turns a prediction id into a full address. Only needed for providers that
 * don't resolve up front; passing the session token here is what closes the
 * billing session Google opened during typing.
 */
export async function resolveAddress(
  id: string,
  sessionToken?: string,
): Promise<ResolvedAddress | null> {
  if (!env.GOOGLE_MAPS_KEY) return null;
  return googlePlaceDetails(id, env.GOOGLE_MAPS_KEY, sessionToken);
}

/* -------------------------------------------------------------------------- */
/*  Google Places (New)                                                        */
/* -------------------------------------------------------------------------- */

type GoogleAutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId: string;
      text?: { text: string };
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  }[];
  error?: { message?: string; status?: string };
};

async function googleAutocomplete(
  input: string,
  key: string,
  sessionToken?: string,
): Promise<AddressPrediction[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ["au"],
      // Deliberately no includedPrimaryTypes. Places (New) only accepts values
      // from its own type tables, and address-shaped ones like "street_address"
      // or "route" aren't among them — sending those returns INVALID_REQUEST
      // and every lookup fails. Non-address predictions are filtered later
      // instead: resolving one requires a route, locality and postcode.
      ...(sessionToken ? { sessionToken } : {}),
    }),
    cache: "no-store",
  });

  const data = (await res.json()) as GoogleAutocompleteResponse;
  if (!res.ok) {
    throw new GeocodeError(
      explainGoogleFailure(res.status),
      res.status,
      data.error?.message ?? "no message returned",
    );
  }

  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
    .map((p) => ({
      id: p.placeId,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: (p.structuredFormat?.secondaryText?.text ?? "").replace(/, Australia$/, ""),
    }))
    .slice(0, 5);
}

/** Turns an HTTP status into the thing that's actually misconfigured. */
function explainGoogleFailure(status: number): string {
  if (status === 400) return "Google rejected the request as malformed.";
  if (status === 401 || status === 403) {
    return "Google refused the key. Usually: Places API (New) not enabled, no billing account attached, or an application restriction (referrer/IP) blocking server-side calls.";
  }
  if (status === 429) return "Google rate-limited the key.";
  return `Google returned HTTP ${status}.`;
}

type GooglePlaceDetails = {
  location?: { latitude: number; longitude: number };
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  error?: { message?: string };
};

async function googlePlaceDetails(
  placeId: string,
  key: string,
  sessionToken?: string,
): Promise<ResolvedAddress | null> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  if (sessionToken) url.searchParams.set("sessionToken", sessionToken);

  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "addressComponents,location",
    },
    cache: "no-store",
  });

  const data = (await res.json()) as GooglePlaceDetails;
  if (!res.ok) {
    throw new GeocodeError(
      explainGoogleFailure(res.status),
      res.status,
      data.error?.message ?? "no message returned",
    );
  }

  const components = data.addressComponents ?? [];
  const pick = (type: string, short = false) => {
    const c = components.find((c) => c.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : "";
  };

  const street = pick("route");
  const suburb = pick("locality") || pick("sublocality") || pick("administrative_area_level_2");
  const postcode = pick("postal_code");
  if (!street || !suburb || !postcode || !data.location) return null;

  // A unit number is part of the address a driver needs, so keep it attached
  // to the street number rather than dropping it: "5/95".
  const subpremise = pick("subpremise");
  const streetNumber = pick("street_number");
  const number = [subpremise, streetNumber].filter(Boolean).join("/") || null;

  return {
    streetNumber: number,
    street,
    suburb,
    state: pick("administrative_area_level_1", true),
    postcode,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}

/* -------------------------------------------------------------------------- */
/*  Photon (keyless fallback)                                                  */
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
    type?: string;
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

async function photonSuggest(query: string): Promise<AddressPrediction[]> {
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
    // bbox biases but doesn't strictly filter, so drop anything outside AU.
    .filter((f) => f.properties.countrycode === "AU")
    .map(fromPhoton)
    .filter((p): p is AddressPrediction => p !== null)
    .filter((p) => {
      // Photon returns the same road several times from different OSM ways.
      const dedupe = p.id.toLowerCase();
      if (seen.has(dedupe)) return false;
      seen.add(dedupe);
      return true;
    })
    .slice(0, 5);
}

function fromPhoton(f: PhotonFeature): AddressPrediction | null {
  const p = f.properties;
  const street = p.street ?? p.name;
  const suburb = p.city ?? p.locality ?? p.district ?? p.county;

  // No street or no suburb means a region centroid — a truck can't be sent to
  // it, so it's noise in a list of delivery addresses.
  if (!street || !suburb || !p.postcode) return null;

  const state = AU_STATE_ABBREV[p.state ?? ""] ?? p.state ?? "";
  const resolved: ResolvedAddress = {
    streetNumber: p.housenumber ?? null,
    street,
    suburb,
    state,
    postcode: p.postcode,
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  };

  return {
    id: `${p.housenumber ?? ""}|${street}|${suburb}|${p.postcode}`,
    primary: [p.housenumber, street].filter(Boolean).join(" "),
    secondary: `${suburb} ${state} ${p.postcode}`,
    resolved,
  };
}

/* -------------------------------------------------------------------------- */
/*  Place search — suburbs, towns, postcodes                                   */
/* -------------------------------------------------------------------------- */

export type PlaceSuggestion = { id: string; label: string; lat: number; lng: number };

/**
 * Finds a suburb or town to search around.
 *
 * Separate from address autocomplete because the shape of a good answer is
 * different: a delivery address needs a street number and is rejected without
 * one, whereas "Noosaville" is a perfectly good centre for a radius search.
 * Coordinates come back directly, so there's no second lookup to pay for.
 */
export async function suggestPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  if (env.GOOGLE_MAPS_KEY) {
    try {
      return await googlePlaces(q, env.GOOGLE_MAPS_KEY);
    } catch (err) {
      console.error("Google place search failed, falling back to Photon:", err);
    }
  }
  return photonPlaces(q);
}

async function googlePlaces(query: string, key: string): Promise<PlaceSuggestion[]> {
  // The Geocoding API rather than Places: a suburb name is a complete query,
  // and this answers with coordinates in one call instead of two.
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("components", "country:AU");
  url.searchParams.set("key", key);

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: {
      place_id: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }[];
  };

  if (data.status === "ZERO_RESULTS") return [];
  if (!res.ok || data.status !== "OK") {
    throw new GeocodeError(
      explainGoogleFailure(res.status),
      res.status,
      data.error_message ?? data.status,
    );
  }

  return (data.results ?? []).slice(0, 6).map((r) => ({
    id: r.place_id,
    label: r.formatted_address.replace(/, Australia$/, ""),
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

async function photonPlaces(query: string): Promise<PlaceSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  url.searchParams.set("bbox", AU_BBOX);
  url.searchParams.set("lang", "en");
  // Suburbs and towns only — a street or a shop is not somewhere to centre on.
  for (const layer of ["city", "district", "locality", "county"]) {
    url.searchParams.append("layer", layer);
  }

  const res = await fetch(url, {
    headers: { "User-Agent": "Mulch2You/0.1 (+https://github.com/mattemason/mulch2you)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Photon failed: ${res.status}`);

  const data = (await res.json()) as { features?: PhotonFeature[] };
  const seen = new Set<string>();

  return (data.features ?? [])
    .filter((f) => f.properties.countrycode === "AU")
    .map((f) => {
      const p = f.properties;
      const name = p.name ?? p.city ?? p.locality;
      if (!name) return null;
      const state = AU_STATE_ABBREV[p.state ?? ""] ?? p.state ?? "";
      const label = [name, state, p.postcode].filter(Boolean).join(" ");
      return {
        id: label.toLowerCase(),
        label,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      };
    })
    .filter((p): p is PlaceSuggestion => p !== null)
    .filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .slice(0, 6);
}
