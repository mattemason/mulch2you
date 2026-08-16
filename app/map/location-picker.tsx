"use client";

import { useEffect, useRef, useState } from "react";
import type { Coords } from "@/lib/geo";
import { lookupPlace } from "./actions";
import { Icon } from "./icons";

const DEBOUNCE_MS = 300;

/**
 * Lets a driver search around a suburb instead of wherever their phone thinks
 * they are.
 *
 * GPS is right for the common case — a crew mid-job wanting the nearest drop —
 * but it's useless for the other half: planning tomorrow's run, or a yard
 * manager routing someone else's truck. Neither should require standing in the
 * right postcode.
 */
export function LocationPicker({
  label,
  onPick,
  onUseGps,
  onClose,
}: {
  label: string;
  onPick: (at: Coords, label: string) => void;
  onUseGps: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<{
    query: string;
    places: { id: string; label: string; lat: number; lng: number }[];
    error: string | null;
  }>({ query: "", places: [], error: null });
  const seq = useRef(0);

  const trimmed = query.trim();
  const longEnough = trimmed.length >= 3;
  const current = answer.query === trimmed;
  const places = current ? answer.places : [];
  const searching = longEnough && !current;

  useEffect(() => {
    if (!longEnough) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await lookupPlace(trimmed);
      if (mine !== seq.current) return;
      setAnswer({ query: trimmed, places: res.places ?? [], error: res.error ?? null });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, longEnough]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="whereTitle">
        <h3 id="whereTitle">Search around…</h3>
        <p>Currently {label}.</p>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suburb, town or postcode"
          autoComplete="off"
          className="place-input"
          aria-label="Suburb, town or postcode"
        />

        {answer.error && current && <p className="modal-error">{answer.error}</p>}

        <div className="place-results">
          {places.map((p) => (
            <button
              key={p.id}
              type="button"
              className="place-row"
              onClick={() => onPick({ lat: p.lat, lng: p.lng }, p.label)}
            >
              <Icon.pin size={15} />
              <span>{p.label}</span>
            </button>
          ))}
          {!searching && longEnough && places.length === 0 && !answer.error && (
            <p className="place-empty">No match. Try just the suburb name.</p>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost btn-block" onClick={onUseGps}>
            <Icon.locate size={17} /> Use my current location
          </button>
        </div>
      </div>
    </div>
  );
}
