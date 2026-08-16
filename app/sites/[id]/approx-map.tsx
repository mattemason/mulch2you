"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/map/maplibre-setup";
import { DEFAULT_FUZZ_METRES } from "@/lib/geo";

/**
 * Where the site roughly is, on a real map.
 *
 * The circle isn't decoration — it's the honest statement of what we're
 * showing. The pin sits at a deliberately offset point, and the radius is the
 * area the real address is somewhere inside. Drawing a bare pin would imply a
 * precision we're not offering, and a driver would plan around the wrong house.
 */
export function ApproxMap({
  lat,
  lng,
  maptilerKey,
}: {
  lat: number;
  lng: number;
  maptilerKey: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: maptilerKey
          ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`
          : "https://tiles.openfreemap.org/styles/liberty",
        center: [lng, lat],
        zoom: 13.4,
        attributionControl: { compact: true },
        // A preview, not a tool — panning it invites hunting for the house.
        interactive: false,
      });
    } catch (err) {
      console.error("approx map failed to initialise", err);
      return;
    }

    map.on("load", () => {
      map.addSource("approx", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {} },
      });
      // Radius in metres, so it stays truthful as the map scales.
      map.addLayer({
        id: "approx-fill",
        type: "circle",
        source: "approx",
        paint: {
          "circle-color": "#2E7D22",
          "circle-opacity": 0.15,
          "circle-stroke-color": "#2E7D22",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.5,
          // Interpolated exponentially against zoom so the circle keeps
          // covering the same patch of ground rather than the same patch of
          // screen — a fixed pixel radius would lie at every zoom but one.
          "circle-radius": [
            "interpolate",
            ["exponential", 2],
            ["zoom"],
            10,
            metresToPixels(DEFAULT_FUZZ_METRES, lat, 10),
            20,
            metresToPixels(DEFAULT_FUZZ_METRES, lat, 20),
          ],
        },
      });
      map.addLayer({
        id: "approx-dot",
        type: "circle",
        source: "approx",
        paint: {
          "circle-color": "#E8631A",
          "circle-radius": 7,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2.5,
        },
      });
      map.resize();
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng, maptilerKey]);

  return <div ref={containerRef} className="minimap-canvas" />;
}

/** Web-mercator metres per pixel, so a metre radius can be drawn in pixels. */
function metresToPixels(metres: number, lat: number, zoom: number): number {
  const metresPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return metres / metresPerPixel;
}
