/**
 * A short, sayable reference for a listing — "m2u-3f9c".
 *
 * Derived from the UUID rather than stored, so there's no counter to keep and
 * no way for two rows to collide. Exists because "the Eumundi one" stops being
 * useful the moment there are two of them, and nobody reads a UUID down the
 * phone.
 */
export function listingRef(id: string): string {
  return `m2u-${id.replace(/-/g, "").slice(0, 4)}`;
}
