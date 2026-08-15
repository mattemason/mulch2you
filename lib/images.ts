import sharp, { type Sharp } from "sharp";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // generous: modern phone photos
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** What we store: long edge in pixels, and the encoder quality. */
const TARGET_LONG_EDGE = 1400;
const QUALITY = 78;

export type ProcessedImage = { data: Buffer; contentType: "image/webp"; bytes: number };

/**
 * Re-encodes an uploaded photo to a bounded WebP.
 *
 * The important part is not the resizing — it's that re-encoding drops every
 * EXIF tag. Phone cameras stamp GPS coordinates into photos by default, so a
 * drop-spot photo taken at home carries the exact location of a house whose
 * pin we deliberately fuzz to ~300 m. Publishing that file as-is would hand
 * suppliers the precise address of every listing before any match.
 *
 * `.rotate()` with no argument reads the EXIF orientation and bakes it into
 * the pixels first, so stripping the tag doesn't leave the image sideways.
 */
export async function processUploadedImage(input: ArrayBuffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageError("That photo is too large — please use one under 15 MB.");
  }

  let pipeline: Sharp;
  try {
    pipeline = sharp(Buffer.from(input), { failOn: "error" });
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) throw new Error("no dimensions");
  } catch {
    throw new ImageError("That file doesn't look like a photo we can read.");
  }

  const data = await pipeline
    .rotate()
    .resize({
      width: TARGET_LONG_EDGE,
      height: TARGET_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    // Default is to discard metadata; being explicit because it's load-bearing.
    .webp({ quality: QUALITY })
    .toBuffer();

  return { data, contentType: "image/webp", bytes: data.byteLength };
}

/** Confirms a stored image really has no location metadata left. Used by tests. */
export async function readExifSummary(data: Buffer) {
  const meta = await sharp(data).metadata();
  return {
    hasExif: Boolean(meta.exif),
    hasXmp: Boolean(meta.xmp),
    hasIcc: Boolean(meta.icc),
    width: meta.width,
    height: meta.height,
    format: meta.format,
  };
}

export class ImageError extends Error {}
