"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createListing, type ListingState } from "../actions";
import { AddressStep, type ConfirmedAddress } from "./address-step";
import { PhotoField } from "@/app/photo-field";
import {
  DROP_SPOTS,
  DROP_SPOT_KEYS,
  MATERIALS_WANTED,
  MATERIAL_WANTED_KEYS,
  VOLUME_TIERS,
  VOLUME_TIER_KEYS,
  formatPrice,
  type DropSpotKey,
  type MaterialWantedKey,
  type VolumeTierKey,
} from "@/lib/listing-options";

export function NewListingForm({ geocoder }: { geocoder: string }) {
  const [address, setAddress] = useState<ConfirmedAddress | null>(null);

  return address ? (
    <DetailsStep address={address} onBack={() => setAddress(null)} />
  ) : (
    <AddressStep onConfirm={setAddress} geocoder={geocoder} />
  );
}

function DetailsStep({ address, onBack }: { address: ConfirmedAddress; onBack: () => void }) {
  const [state, action] = useActionState<ListingState, FormData>(createListing, {});
  const [wanted, setWanted] = useState<MaterialWantedKey>("wood_chips");
  const [tier, setTier] = useState<VolumeTierKey>("medium");
  const [dropSpot, setDropSpot] = useState<DropSpotKey>("driveway");

  return (
    <form action={action} className="mt-6">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Step 2 of 2</div>
        <h1 className="mt-1 text-2xl font-semibold">What do you want?</h1>
      </div>

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

      {/* Material ---------------------------------------------------------- */}
      <div className="mt-8">
        <label className="label" htmlFor="wanted">
          What do you want?
        </label>
        <select
          id="wanted"
          name="wanted"
          value={wanted}
          onChange={(e) => setWanted(e.target.value as MaterialWantedKey)}
          className="field"
        >
          {MATERIAL_WANTED_KEYS.map((key) => (
            <option key={key} value={key}>
              {MATERIALS_WANTED[key].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">{MATERIALS_WANTED[wanted].blurb}</p>
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

      {/* Species exclusions used to be asked here. Removed as a step: it made
          the form longer at exactly the point people abandon it, and every
          restriction shrinks the pool of drivers who can help. The column and
          the display code stay, so existing listings keep their values and the
          question can come back later — as an edit-time option rather than
          something between a gardener and their first pin. */}

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

      {/* Contact ----------------------------------------------------------- */}
      <fieldset className="mt-8">
        <legend className="label">Before they turn up</legend>
        <p className="mb-3 text-xs text-muted">
          Any approved crew can claim your pin and will get your address. That&apos;s
          what gets mulch to you quickly — a driver with a full truck picks the
          drop they can act on now.
        </p>
        <label className="card flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="callFirst"
            className="mt-1 size-4 accent-[var(--brand)]"
          />
          <span>
            <span className="block font-medium">Ring me before you come</span>
            <span className="mt-0.5 block text-sm text-muted">
              Tick this if you need to open a gate, move a car, or just want the
              heads-up. The driver still claims it on the spot — they phone
              first instead of waiting on a reply.
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
