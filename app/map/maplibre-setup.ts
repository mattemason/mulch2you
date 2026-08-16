import { setWorkerUrl } from "maplibre-gl";

/**
 * Points MapLibre at the worker we serve ourselves.
 *
 * Left alone it resolves the worker relative to the bundled chunk, where no
 * such file exists — the request 404s to Next's HTML error page and the worker
 * never starts, which shows up as a map that draws controls and markers over a
 * blank canvas. scripts/copy-maplibre-worker.mjs puts the file in public.
 *
 * Imported for its side effect by every component that builds a map, so a new
 * one can't quietly ship without it.
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
