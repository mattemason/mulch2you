import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { env } from "@/lib/env";

/**
 * Photo storage.
 *
 * Filesystem-backed, which on Railway means a mounted volume — see README.
 * Without a volume the container's disk is ephemeral and every deploy wipes
 * uploaded photos, so the mount is not optional in production.
 *
 * Objects are addressed by an opaque key. Nothing is ever served straight from
 * disk: /api/photos checks who's asking first, because a photo of a driveway
 * plus a suburb identifies a house.
 */

export type StoredObject = { key: string; bytes: number };

const ROOT = env.UPLOAD_DIR;

/** Keys look like `listing/ab/abcdef…webp` — sharded so no directory gets huge. */
export function newKey(prefix: "listing" | "proof"): string {
  const id = randomUUID().replace(/-/g, "");
  return `${prefix}/${id.slice(0, 2)}/${id}.webp`;
}

export async function putObject(key: string, data: Buffer): Promise<StoredObject> {
  const path = resolveKey(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return { key, bytes: data.byteLength };
}

export async function getObject(key: string): Promise<Buffer | null> {
  // Resolve outside the catch on purpose. A malformed key is a bug or an
  // attack and should be loud; a missing file is ordinary and returns null.
  // Collapsing both into null hides the first behind the second.
  const path = resolveKey(key);
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const path = resolveKey(key);
  try {
    await unlink(path);
  } catch {
    // Already gone is the desired end state.
  }
}

/** Stable per-object cache validator, so browsers can revalidate cheaply. */
export function etagFor(data: Buffer): string {
  return `"${createHash("sha1").update(data).digest("hex")}"`;
}

/**
 * Keys come from our own database, but resolving them to paths is exactly
 * where a traversal bug would live, so the shape is enforced rather than
 * assumed and the result is checked to be inside the root.
 */
function resolveKey(key: string): string {
  if (!/^(listing|proof)\/[a-f0-9]{2}\/[a-f0-9]{32}\.webp$/.test(key)) {
    throw new Error(`Refusing to resolve malformed storage key: ${key}`);
  }
  const path = normalize(join(ROOT, key));
  if (!path.startsWith(normalize(ROOT) + sep)) {
    throw new Error("Resolved storage path escaped the upload root");
  }
  return path;
}
