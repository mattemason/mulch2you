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
export async function suggestAddresses(
  query: string,
  sessionToken?: string,
): Promise<AddressPrediction[]> {
  const q = query.trim();
  if (q.length < 4) return [];

  return env.GOOGLE_MAPS_KEY
    ? googleAutocomplete(q, env.GOOGLE_MAPS_KEY, sessionToken)
    : photonSuggest(q);
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
      // Addresses only — no cafés, no parks. A truck is going to a property.
      includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"],
      ...(sessionToken ? { sessionToken } : {}),
    }),
    cache: "no-store",
  });

  const data = (await res.json()) as GoogleAutocompleteResponse;
  if (!res.ok) {
    throw new Error(
      `Google Places autocomplete ${res.status}: ${data.error?.message ?? "unknown error"}`,
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
    throw new Error(`Google place details ${res.status}: ${data.error?.message ?? "unknown"}`);
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
