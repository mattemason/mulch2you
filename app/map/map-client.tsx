"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  GeolocateControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type StyleSpecification,
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
} from "@/lib/listing-options";
import type { Exclusion } from "@/lib/db/schema";
import { claimListing } from "@/app/drops/actions";

/** Sydney GPO — only used if the browser won't or can't give up a location. */
const FALLBACK_CENTRE: Coords = { lat: -33.8688, lng: 151.2093 };
const LOCATE_TIMEOUT_MS = 9000;

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
  const [error, setError] = useState<string | null>(null);

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
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildStyle(maptilerKey),
      center: [FALLBACK_CENTRE.lng, FALLBACK_CENTRE.lat],
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true }),
      "top-right",
    );
    mapRef.current = map;

    return () => {
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
      el.className = [
        "grid size-8 place-items-center rounded-full border-2 border-white text-sm",
        "font-bold text-white shadow-lg cursor-pointer",
        l.preAuthorised ? "bg-[#2f7a3f]" : "bg-[#b4791f]",
      ].join(" ");
      el.textContent = l.preAuthorised ? "⚡" : "?";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(l);
        map.easeTo({ center: [l.approxLng, l.approxLat], zoom: 13 });
      });

      return new Marker({ element: el }).setLngLat([l.approxLng, l.approxLat]).addTo(map);
    });

    markersRef.current = markers;
    return () => markers.forEach((m) => m.remove());
  }, [listings]);

  /* --- render -------------------------------------------------------------- */
  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="absolute inset-0" />

      <FilterBar
        filters={filters}
        onChange={applyFilters}
        count={listings.length}
        locating={locating}
        error={error}
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
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  count: number;
  locating: boolean;
  error: string | null;
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
 * MapTiler when a key is configured, plain OSM raster otherwise so the map
 * works before anyone signs up for anything. OSM's tile policy doesn't permit
 * production traffic, so a key is needed before launch — not before testing.
 */
function buildStyle(maptilerKey: string | null): string | StyleSpecification {
  if (maptilerKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`;
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}
