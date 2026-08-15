"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { lookupAddress, resolvePrediction } from "../actions";
import { parseStreetNumber, type AddressPrediction, type ResolvedAddress } from "@/lib/geocode";

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
 * Address entry in two beats: pick the place, then confirm the number.
 *
 * The confirmation step exists because a geocoder silently overwriting a typed
 * street number would send a truck to the wrong house — and that isn't
 * hypothetical, OSM answers "1 Hastings Street" with number 18, and rural roads
 * often have no numbers at all. Google is far better here, but a unit number it
 * didn't catch still has to be addable, so the field stays editable either way.
 *
 * Street-level coordinates are fine: every pin is fuzzed ~300 m regardless, so
 * precision buys nothing. What must be exact is the text the driver reads.
 */
export function AddressStep({
  onConfirm,
  geocoder,
}: {
  onConfirm: (a: ConfirmedAddress) => void;
  geocoder: string;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ResolvedAddress | null>(null);
  const [streetNumber, setStreetNumber] = useState("");
  const [touched, setTouched] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, startResolve] = useTransition();

  /**
   * Results carry the query they came from, so what's on screen is derived
   * rather than cleared — which keeps the effect free of synchronous setState
   * and makes it impossible to show suggestions for a query already typed past.
   */
  const [answer, setAnswer] = useState<{
    query: string;
    items: AddressPrediction[];
    error: string | null;
  }>({ query: "", items: [], error: null });

  const seq = useRef(0);

  /**
   * One token per typing session. Google bills every keystroke plus the closing
   * details lookup as a single session when they share a token, and per request
   * when they don't. Minted on first use rather than during render, since
   * randomUUID isn't a pure call.
   */
  const sessionToken = useRef<string | null>(null);
  function token(): string {
    sessionToken.current ??= crypto.randomUUID();
    return sessionToken.current;
  }

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
      const res = await lookupAddress(trimmed, token());
      if (mine !== seq.current) return;
      setAnswer({ query: trimmed, items: res.results ?? [], error: res.error ?? null });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed, longEnough, chosen]);

  function accept(address: ResolvedAddress) {
    setChosen(address);
    // Prefer what the user typed; fall back to what the provider knew.
    setStreetNumber(parseStreetNumber(query) ?? address.streetNumber ?? "");
    // Fetching details closes the session; the next search opens a fresh one.
    sessionToken.current = null;
  }

  function pick(p: AddressPrediction) {
    setResolveError(null);
    if (p.resolved) {
      accept(p.resolved);
      return;
    }
    startResolve(async () => {
      const res = await resolvePrediction(p.id, token());
      if (res.address) accept(res.address);
      else setResolveError(res.error ?? "Couldn't load that address.");
    });
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
        Start typing and pick your address — spelling doesn&apos;t have to be
        perfect. We only ever show other users your suburb and an approximate
        pin, never your street address, until you accept a drop.
      </p>

      {(error || resolveError) && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {error ?? resolveError}
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2" aria-busy={resolving}>
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                disabled={resolving}
                className="card w-full text-left transition-colors hover:border-brand disabled:opacity-60"
              >
                <div className="font-medium">{p.primary}</div>
                {p.secondary && <div className="mt-0.5 text-sm text-muted">{p.secondary}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && longEnough && results.length === 0 && !error && (
        <p className="mt-4 text-sm text-muted">
          No match yet — try the street and suburb, like &ldquo;Eumundi Noosa Rd
          Noosaville&rdquo;.
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
