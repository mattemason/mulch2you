const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

export const DEFAULT_FUZZ_METRES = 300;

export type Coords = { lat: number; lng: number };

/**
 * Offset a home address by a random bearing and distance so the map can show
 * roughly-where without showing exactly-where. Call once at listing creation
 * and persist the result — re-fuzzing on every request would let anyone
 * triangulate the true position by averaging a handful of reads.
 */
export function fuzzCoords({ lat, lng }: Coords, metres = DEFAULT_FUZZ_METRES): Coords {
  const bearing = Math.random() * 2 * Math.PI;
  // sqrt keeps the distribution uniform over the disc rather than clustered
  // at the centre, so the true point isn't the most likely guess.
  const distanceKm = (Math.sqrt(Math.random()) * metres) / 1000;

  const deltaLat = (distanceKm * Math.cos(bearing)) / KM_PER_DEGREE_LAT;
  const deltaLng =
    (distanceKm * Math.sin(bearing)) / (KM_PER_DEGREE_LAT * Math.cos(toRad(lat)));

  return {
    lat: round6(lat + deltaLat),
    lng: round6(lng + deltaLng),
  };
}

/** Great-circle distance in km. */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Cheap rectangular prefilter so the index does the work and Haversine only
 * runs over candidates. Latitude is clamped because Australia is nowhere near
 * a pole, but the maths shouldn't blow up if someone tests with one.
 */
export function boundingBox({ lat, lng }: Coords, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.01, Math.cos(toRad(lat))));

  return {
    minLat: clamp(lat - latDelta, -90, 90),
    maxLat: clamp(lat + latDelta, -90, 90),
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** "1.2 km" / "850 m" — what a driver actually wants to read. */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
