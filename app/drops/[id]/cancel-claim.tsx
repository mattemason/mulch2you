"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { cancelDrop, type CancelState } from "../actions";

/**
 * Releasing a claim.
 *
 * Behind a disclosure rather than beside "Mark as delivered", because the two
 * are opposites and a mis-tap costs someone a delivery. Asking why is
 * optional — a driver in a hurry shouldn't be blocked by a form field — but
 * it's the only way patterns like "gate too narrow" ever become visible.
 */
export function CancelClaim({ dropId, compact = false }: { dropId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<CancelState, FormData>(
    cancelDrop.bind(null, dropId),
    {},
  );

  if (state.ok) {
    return (
      <div className="card mt-4 w-full">
        <h2 className="font-semibold">Claim released</h2>
        <p className="mt-1 text-sm text-muted">
          The pin is back on the map for other crews, and we&apos;ve let the
          gardener know no truck is coming.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "btn-secondary shrink-0 py-2 text-sm text-accent"
            : "mt-6 text-sm text-muted underline underline-offset-4 hover:text-foreground"
        }
      >
        {compact ? "Cancel this drop" : "Can't make this one? Release the claim"}
      </button>
    );
  }

  return (
    <form action={action} className="card mt-4 w-full">
      <h2 className="font-semibold">Release this claim?</h2>
      <p className="mt-1 text-sm text-muted">
        The pin goes back on the map and the gardener is told no truck is
        coming.
      </p>

      <label className="label mt-4" htmlFor="reason">
        Why? <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id="reason"
        name="reason"
        placeholder="Truck filled up elsewhere / couldn't get in the gate"
        className="field"
      />

      {state.error && (
        <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-accent">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Confirm />
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          Keep it
        </button>
      </div>
    </form>
  );
}

function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary text-accent">
      {pending ? "Releasing…" : "Yes, release it"}
    </button>
  );
}
