/**
 * Address shapes and pure helpers — safe to import from client components.
 *
 * Deliberately separate from lib/geocode.ts, which reads configuration and
 * calls out to providers. Pulling a single helper across that line drags the
 * whole env module into the browser bundle, where process.env is empty and
 * validation throws on import, taking the page down with it.
 */

/** A fully resolved address: what a listing needs to exist. */
export type ResolvedAddress = {
  streetNumber: string | null;
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
};

/**
 * One row in the suggestion list.
 *
 * `resolved` is present when the provider gave us everything up front (Photon
 * does) and absent when a second lookup is needed (Google Places returns only
 * a place id until you ask for details). Callers treat it as a cache: resolve
 * only when it's missing.
 */
export type AddressPrediction = {
  id: string;
  primary: string;
  secondary: string;
  resolved?: ResolvedAddress;
};

/**
 * Pulls a leading street number out of what the user typed — "95 Smith St",
 * "5/95 Smith St", "12a Smith St". Used to keep their number when the provider
 * didn't supply one, which is common on rural roads.
 */
export function parseStreetNumber(input: string): string | null {
  const m = /^\s*(\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)?)\s+/i.exec(input);
  return m ? m[1].replace(/\s+/g, "") : null;
}
