"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { NearbyListing } from "@/lib/db/queries";
import { formatDistance, type Coords } from "@/lib/geo";
import {
  DROP_SPOTS,
  EXCLUSION_LABELS,
  MATERIALS_WANTED,
  VOLUME_TIERS,
  type DropSpotKey,
  type Exclusion,
} from "@/lib/listing-options";
import { claimListing } from "@/app/drops/actions";

/** Sydney GPO — only used if the browser won't or can't give up a location. */
const FALLBACK_CENTRE: Coords = { lat: -33.8688, lng: 151.2093 };
const LOCATE_TIMEOUT_MS = 9000;

/** Matches the palette in globals.css; inline so markers never depend on the CSS build. */
const BRAND_GREEN = "#385020";
const BRAND_AMBER = "#8a5a2a";

type Filters = { radiusKm: number; fullTruckOnly: boolean; instantOnly: boolean };

const DEFAULT_FILTERS: Filters = { radiusKm: 25, fullTruckOnly: false, instantOnly: false };

export function SupplierMap({ maptilerKey }: { maptilerKey: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  /** Guards against a slow earlier request landing after a faster later one. */
  const requestSeq = useRef(0);

  // Null centre means "still working out where the truck is".
  const [centre, setCentre] = useState<Coords | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [selected, setSelected] = useState<NearbyListing | null>(null);
  const selectedRef = useRef<NearbyListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  /**
   * The map is the nicer view but the more fragile one — it needs WebGL, a
   * reachable tile CDN, and a container that has settled. A driver standing in
   * a yard needs the addresses either way, so the list is a peer rather than a
   * consolation prize, and a broken map falls back to it automatically.
   */
  const [view, setView] = useState<"map" | "list">("map");
  const showList = view === "list" || mapError !== null;

  // Mirrored into a ref so the marker effect can check it without listing
  // `selected` as a dependency, which would rebuild every marker on each tap.
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const locating = centre === null;
  const effectiveCentre = centre ?? FALLBACK_CENTRE;

  /* --- data ---------------------------------------------------------------- */
  // Called from events rather than an effect: the two things that should
  // trigger a search are "we found the truck" and "the driver changed a
  // filter", and both are already explicit moments.
  const search = useCallback(async (at: Coords, f: Filters) => {
    const seq = ++requestSeq.current;

    const params = new URLSearchParams({
      lat: String(at.lat),
      lng: String(at.lng),
      radiusKm: String(f.radiusKm),
    });
    if (f.fullTruckOnly) params.set("minCapacityM3", "10");
    if (f.instantOnly) params.set("preAuthorisedOnly", "true");

    try {
      const res = await fetch(`/api/listings/nearby?${params}`);
      if (seq !== requestSeq.current) return;

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Couldn't load pins");
        return;
      }
      const data = (await res.json()) as { listings: NearbyListing[] };
      if (seq !== requestSeq.current) return;
      setListings(data.listings);
      setError(null);
    } catch {
      if (seq === requestSeq.current) setError("Couldn't load pins — check your signal");
    }
  }, []);

  const applyCentre = useCallback(
    (next: Coords) => {
      setCentre(next);
      mapRef.current?.easeTo({ center: [next.lng, next.lat], zoom: 11 });
      void search(next, filters);
    },
    [filters, search],
  );

  const applyFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      void search(effectiveCentre, next);
    },
    [effectiveCentre, search],
  );

  /* --- locate the truck ---------------------------------------------------- */
  useEffect(() => {
    // Belt and braces: covers a browser with no geolocation API at all, where
    // neither callback below would ever fire.
    const timer = setTimeout(() => {
      if (requestSeq.current === 0) applyCentre(FALLBACK_CENTRE);
    }, LOCATE_TIMEOUT_MS);

    navigator.geolocation?.getCurrentPosition(
      (pos) => applyCentre({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      // Denied or unavailable — the map still works, the driver just pans to
      // the job themselves.
      () => applyCentre(FALLBACK_CENTRE),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );

    return () => clearTimeout(timer);
    // Runs once on mount; applyCentre's identity changes with filters, which
    // must not re-trigger a location request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- map ----------------------------------------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: buildStyle(maptilerKey),
        center: [FALLBACK_CENTRE.lng, FALLBACK_CENTRE.lat],
        zoom: 11,
        attributionControl: { compact: true },
      });
    } catch (err) {
      // WebGL unavailable, or a style that won't parse. Without this the page
      // renders the controls over a blank white box and says nothing.
      // Deferred so the state change lands after this effect rather than
      // cascading a render from inside it.
      console.error("map failed to initialise", err);
      queueMicrotask(() => setMapError("The map couldn't start on this device."));
      return;
    }

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true }),
      "top-right",
    );

    // Tile or style failures arrive here rather than as thrown errors, so a
    // blocked CDN would otherwise be silent.
    map.on("error", (e) => {
      console.error("map error", e.error ?? e);
      setMapError("Map tiles didn't load. Pins still work — try reloading.");
    });
    map.on("load", () => {
      setMapError(null);
      map.resize();
    });

    // The container is sized by flexbox, which can settle after the map reads
    // its dimensions — a map built at zero height stays at zero height.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [maptilerKey]);

  /* --- markers ------------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = listings.map((l) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${VOLUME_TIERS[l.tier].label} in ${l.suburb}`);

      // Inline styles, not Tailwind classes. This element is built imperatively
      // outside React's render, so utility classes would only work if the CSS
      // build happened to emit them — and an unemitted background leaves white
      // text on a pale map, which is a pin you cannot see.
      Object.assign(el.style, {
        display: "grid",
        placeItems: "center",
        width: "34px",
        height: "34px",
        borderRadius: "999px",
        border: "2px solid #fff",
        background: l.preAuthorised ? BRAND_GREEN : BRAND_AMBER,
        color: "#fff",
        font: "700 15px/1 system-ui, sans-serif",
        boxShadow: "0 2px 8px rgba(0,0,0,.35)",
        cursor: "pointer",
        padding: "0",
      } satisfies Partial<CSSStyleDeclaration>);
      el.textContent = l.preAuthorised ? "⚡" : "?";

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(l);
        map.easeTo({ center: [l.approxLng, l.approxLat], zoom: 13 });
      });

      return new Marker({ element: el }).setLngLat([l.approxLng, l.approxLat]).addTo(map);
    });

    markersRef.current = markers;

    // Frame everything found, so pins are never just off-screen. Skipped once
    // the driver has picked one, or panning would fight them.
    if (listings.length > 0 && !selectedRef.current) {
      const bounds = new LngLatBounds();
      listings.forEach((l) => bounds.extend([l.approxLng, l.approxLat]));
      map.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: 0 });
    }

    return () => markers.forEach((m) => m.remove());
  }, [listings]);

  /* --- render -------------------------------------------------------------- */
  return (
    <div className="relative flex-1 min-h-[60vh]">
      <div ref={containerRef} className="absolute inset-0" />

      {showList && (
        <div className="absolute inset-0 overflow-y-auto bg-background px-3 pb-3 pt-[124px]">
          <ul className="mx-auto max-w-2xl space-y-2">
            {listings.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => setSelected(l)}
                  className="card w-full text-left transition-colors hover:border-brand"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">
                      {l.preAuthorised && "⚡ "}
                      {l.suburb} {l.state}
                    </span>
                    <span className="shrink-0 text-sm text-muted">
                      {formatDistance(l.distanceKm)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {MATERIALS_WANTED[l.wanted].label} · {VOLUME_TIERS[l.tier].label}
                  </div>
                </button>
              </li>
            ))}
            {listings.length === 0 && !locating && (
              <li className="card text-center text-sm text-muted">
                Nothing within {filters.radiusKm} km. Try a wider radius.
              </li>
            )}
          </ul>
        </div>
      )}

      <FilterBar
        filters={filters}
        onChange={applyFilters}
        count={listings.length}
        locating={locating}
        error={error ?? mapError}
        view={view}
        onViewChange={setView}
      />

      {selected && <PinSheet listing={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FilterBar({
  filters,
  onChange,
  count,
  locating,
  error,
  view,
  onViewChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  count: number;
  locating: boolean;
  error: string | null;
  view: "map" | "list";
  onViewChange: (v: "map" | "list") => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3">
      <div className="pointer-events-auto mx-auto max-w-2xl rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Toggle
            active={filters.instantOnly}
            onClick={() => onChange({ ...filters, instantOnly: !filters.instantOnly })}
          >
            ⚡ Drop now
          </Toggle>
          <Toggle
            active={filters.fullTruckOnly}
            onClick={() => onChange({ ...filters, fullTruckOnly: !filters.fullTruckOnly })}
          >
            Full truck
          </Toggle>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-border">
            {(["map", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                aria-pressed={view === v}
                className={`px-3 py-2 text-sm font-medium capitalize ${
                  view === v ? "bg-brand text-brand-fg" : "bg-card"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <select
            value={filters.radiusKm}
            onChange={(e) => onChange({ ...filters, radiusKm: Number(e.target.value) })}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            aria-label="Search radius"
          >
            {[10, 25, 50, 100].map((km) => (
              <option key={km} value={km}>
                Within {km} km
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs text-muted">
          {error
            ? error
            : locating
              ? "Finding your location…"
              : `${count} ${count === 1 ? "pin" : "pins"} nearby · ⚡ means claim it and go`}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-brand-fg" : "border-border bg-card"
      }`}
    >
      {children}
    </button>
  );
}

function PinSheet({ listing, onClose }: { listing: NearbyListing; onClose: () => void }) {
  const tier = VOLUME_TIERS[listing.tier];
  const spot = DROP_SPOTS[listing.dropSpot as DropSpotKey];
  const router = useRouter();
  const [claiming, startClaim] = useTransition();
  const [claimError, setClaimError] = useState<string | null>(null);

  function onClaim() {
    setClaimError(null);
    startClaim(async () => {
      const res = await claimListing(listing.id);
      if (res.error) setClaimError(res.error);
      else if (res.dropId) router.push(`/drops/${res.dropId}`);
    });
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {listing.suburb} {listing.state}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {formatDistance(listing.distanceKm)} away · approximate location
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-2xl leading-none text-muted hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <p>
            <span className="font-medium">Wants:</span>{" "}
            {MATERIALS_WANTED[listing.wanted].label}
          </p>
          <p>
            <span className="font-medium">Will take:</span> {tier.label}
          </p>
          <p>
            <span className="font-medium">Tip it:</span> {spot?.label ?? listing.dropSpot}
          </p>
          {listing.accessNotes && (
            <p className="rounded-lg border border-border bg-background p-3">
              {listing.accessNotes}
            </p>
          )}
          {listing.excludes.length > 0 && (
            <p className="text-accent">
              Won&apos;t accept:{" "}
              {listing.excludes
                .map((e) => EXCLUSION_LABELS[e as Exclusion]?.label.replace(/^No /, "") ?? e)
                .join(", ")}
            </p>
          )}
        </div>

        {listing.photoKey && (
          <figure className="mt-4">
            <figcaption className="mb-1.5 text-xs font-medium text-muted">
              Where they want it tipped
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${listing.photoKey}`}
              alt="The spot the gardener wants the mulch tipped"
              loading="lazy"
              className="w-full rounded-lg border border-border"
            />
          </figure>
        )}

        {listing.preAuthorised ? (
          <>
            <button
              type="button"
              onClick={onClaim}
              disabled={claiming}
              className="btn-primary mt-5 w-full"
            >
              {claiming ? "Claiming…" : "⚡ Claim this drop"}
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              You&apos;ll get the street address straight away.
            </p>
          </>
        ) : (
          <>
            <button type="button" disabled className="btn-primary mt-5 w-full">
              Offer a drop
            </button>
            <p className="mt-2 text-center text-xs text-muted">
              This gardener wants to approve first — that loop lands next.
            </p>
          </>
        )}

        {claimError && (
          <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-accent">
            {claimError}
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * OpenFreeMap by default: free vector tiles, no key, no signup, and — unlike
 * raw OpenStreetMap raster tiles — explicitly fine for production traffic.
 * The OSM tile usage policy forbids exactly this kind of app, so shipping on
 * it was borrowed time.
 *
 * MapTiler still wins if a key is set: same rendering, but a paid CDN with an
 * uptime commitment behind it.
 */
function buildStyle(maptilerKey: string | null): string {
  return maptilerKey
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`
    : "https://tiles.openfreemap.org/styles/liberty";
}
