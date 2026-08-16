/**
 * People type "acmetrees.com.au"; a link needs a scheme to be clickable.
 *
 * Lives here rather than beside the actions that use it because a "use server"
 * module may only export async functions.
 */
export function normaliseUrl(input?: string | null): string | null {
  const v = input?.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** "acmetrees.com.au" — a URL without the scheme noise, for display. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
