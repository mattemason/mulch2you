"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeDrop, type CompleteState } from "../actions";
import { PhotoField } from "@/app/photo-field";

export function CompleteDropForm({ dropId }: { dropId: string }) {
  const [state, action] = useActionState<CompleteState, FormData>(
    completeDrop.bind(null, dropId),
    {},
  );

  return (
    <form action={action} className="mt-5 space-y-5">
      <PhotoField
        name="photo"
        label="Photo of the tipped load"
        hint="Stand back far enough to show the pile and where it's sitting."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="volumeM3">
            Roughly how much? <span className="font-normal text-muted">(m³, optional)</span>
          </label>
          <input
            id="volumeM3"
            name="volumeM3"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            max="50"
            placeholder="6"
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="species">
            What was it? <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="species"
            name="species"
            placeholder="Mixed gum, no palm"
            className="field"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-accent">
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
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Uploading…" : "Mark as delivered"}
    </button>
  );
}
