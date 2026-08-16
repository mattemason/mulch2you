"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/app/supplier-ui.css";
import type { NearbyListing } from "@/lib/db/queries";
import { formatDistance, type Coords } from "@/lib/geo";
import { listingRef } from "@/lib/refs";
import {
  EXCLUSION_LABELS,
  MATERIALS_WANTED,
  MATERIAL_WANTED_KEYS,
  VOLUME_TIERS,
  VOLUME_TIER_KEYS,
  tipsPhrase,
  type Exclusion,
  type MaterialWantedKey,
  type VolumeTierKey,
} from "@/lib/listing-options";
import { Icon } from "./icons";
import { LocationPicker } from "./location-picker";

/** Sydney GPO — only if the browser won't or can't give up a location. */
const FALLBACK_CENTRE: Coords = { lat: -33.8688, lng: 151.2093 };
const LOCATE_TIMEOUT_MS = 9000;

/**
 * MapLibre would otherwise resolve its worker relative to the bundled chunk,
 * where the file doesn't exist — the request 404s to Next's HTML error page and
 * the worker never starts, leaving a map that renders controls and markers over
 * a blank canvas. scripts/copy-maplibre-worker.mjs puts it here.
 */
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

/**
 * Inline so markers never depend on the CSS build having emitted a utility.
 * Green means claim it and go; orange means you'll have to wait for a reply.
 */
const PIN_NOW = "#2E7D22";
const PIN_OPEN = "#E8631A";
/** Held by another crew — visible, but plainly not on offer. */
const PIN_PENDING = "#9AA491";

/**
 * Deliberately the same axes a gardener fills in when listing — load size and
 * what they want — so a driver searches on the terms the data was entered in
 * rather than a translation of them.
 */
type Filters = {
  radiusKm: number;
  now: boolean;
  hideTaken: boolean;
  tier: "" | VolumeTierKey;
  wanted: "" | MaterialWantedKey;
};

const DEFAULT_FILTERS: Filters = {
  radiusKm: 25,
  now: false,
  hideTaken: false,
  tier: "",
  wanted: "",
};

export function SupplierMap({ maptilerKey }: { maptilerKey: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const requestSeq = useRef(0);
  const selectedRef = useRef<string | null>(null);

  const [centre, setCentre] = useState<Coords | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [listings, setListings] = useState<NearbyListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapBroken, setMapBroken] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [canResearch, setCanResearch] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * What to call the search centre. Coordinates are meaningless to a driver,
   * and reverse-geocoding the GPS fix would be a paid call to answer a
   * question nobody asked — "My location" says everything useful.
   */
  const [centreLabel, setCentreLabel] = useState<string | null>(null);

  const locating = centre === null;
  const effectiveCentre = centre ?? FALLBACK_CENTRE;
  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const listMode = view === "list" || mapBroken;

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  /* --- data ---------------------------------------------------------------- */
  const search = useCallback(async (at: Coords, f: Filters) => {
    const seq = ++requestSeq.current;
    const params = new URLSearchParams({
      lat: String(at.lat),
      lng: String(at.lng),
      radiusKm: String(f.radiusKm),
    });
    if (f.now) params.set("preAuthorisedOnly", "true");
    if (f.hideTaken) params.set("excludePending", "true");
    if (f.tier) params.set("tier", f.tier);
    if (f.wanted) params.set("wanted", f.wanted);

    try {
      const res = await fetch(`/api/listings/nearby?${params}`);
      if (seq !== requestSeq.current) return;
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Couldn't load sites");
        return;
      }
      const data = (await res.json()) as { listings: NearbyListing[] };
      if (seq !== requestSeq.current) return;
      setListings(data.listings);
      setError(null);
    } catch {
      if (seq === requestSeq.current) setError("Couldn't load sites — check your signal");
    }
  }, []);

  const applyCentre = useCallback(
    (next: Coords, label: string | null = null, fly = true) => {
      setCentre(next);
      setCentreLabel(label);
      setSelectedId(null);
      if (fly) mapRef.current?.easeTo({ center: [next.lng, next.lat], zoom: 11 });
      void search(next, filters);
    },
    [filters, search],
  );

  const applyFilters = useCallback(
    (next: Filters) => {
      setFilters(next);
      setSelectedId(null);
      void search(effectiveCentre, next);
    },
    [effectiveCentre, search],
  );

  /* --- locate the truck ---------------------------------------------------- */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (requestSeq.current === 0) applyCentre(FALLBACK_CENTRE, "Sydney (couldn't locate you)");
    }, LOCATE_TIMEOUT_MS);

    navigator.geolocation?.getCurrentPosition(
      (pos) => applyCentre({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "My location"),
      () => applyCentre(FALLBACK_CENTRE, "Sydney (couldn't locate you)"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
    return () => clearTimeout(timer);
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
      console.error("map failed to initialise", err);
      queueMicrotask(() => setMapBroken(true));
      return;
    }

    // Tile and style failures arrive as events, not exceptions — without this
    // a blocked CDN is silent and the driver just sees a blank rectangle.
    map.on("error", (e) => {
      console.error("map error", e.error ?? e);
      setMapBroken(true);
    });
    map.on("load", () => map.resize());
    // Only offer "search this area" once they've actually moved it.
    map.on("dragend", () => setCanResearch(true));
    map.on("zoomend", () => setCanResearch(true));

    // Flexbox can settle after the map reads its container size, and a map
    // built at zero height stays at zero height.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    mapRef.current = map;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [maptilerKey]);

  // Coming back from the list leaves the canvas stale until it re-measures.
  useEffect(() => {
    if (!listMode) mapRef.current?.resize();
  }, [listMode]);

  /* --- markers ------------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = listings.map((l) => {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", `${VOLUME_TIERS[l.tier].label} in ${l.suburb}`);
      const colour = l.pending ? PIN_PENDING : l.preAuthorised ? PIN_NOW : PIN_OPEN;
      const cap = l.maxVolumeM3 ? Math.round(Number(l.maxVolumeM3)) : "∞";
      el.innerHTML =
        `<span style="position:relative;display:block;width:44px;height:52px;` +
        `filter:drop-shadow(0 5px 8px rgba(20,23,15,.3))">` +
        `<svg width="44" height="52" viewBox="0 0 44 52"><path ` +
        `d="M22 1c9.4 0 17 7.6 17 17 0 12.3-17 33-17 33S5 30.3 5 18C5 8.6 12.6 1 22 1z" ` +
        `fill="${colour}" stroke="#fff" stroke-width="2.5"/></svg>` +
        `<span style="position:absolute;top:8px;left:0;right:0;text-align:center;color:#fff;` +
        `font:800 12px/1 system-ui,sans-serif">${cap}</span></span>`;
      Object.assign(el.style, { background: "none", border: "0", padding: "0", cursor: "pointer" });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedId(l.id);
        map.easeTo({ center: [l.approxLng, l.approxLat], zoom: Math.max(map.getZoom(), 13) });
      });

      return new Marker({ element: el, anchor: "bottom" })
        .setLngLat([l.approxLng, l.approxLat])
        .addTo(map);
    });

    // Frame everything found, so pins are never just off-screen.
    if (listings.length > 0 && !selectedRef.current) {
      const bounds = new LngLatBounds();
      listings.forEach((l) => bounds.extend([l.approxLng, l.approxLat]));
      map.fitBounds(bounds, { padding: 90, maxZoom: 13, duration: 0 });
    }

    return () => markers.forEach((m) => m.remove());
  }, [listings]);

  /* --- render -------------------------------------------------------------- */
  const count = listings.length;
  const countLabel = `${count} ${count === 1 ? "site" : "sites"}`;

  return (
    <div className={`m2y m2y-app${listMode ? " list-mode" : ""}`}>
      <div className="panel">
        <header className="appbar">
          <Link href="/dashboard" className="icon-btn" aria-label="Back to dashboard">
            <Icon.back />
          </Link>
          <button className="appbar-loc" onClick={() => setPickerOpen(true)}>
            <div className="lbl">Searching around</div>
            <div className="val">
              <Icon.pin />
              <span className="txt">
                {locating ? "Finding you…" : (centreLabel ?? "My location")}
              </span>
              <svg
                className="chev"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </button>
          <div className="seg" role="group" aria-label="Map or list">
            <button aria-pressed={!listMode} onClick={() => setView("map")}>
              <Icon.mapOn /> Map
            </button>
            <button aria-pressed={listMode} onClick={() => setView("list")}>
              <Icon.list /> List
            </button>
          </div>
        </header>

        <div className="filters">
          <div className="filter-row">
            <button
              className="fchip"
              aria-pressed={filters.now}
              onClick={() => applyFilters({ ...filters, now: !filters.now })}
            >
              <span className="bolt">
                <Icon.bolt />
              </span>
              Drop now
            </button>
            <button
              className="fchip"
              aria-pressed={filters.hideTaken}
              onClick={() => applyFilters({ ...filters, hideTaken: !filters.hideTaken })}
            >
              Hide taken
            </button>
            <label className="fchip fchip--select">
              <Icon.truck />
              <select
                value={filters.tier}
                aria-label="Load size"
                onChange={(e) =>
                  applyFilters({ ...filters, tier: e.target.value as Filters["tier"] })
                }
              >
                <option value="">Any size</option>
                {VOLUME_TIER_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {VOLUME_TIERS[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fchip fchip--select">
              <Icon.leaf />
              <select
                value={filters.wanted}
                aria-label="What they want"
                onChange={(e) =>
                  applyFilters({ ...filters, wanted: e.target.value as Filters["wanted"] })
                }
              >
                <option value="">Any material</option>
                {MATERIAL_WANTED_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {MATERIALS_WANTED[k].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="fchip fchip--select">
              <Icon.pin />
              <select
                value={filters.radiusKm}
                aria-label="Search radius"
                onChange={(e) => applyFilters({ ...filters, radiusKm: Number(e.target.value) })}
              >
                {[10, 25, 50, 100].map((km) => (
                  <option key={km} value={km}>
                    Within {km} km
                  </option>
                ))}
              </select>
            </label>
            <button className="fclear" onClick={() => applyFilters(DEFAULT_FILTERS)}>
              Clear
            </button>
          </div>
          <div className="filter-meta">
            {error ? (
              <span style={{ color: "#B8480E", fontWeight: 700 }}>{error}</span>
            ) : (
              <>
                <span>
                  <strong>{locating ? "Finding you…" : countLabel}</strong>
                  {!locating && " nearby"}
                </span>
                <span>·</span>
                <span className="bolt-key">
                  <Icon.bolt size={12} /> means claim it and go
                </span>
              </>
            )}
          </div>
        </div>

        <section className={`sheet${sheetOpen ? " open" : ""}`} aria-label="Nearby drop sites">
          <div className="sheet-grab">
            <i />
          </div>
          <button className="sheet-head" onClick={() => setSheetOpen((o) => !o)}>
            <h2>{locating ? "Finding you…" : `${countLabel} within ${filters.radiusKm} km`}</h2>
            <span className="sort">Nearest first</span>
          </button>
          <div className="sheet-list">
            {count === 0 && !locating ? (
              <div className="empty">
                <Icon.pin size={40} />
                <h3>Nothing matches that</h3>
                <p>Try widening the radius or dropping a filter.</p>
                <button className="btn btn-ghost" onClick={() => applyFilters(DEFAULT_FILTERS)}>
                  Clear filters
                </button>
              </div>
            ) : (
              listings.map((l) => (
                <SiteCard
                  key={l.id}
                  listing={l}
                  active={l.id === selectedId}
                  onSelect={() => {
                    setSelectedId(l.id);
                    mapRef.current?.flyTo({
                      center: [l.approxLng, l.approxLat],
                      zoom: 13,
                      duration: 500,
                    });
                  }}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mapbody">
        <div ref={containerRef} className="mapcanvas" />

        {mapBroken && (
          <div className="map-fallback">
            <div className="inner">
              <Icon.mapOff />
              <h3>Map didn&apos;t load</h3>
              <p>Could be your connection. The sites are all still here as a list.</p>
              <button className="btn btn-green" onClick={() => setView("list")}>
                Show the list
              </button>
            </div>
          </div>
        )}

        {canResearch && !mapBroken && (
          <button
            className="research"
            onClick={() => {
              const c = mapRef.current?.getCenter();
              setCanResearch(false);
              if (c) applyCentre({ lat: c.lat, lng: c.lng }, "this area", false);
            }}
          >
            <Icon.refresh /> Search this area
          </button>
        )}

        <div className="map-ctl">
          <button className="mbtn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
            <Icon.plus />
          </button>
          <button className="mbtn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
            <Icon.minus />
          </button>
          <button
            className="mbtn"
            aria-label="Centre on me"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((p) =>
                applyCentre({ lat: p.coords.latitude, lng: p.coords.longitude }, "My location"),
              )
            }
          >
            <Icon.locate />
          </button>
        </div>

        {pickerOpen && (
          <LocationPicker
            label={locating ? "finding you" : (centreLabel ?? "my location")}
            onPick={(at, label) => {
              setPickerOpen(false);
              applyCentre(at, label);
            }}
            onUseGps={() => {
              setPickerOpen(false);
              navigator.geolocation?.getCurrentPosition(
                (p) => applyCentre({ lat: p.coords.latitude, lng: p.coords.longitude }, "My location"),
                () => applyCentre(FALLBACK_CENTRE, "Sydney (couldn't locate you)"),
              );
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {selected && (
          <Preview
            listing={selected}
            origin={effectiveCentre}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Badges({ listing }: { listing: NearbyListing }) {
  return (
    <div className="badges">
      {listing.pending ? (
        <span className="badge badge--pending">Pending delivery</span>
      ) : listing.preAuthorised ? (
        <span className="badge badge--now">
          <Icon.bolt size={10} /> Drop now
        </span>
      ) : (
        <span className="badge badge--approve">Approve first</span>
      )}
      <span className="badge badge--size">
        {listing.tier === "unlimited" ? "Send everything" : VOLUME_TIERS[listing.tier].label}
      </span>
      {listing.callFirst && <span className="badge badge--call">Ring first</span>}
    </div>
  );
}

function SiteCard({
  listing,
  active,
  onSelect,
}: {
  listing: NearbyListing;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`card${active ? " is-active" : ""}`} onClick={onSelect}>
      <div className="card-main">
        <div className="card-title">
          {listing.suburb}
          <Badges listing={listing} />
        </div>
        <div className="card-meta">
          {formatDistance(listing.distanceKm)} away · {tipsPhrase(listing.dropSpot)}
        </div>
        <div className="card-facts">
          <span>
            <Icon.leaf /> {MATERIALS_WANTED[listing.wanted].label}
          </span>
          <span>
            <Icon.clock /> {listedAgo(listing.createdAt)}
          </span>
        </div>
        {listing.excludes.length > 0 && (
          <div className="card-restrict">
            Won&apos;t take:{" "}
            {listing.excludes
              .map((e) => EXCLUSION_LABELS[e as Exclusion]?.label.replace(/^No /, "") ?? e)
              .join(", ")}
          </div>
        )}
      </div>
      <span className="card-go">
        <Icon.chevron />
      </span>
    </button>
  );
}

function Preview({
  listing,
  origin,
  onClose,
}: {
  listing: NearbyListing;
  origin: Coords;
  onClose: () => void;
}) {
  // Pass where we searched from, so the detail page shows the same distance
  // as the card that was tapped rather than recomputing from nothing.
  const href = `/sites/${listing.id}?lat=${origin.lat}&lng=${origin.lng}`;
  return (
    <div className="preview" role="dialog" aria-label="Site preview">
      <button className="preview-close" onClick={onClose} aria-label="Close">
        <Icon.close />
      </button>
      <div className="preview-top">
        <div className="thumb">
          {listing.photoKey ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/photos/${listing.photoKey}`} alt="" loading="lazy" />
          ) : (
            <Icon.photo />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>
            {listing.suburb} {listing.state}
          </h3>
          <Badges listing={listing} />
          <div className="preview-meta">
            {formatDistance(listing.distanceKm)} away · {tipsPhrase(listing.dropSpot)}
          </div>
        </div>
      </div>
      <div className="preview-facts">
        <span>
          <Icon.leaf /> {MATERIALS_WANTED[listing.wanted].label}
        </span>
        <span>
          <Icon.box /> {listingRef(listing.id)}
        </span>
      </div>
      <div className="preview-actions">
        {listing.pending ? (
          <button type="button" className="btn btn-ghost btn-block" disabled>
            Another crew has this one
          </button>
        ) : (
          <Link className="btn btn-green btn-block" href={href}>
            View site <Icon.arrow />
          </Link>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function listedAgo(createdAt: Date | string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days < 1) return "Listed today";
  if (days === 1) return "Listed yesterday";
  return `Listed ${days} days ago`;
}

/**
 * OpenFreeMap by default: free vector tiles, no key, no signup, and — unlike
 * raw OpenStreetMap raster tiles — explicitly fine for production traffic.
 * MapTiler takes over when a key is set: same rendering, paid CDN behind it.
 */
function buildStyle(maptilerKey: string | null): string {
  return maptilerKey
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${maptilerKey}`
    : "https://tiles.openfreemap.org/styles/liberty";
}
