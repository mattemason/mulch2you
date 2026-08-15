"use client";

import { useState, useTransition } from "react";
import { adminSetListingStatus } from "./actions";

export function ListingStatusButton({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const next = status === "active" ? "paused" : "active";

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={() =>
          start(async () => {
            const res = await adminSetListingStatus(listingId, next);
            setError(res.error ?? null);
          })
        }
        disabled={pending}
        className="btn-secondary py-2 text-sm"
      >
        {pending ? "Working…" : next === "paused" ? "Pause" : "Reactivate"}
      </button>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}
