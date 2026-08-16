"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveListingPhoto, type PhotoState } from "../actions";
import { PhotoField } from "@/app/photo-field";

export function ListingPhotoForm({
  listingId,
  currentPhotoKey,
}: {
  listingId: string;
  currentPhotoKey: string | null;
}) {
  const [state, action] = useActionState<PhotoState, FormData>(
    saveListingPhoto.bind(null, listingId),
    {},
  );

  return (
    <form action={action} className="mt-3">
      {currentPhotoKey && (
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/photos/${currentPhotoKey}`}
            alt="The spot you've asked drivers to tip on"
            className="w-full rounded-xl border border-border"
          />
        </div>
      )}

      <PhotoField
        name="photo"
        label={currentPhotoKey ? "Replace it" : "Add a photo"}
        hint="Stand where the truck would park and shoot towards the spot, so a driver can see the width, the surface and anything overhead. It's the thing they check before committing."
      />

      {state.error && (
        <p className="mt-3 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="mt-3 rounded-lg border border-brand bg-card p-3 text-sm text-brand">
          {state.ok}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Save label={currentPhotoKey ? "Save new photo" : "Save photo"} />
        {currentPhotoKey && (
          <button
            type="submit"
            name="remove"
            value="yes"
            formNoValidate
            className="btn-secondary text-accent"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : label}
    </button>
  );
}
