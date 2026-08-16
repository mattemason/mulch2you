/**
 * Cuts the app icons out of the master logo file.
 *
 *   node scripts/build-brand-assets.mjs "path/to/logo.png"
 *
 * The master is a stacked lockup: truck illustration on top, wordmark below.
 * Only the truck is used here — the wordmark is set in live type (app/logo.tsx)
 * rather than served as artwork, so it needs no export and can't fall out of
 * date with the site's name the way a baked-in image does.
 *
 * Band boundaries are measured from the image rather than hardcoded, so a
 * revised logo needs no code edit.
 */
import sharp from "sharp";

const SRC = process.argv[2] ?? "C:/Users/MatthewMason/Downloads/m2u.png";

/** 0 = frame the cab, 1 = frame the far end of the pile. */
const TRUCK_FOCUS = 0.55;
/** Flat-shaded artwork, so palette quantisation is visually lossless and much smaller. */
const PNG_OPTS = { compressionLevel: 9, palette: true, quality: 90, effort: 10 };

/** Rows/columns containing ink, used to find where the artwork actually sits. */
async function inkProfile(src) {
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const rows = new Array(info.height).fill(0);
  const cols = new Array(info.width).fill(0);

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) {
        rows[y]++;
        cols[x]++;
      }
    }
  }

  // Contiguous runs of inked rows, ignoring specks.
  const bands = [];
  let start = null;
  for (let y = 0; y <= info.height; y++) {
    const ink = y < info.height && rows[y] > 3;
    if (ink && start === null) start = y;
    if (!ink && start !== null) {
      if (y - start > 8) bands.push({ top: start, bottom: y - 1 });
      start = null;
    }
  }

  const left = cols.findIndex((c) => c > 3);
  const right = cols.length - 1 - [...cols].reverse().findIndex((c) => c > 3);
  return { bands, left, right };
}

async function main() {
  const { bands, left, right } = await inkProfile(SRC);
  if (!bands.length) throw new Error("Found no artwork in the source image");

  // First band is the illustration; anything below it is the wordmark, which
  // we don't export.
  const truckBand = bands[0];
  const width = right - left + 1;
  console.log(`  truck rows ${truckBand.top}–${truckBand.bottom}, columns ${left}–${right}\n`);

  // Next.js picks these up by filename: app/icon.png is the favicon,
  // app/apple-icon.png the home-screen icon.
  //
  // Extract and trim in separate passes — chaining them makes sharp compute
  // the trim against the pre-extract geometry and reject the area.
  const truckBuf = await sharp(SRC)
    .extract({ left, top: truckBand.top, width, height: truckBand.bottom - truckBand.top + 1 })
    .png()
    .toBuffer();
  const truck = await sharp(truckBuf)
    .trim({ background: "#ffffff", threshold: 12 })
    .png()
    .toBuffer({ resolveWithObject: true });

  // The truck is roughly 2.5:1, so padding it to a square leaves it tiny — at
  // 32px it reads as a grey smudge. Crop a square window instead, biased right
  // of centre to frame the raised tray tipping onto the pile, which is the
  // part still recognisable at favicon size.
  const side = Math.min(truck.info.height, truck.info.width);
  const focusX = Math.round((truck.info.width - side) * TRUCK_FOCUS);
  const squared = await sharp(truck.data)
    .extract({ left: focusX, top: 0, width: side, height: side })
    .png()
    .toBuffer();

  await sharp(squared).resize(512, 512).png(PNG_OPTS).toFile("app/icon.png");
  await sharp(squared)
    // Apple crops to a rounded rect and doesn't pad, so add the margin here.
    .resize(160, 160, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png(PNG_OPTS)
    .toFile("app/apple-icon.png");

  for (const f of ["app/icon.png", "app/apple-icon.png"]) {
    const m = await sharp(f).metadata();
    console.log(`  ${f.padEnd(22)} ${m.width}×${m.height}`);
  }
}

await main();
