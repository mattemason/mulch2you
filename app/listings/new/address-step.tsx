"use client";

import { useEffect, useRef, useState } from "react";
import { lookupAddress } from "../actions";
import { parseStreetNumber, type AddressSuggestion } from "@/lib/geocode";

export type ConfirmedAddress = {
  addressLine: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
};

const DEBOUNCE_MS = 300;

/**
 * Address entry in two beats: search the street, then confirm the number.
 *
 * The split exists because OSM house numbers in Australia are unreliable —
 * asking for 1 Hastings Street can return number 18, and rural roads often
 * have no numbers at all. Letting a geocoder silently overwrite what someone
 * typed would send a truck to the wrong house. So a suggestion supplies the
 * street, suburb and coordinates; the number stays the user's, pre-filled from
 * whatever they typed and editable before they commit.
 *
 * Street-level coordinates are fine here — every pin is fuzzed ~300 m anyway,
 * so precision buys nothing. What must be right is the text the driver reads.
 */
export function AddressStep({
  onConfirm,
  geocoder,
}: {
  onConfirm: (a: ConfirmedAddress) => void;
  geocoder: string;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<AddressSuggestion | null>(null);
  const [streetNumber, setStreetNumber] = useState("");
  const [touched, setTouched] = useState(false);

  /**
   * Results are stored with the query they came from, so what's on screen can
   * be derived rather than cleared. That keeps the effect free of synchronous
   * setState and, more usefully, makes it impossible to show suggestions for
   * a query the user has already typed past.
   */
  const [answer, setAnswer] = useState<{
    query: string;
    items: AddressSuggestion[];
    error: string | null;
  }>({ query: "", items: [], error: null });

  // Ignores responses that arrive out of order.
  const seq = useRef(0);

  const trimmed = query.trim();
  const longEnough = trimmed.length >= 4;
  const current = answer.query === trimmed;
  const results = current ? answer.items : [];
  const error = current ? answer.error : null;
  const searching = longEnough && !current;

  useEffect(() => {
    if (chosen || !longEnough) return;

    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      const res = await lookupAddress(trimmed);
      if (mine !== seq.current) return;
      setAnswer({ query: trimmed, items: res.results ?? [], error: res.error ?? null });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, longEnough, chosen]);

  function pick(s: AddressSuggestion) {
    setChosen(s);
    // Prefer what the user typed; fall back to whatever the geocoder knew.
    setStreetNumber(parseStreetNumber(query) ?? s.streetNumber ?? "");
  }

  function confirm() {
    setTouched(true);
    if (!chosen || !streetNumber.trim()) return;
    onConfirm({
      addressLine: `${streetNumber.trim()} ${chosen.street}`,
      suburb: chosen.suburb,
      state: chosen.state,
      postcode: chosen.postcode,
      lat: chosen.lat,
      lng: chosen.lng,
    });
  }

  if (chosen) {
    const missingNumber = touched && !streetNumber.trim();
    return (
      <div className="mt-6">
        <Step n={1} of={2} title="Is this right?" />

        <div className="card mt-6">
          <label className="label" htmlFor="streetNumber">
            Street or unit number
          </label>
          <input
            id="streetNumber"
            value={streetNumber}
            onChange={(e) => setStreetNumber(e.target.value)}
            inputMode="numeric"
            autoFocus
            placeholder="95"
            className="field"
            aria-invalid={missingNumber}
          />
          {missingNumber && (
            <p className="mt-1.5 text-sm text-accent">
              We need a number so the driver finds the right place.
            </p>
          )}
          <p className="mt-3 text-lg font-medium">
            {streetNumber.trim() || "…"} {chosen.street}
          </p>
          <p className="text-muted">
            {chosen.suburb} {chosen.state} {chosen.postcode}
          </p>
        </div>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={confirm} className="btn-primary flex-1">
            Yes, that&apos;s it
          </button>
          <button
            type="button"
            onClick={() => {
              setChosen(null);
              setTouched(false);
            }}
            className="btn-secondary"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <Step n={1} of={2} title="Where should the mulch go?" />

      <label className="label mt-6" htmlFor="address">
        Your address
      </label>
      <input
        id="address"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="95 Eumundi Noosa Road"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="field"
      />
      <p className="mt-1.5 text-xs text-muted">
        Start typing and pick your street — spelling doesn&apos;t have to be
        perfect. We only ever show other users your suburb and an approximate
        pin, never your street address, until you accept a drop.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s)}
                className="card w-full text-left transition-colors hover:border-brand"
              >
                <div className="font-medium">{s.street}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {s.suburb} {s.state} {s.postcode}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && longEnough && results.length === 0 && !error && (
        <p className="mt-4 text-sm text-muted">
          No match yet — try just the street and suburb, like &ldquo;Eumundi
          Noosa Rd Noosaville&rdquo;.
        </p>
      )}

      <p className="mt-6 text-xs text-muted">Addresses from {geocoder}.</p>
    </div>
  );
}

function Step({ n, of, title }: { n: number; of: number; title: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        Step {n} of {of}
      </div>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
    </div>
  );
}
