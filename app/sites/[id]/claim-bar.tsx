"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { claimListing, offerDrop, type OfferState } from "@/app/drops/actions";
import { ETA_WINDOWS, ETA_WINDOW_KEYS } from "@/lib/listing-options";
import { Icon } from "@/app/map/icons";
import "@/app/supplier-ui.css";

/**
 * The sticky claim bar and its confirmation.
 *
 * A real modal rather than confirm(), because the checklist is the point: a
 * driver who claims a site their truck can't service wastes their own trip and
 * blocks the pin for everyone else. The list restates the constraints they'd
 * otherwise have scrolled past.
 */
export function ClaimBar({
  listingId,
  preAuthorised,
  unavailable,
  unavailableReason,
  maxVolume,
  excludes,
  dropSpot,
  holdHours,
}: {
  listingId: string;
  preAuthorised: boolean;
  unavailable: boolean;
  unavailableReason: string;
  maxVolume: string;
  excludes: string[];
  dropSpot: string;
  holdHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function confirm() {
    setError(null);
    start(async () => {
      const res = await claimListing(listingId);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.dropId) router.push(`/drops/${res.dropId}`);
    });
  }

  if (unavailable) {
    return (
      <div className="actionbar">
        <div className="actionbar-in">
          <button className="btn btn-ghost btn-block" disabled>
            {unavailableReason}
          </button>
        </div>
      </div>
    );
  }

  if (!preAuthorised) {
    return <OfferBar listingId={listingId} maxVolume={maxVolume} dropSpot={dropSpot} />;
  }

  return (
    <>
      <div className="actionbar">
        <div className="actionbar-in">
          <button className="btn btn-now btn-block" onClick={() => setOpen(true)}>
            <Icon.bolt size={17} /> Claim this drop
          </button>
        </div>
      </div>

      {open && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="claimTitle">
            <h3 id="claimTitle">Claim this drop?</h3>
            <p>
              This holds the site for you for {holdHours} hours and releases the exact
              address.
            </p>

            <div className="modal-check">
              <div>
                <Icon.check />
                <span>
                  Your load is <strong>{maxVolume}</strong> or less.
                </span>
              </div>
              <div>
                <Icon.check />
                <span>
                  Your truck can tip on the <strong>{dropSpot.toLowerCase()}</strong>.
                </span>
              </div>
              {excludes.length > 0 && (
                <div>
                  <Icon.check />
                  <span>
                    Your load contains no <strong>{excludes.join(", ")}</strong>.
                  </span>
                </div>
              )}
              <div>
                <Icon.check />
                <span>You&apos;ll photograph the tipped load to close the job.</span>
              </div>
            </div>

            {error && <p className="modal-error">{error}</p>}

            <div className="modal-actions">
              <button className="btn btn-now btn-block" onClick={confirm} disabled={pending}>
                {pending ? "Claiming…" : "Yes, claim it"}
              </button>
              <button className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


/**
 * Ask-first pins. Nothing is released by sending a request — the gardener gets
 * an email, and only their yes hands over an address, which is exactly what
 * they asked for by not ticking "drop anytime".
 */
function OfferBar({
  listingId,
  maxVolume,
  dropSpot,
}: {
  listingId: string;
  maxVolume: string;
  dropSpot: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<OfferState, FormData>(
    offerDrop.bind(null, listingId),
    {},
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const sent = Boolean(state.dropId);

  return (
    <>
      <div className="actionbar">
        <div className="actionbar-in">
          {sent ? (
            <button className="btn btn-ghost btn-block" disabled>
              Asked — waiting on the gardener
            </button>
          ) : (
            <button className="btn btn-green btn-block" onClick={() => setOpen(true)}>
              Ask to drop here
            </button>
          )}
        </div>
      </div>

      {open && !sent && (
        <div
          className="scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <form className="modal" action={action}>
            <h3>Ask to drop here</h3>
            <p>
              This gardener wants to approve first. We&apos;ll email them your
              details — they only get your address once they say yes.
            </p>

            <label className="label-sm" htmlFor="eta">
              When could you get there?
            </label>
            <select id="eta" name="eta" defaultValue="today" className="place-input">
              {ETA_WINDOW_KEYS.map((k) => (
                <option key={k} value={k}>
                  {ETA_WINDOWS[k].label}
                </option>
              ))}
            </select>

            <label className="label-sm" htmlFor="volumeM3">
              Roughly how much? <span style={{ fontWeight: 400 }}>(m³, optional)</span>
            </label>
            <input
              id="volumeM3"
              name="volumeM3"
              type="number"
              step="0.5"
              min="0"
              max="50"
              placeholder="6"
              className="place-input"
            />

            <div className="modal-check">
              <div>
                <Icon.check />
                <span>
                  They&apos;ll take <strong>{maxVolume}</strong>, tipped {dropSpot}.
                </span>
              </div>
              <div>
                <Icon.check />
                <span>
                  If they don&apos;t answer in time the request lapses on its own.
                </span>
              </div>
            </div>

            {state.error && <p className="modal-error">{state.error}</p>}

            <div className="modal-actions">
              <SendButton />
              <button type="button" className="btn btn-ghost btn-block" onClick={() => setOpen(false)}>
                Not now
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-green btn-block" disabled={pending}>
      {pending ? "Sending…" : "Send the request"}
    </button>
  );
}
