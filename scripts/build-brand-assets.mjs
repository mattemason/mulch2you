/**
 * Derives every brand asset from the one master logo file.
 *
 *   node scripts/build-brand-assets.mjs "path/to/logo.png"
 *
 * The master is a stacked lockup: truck illustration on top, MULCH2YOU
 * wordmark below. Squashing the whole thing into a site header makes the text
 * unreadable, so the wordmark band is cut out separately for headers and the
 * full lockup is kept for the landing page and emails.
 *
 * Band boundaries are measured from the image rather than hardcoded — the logo
 * has already changed once (the tagline came and went), and detection means
 * the next revision needs no code edit.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = process.argv[2] ?? "C:/Users/MatthewMason/Downloads/m2y.png";

/** 0 = frame the cab, 1 = frame the far end of the pile. */
const TRUCK_FOCUS = 0.55;
/** Flat-shaded artwork, so palette quantisation is visually lossless and much smaller. */
const PNG_OPTS = { compressionLevel: 9, palette: true, quality: 90, effort: 10 };

const BRAND_GREEN_DARK = [143, 191, 99]; // lightened #385020, for dark backgrounds
const NEAR_WHITE = [242, 245, 240];

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
  if (bands.length < 2) throw new Error(`Expected a truck band and a wordmark band, found ${bands.length}`);

  // First band is the illustration; everything below it is the wordmark,
  // including a tagline if the logo has one.
  const truckBand = bands[0];
  const wordBand = { top: bands[1].top, bottom: bands[bands.length - 1].bottom };
  const width = right - left + 1;

  console.log(`  truck    rows ${truckBand.top}–${truckBand.bottom}`);
  console.log(`  wordmark rows ${wordBand.top}–${wordBand.bottom}`);
  console.log(`  columns  ${left}–${right}\n`);

  await mkdir("public", { recursive: true });

  // --- Full lockup: landing page and email header -------------------------
  await sharp(SRC)
    .extract({ left, top: truckBand.top, width, height: wordBand.bottom - truckBand.top + 1 })
    .resize({ width: 1200 })
    .png(PNG_OPTS)
    .toFile("public/logo.png");

  // --- Wordmark: site header ----------------------------------------------
  const pad = 8;
  const wordmark = await sharp(SRC)
    .extract({
      left,
      top: Math.max(0, wordBand.top - pad),
      width,
      height: wordBand.bottom - wordBand.top + 1 + pad * 2,
    })
    .resize({ width: 900 })
    .png(PNG_OPTS)
    .toBuffer();
  await sharp(wordmark).toFile("public/wordmark.png");

  // --- Dark-mode wordmark --------------------------------------------------
  // The wordmark is flat colour on white, so it recolours cleanly: white
  // becomes transparent, charcoal becomes near-white, and the green keeps its
  // identity but lightened enough to read on a dark ground. The truck can't
  // get this treatment — its cab is white and would dissolve — which is why
  // the full lockup only ever appears on a light surface.
  const { data, info } = await sharp(wordmark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Ink coverage from the darkest channel, so anti-aliased edges keep their
    // softness instead of turning into a jagged mask.
    const alpha = Math.min(255, Math.round((255 - Math.min(r, g, b)) * 1.2));
    const [nr, ng, nb] = g > r + 15 && g > b + 15 ? BRAND_GREEN_DARK : NEAR_WHITE;
    data[i] = nr;
    data[i + 1] = ng;
    data[i + 2] = nb;
    data[i + 3] = alpha;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png(PNG_OPTS)
    .toFile("public/wordmark-dark.png");

  // --- App icons -----------------------------------------------------------
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

  for (const f of [
    "public/logo.png",
    "public/wordmark.png",
    "public/wordmark-dark.png",
    "app/icon.png",
    "app/apple-icon.png",
  ]) {
    const m = await sharp(f).metadata();
    console.log(`  ${f.padEnd(28)} ${m.width}×${m.height}`);
  }
}

await main();
