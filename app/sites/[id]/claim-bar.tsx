"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimListing } from "@/app/drops/actions";
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
  maxVolume,
  excludes,
  dropSpot,
  holdHours,
}: {
  listingId: string;
  preAuthorised: boolean;
  unavailable: boolean;
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
            This site is no longer available
          </button>
        </div>
      </div>
    );
  }

  if (!preAuthorised) {
    return (
      <div className="actionbar">
        <div className="actionbar-in">
          <button className="btn btn-ghost btn-block" disabled>
            Needs the gardener&apos;s approval — that loop lands next
          </button>
        </div>
      </div>
    );
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
