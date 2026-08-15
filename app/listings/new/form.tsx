"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { createListing, lookupAddress, type ListingState } from "../actions";
import { PhotoField } from "@/app/photo-field";
import type { GeocodeResult } from "@/lib/geocode";
import { EXCLUSIONS } from "@/lib/db/schema";
import {
  DROP_SPOTS,
  DROP_SPOT_KEYS,
  EXCLUSION_LABELS,
  VOLUME_TIERS,
  VOLUME_TIER_KEYS,
  formatPrice,
  type DropSpotKey,
  type VolumeTierKey,
} from "@/lib/listing-options";

export function NewListingForm({ usingFallbackGeocoder }: { usingFallbackGeocoder: boolean }) {
  const [address, setAddress] = useState<GeocodeResult | null>(null);

  return address ? (
    <DetailsStep address={address} onBack={() => setAddress(null)} />
  ) : (
    <AddressStep onPick={setAddress} usingFallbackGeocoder={usingFallbackGeocoder} />
  );
}

/* -------------------------------------------------------------------------- */

function AddressStep({
  onPick,
  usingFallbackGeocoder,
}: {
  onPick: (r: GeocodeResult) => void;
  usingFallbackGeocoder: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search() {
    setError(null);
    startTransition(async () => {
      const res = await lookupAddress(query);
      setResults(res.results ?? []);
      setError(res.error ?? null);
    });
  }

  return (
    <div className="mt-6">
      <Step n={1} of={2} title="Where should the mulch go?" />

      <label className="label mt-6" htmlFor="query">
        Your address
      </label>
      <div className="flex gap-2">
        <input
          id="query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="12 Smith St, Katoomba NSW 2780"
          autoComplete="street-address"
          className="field"
        />
        <button
          type="button"
          onClick={search}
          disabled={pending || query.trim().length < 5}
          className="btn-secondary shrink-0"
        >
          {pending ? "…" : "Find"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Include the suburb and postcode. We only ever show other users your
        suburb and an approximate pin — never your street address, until you
        accept a drop.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-6">
          <div className="label">Pick the right one</div>
          <ul className="space-y-2">
            {results.map((r, i) => (
              <li key={`${r.formatted}-${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className="card w-full text-left transition-colors hover:border-brand"
                >
                  <div className="font-medium">
                    {r.addressLine}, {r.suburb} {r.state} {r.postcode}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{r.formatted}</div>
                </button>
              </li>
            ))}
          </ul>
          {usingFallbackGeocoder && (
            <p className="mt-3 text-xs text-muted">
              Not listed? Address data is patchy for newer streets until we
              switch on the paid lookup.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function DetailsStep({ address, onBack }: { address: GeocodeResult; onBack: () => void }) {
  const [state, action] = useActionState<ListingState, FormData>(createListing, {});
  const [tier, setTier] = useState<VolumeTierKey>("medium");
  const [dropSpot, setDropSpot] = useState<DropSpotKey>("driveway");

  return (
    <form action={action} className="mt-6">
      <Step n={2} of={2} title="What will you take?" />

      <input type="hidden" name="addressLine" value={address.addressLine} />
      <input type="hidden" name="suburb" value={address.suburb} />
      <input type="hidden" name="state" value={address.state} />
      <input type="hidden" name="postcode" value={address.postcode} />
      <input type="hidden" name="lat" value={address.lat} />
      <input type="hidden" name="lng" value={address.lng} />

      <div className="card mt-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted">Delivering to</div>
          <div className="mt-0.5 font-medium">
            {address.addressLine}, {address.suburb} {address.state} {address.postcode}
          </div>
        </div>
        <button type="button" onClick={onBack} className="shrink-0 text-sm text-brand hover:underline">
          Change
        </button>
      </div>

      {/* Volume ------------------------------------------------------------ */}
      <fieldset className="mt-8">
        <legend className="label">How much will you take?</legend>
        <p className="mb-3 text-xs text-muted">
          Be honest about the upper limit — a driver who arrives and can only
          tip half a load won&apos;t come back.
        </p>
        <div className="space-y-2">
          {VOLUME_TIER_KEYS.map((key) => {
            const t = VOLUME_TIERS[key];
            return (
              <label
                key={key}
                className={`card flex cursor-pointer items-start gap-3 ${
                  tier === key ? "border-brand" : ""
                }`}
              >
                <input
                  type="radio"
                  name="tier"
                  value={key}
                  checked={tier === key}
                  onChange={() => setTier(key)}
                  className="mt-1 size-4 accent-[var(--brand)]"
                />
                <span className="flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{t.label}</span>
                    <span className="text-sm font-semibold text-brand">
                      {formatPrice(t.priceCents)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{t.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          You&apos;re only charged once a load has actually been delivered and
          you&apos;ve confirmed it arrived. Listing is free.
        </p>
      </fieldset>

      {/* Exclusions -------------------------------------------------------- */}
      <fieldset className="mt-8">
        <legend className="label">Anything you won&apos;t accept?</legend>
        <p className="mb-3 text-xs text-muted">
          Optional. Fewer restrictions means more drivers can help you.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXCLUSIONS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-card p-3"
            >
              <input
                type="checkbox"
                name="excludes"
                value={key}
                className="mt-0.5 size-4 accent-[var(--brand)]"
              />
              <span>
                <span className="block text-sm font-medium">{EXCLUSION_LABELS[key].label}</span>
                <span className="block text-xs text-muted">{EXCLUSION_LABELS[key].why}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Access ------------------------------------------------------------ */}
      <fieldset className="mt-8">
        <legend className="label">Where does the truck tip it?</legend>
        <div className="space-y-2">
          {DROP_SPOT_KEYS.map((key) => (
            <label
              key={key}
              className={`card flex cursor-pointer items-start gap-3 ${
                dropSpot === key ? "border-brand" : ""
              }`}
            >
              <input
                type="radio"
                name="dropSpot"
                value={key}
                checked={dropSpot === key}
                onChange={() => setDropSpot(key)}
                className="mt-1 size-4 accent-[var(--brand)]"
              />
              <span>
                <span className="block font-medium">{DROP_SPOTS[key].label}</span>
                <span className="block text-sm text-muted">{DROP_SPOTS[key].hint}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="label mt-4" htmlFor="accessNotes">
          Access notes
        </label>
        <textarea
          id="accessNotes"
          name="accessNotes"
          rows={3}
          maxLength={500}
          placeholder="Steep driveway, low wires at the gate, dogs in the yard, park on the street side…"
          className="field"
        />
        <p className="mt-1.5 text-xs text-muted">
          Overhead clearance and driveway width are the two things that turn a
          driver around on arrival. Mention them.
        </p>

        <div className="mt-6">
          <PhotoField
            name="photo"
            label="Photo of the spot"
            hint="Worth more than anything else on this page. Stand where the truck would park and shoot towards the drop spot, so the driver can see the width, the surface and anything overhead. Drivers see this before they commit."
          />
        </div>
      </fieldset>

      {/* Pre-auth ---------------------------------------------------------- */}
      <fieldset className="mt-8">
        <legend className="label">Do we need to check with you first?</legend>
        <label className="card flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="preAuthorised"
            className="mt-1 size-4 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-medium">Drop anytime — don&apos;t ask me first</span>
            <span className="mt-0.5 block text-sm text-muted">
              Far and away the best way to actually get mulch. Drivers decide
              with a full truck in front of them, and a pin they can claim on
              the spot beats one that needs a phone call. Leave it off and
              we&apos;ll text you for approval each time instead.
            </span>
          </span>
        </label>
      </fieldset>

      {state.error && (
        <p className="mt-6 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary mt-8 w-full">
      {pending ? "Creating…" : "Put my pin on the map"}
    </button>
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
