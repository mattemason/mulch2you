/**
 * Normalise an Australian mobile to E.164. Twilio wants +614…, and people type
 * 0412 345 678, 0412-345-678, or +61 412 345 678 depending on their mood.
 * Returns null if it isn't a plausible AU mobile.
 */
export function normaliseAuMobile(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");

  if (/^\+61[45]\d{8}$/.test(digits)) return digits;
  if (/^61[45]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[45]\d{8}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^[45]\d{8}$/.test(digits)) return `+61${digits}`;

  return null;
}

/** +61412345678 → 0412 345 678, for display back to an Australian. */
export function formatAuMobile(e164: string): string {
  const m = /^\+61([45]\d{2})(\d{3})(\d{3})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : e164;
}
