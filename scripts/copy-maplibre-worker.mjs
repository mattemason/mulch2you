/**
 * Copies MapLibre's web worker into public/ so it can be served at a real URL.
 *
 * MapLibre locates its worker with `new URL('./maplibre-gl-worker.mjs',
 * import.meta.url)`. Once the library is bundled, import.meta.url points at a
 * Next.js chunk, and no such file sits beside it — the request 404s, Next
 * answers with its HTML error page, and the browser reports "non-JavaScript
 * MIME type of text/html". No worker means no vector tile decoding, which
 * shows up as a map that draws its controls and markers over a blank canvas.
 *
 * Copying rather than committing keeps these byte-identical to the installed
 * version; a stale vendored worker against a newer library is a worse bug than
 * the one being fixed. Runs automatically before dev and build.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// Both files are needed: the worker imports "./maplibre-gl-shared.mjs", so
// they have to end up in the same directory as each other.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const DEST = join(process.cwd(), "public", "maplibre");

const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
await mkdir(DEST, { recursive: true });

for (const file of FILES) {
  await copyFile(join(dist, file), join(DEST, file));
  console.log(`  public/maplibre/${file}`);
}
