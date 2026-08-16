"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveListingPhoto, type PhotoState } from "../actions";
import { PhotoField } from "@/app/photo-field";
import { Photo } from "@/app/photo";

/**
 * The drop-spot photo, after the listing exists.
 *
 * The picker stays closed until asked for. Showing it open alongside the
 * current photo put two images on screen at once, which reads as "which of
 * these is live?" — and most visits here aren't to change the photo at all.
 */
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
  // Saving changes currentPhotoKey, and the page keys this component on it —
  // so a successful save remounts us with the picker shut and the preview
  // cleared. No effect needed, and no way to end up showing two photos.
  const [picking, setPicking] = useState(!currentPhotoKey);

  return (
    <div className="mt-3">
      {currentPhotoKey && (
        <Photo
          src={`/api/photos/${currentPhotoKey}`}
          alt="The spot you've asked drivers to tip on"
          className="w-full rounded-xl border border-border"
          missingLabel="The photo file is missing — add it again below."
        />
      )}

      {!picking ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setPicking(true)} className="btn-secondary">
            {currentPhotoKey ? "Change photo" : "Add a photo"}
          </button>
          {currentPhotoKey && (
            <form action={action}>
              <input type="hidden" name="remove" value="yes" />
              <RemoveButton />
            </form>
          )}
        </div>
      ) : (
        <form action={action} className="mt-4">
          <PhotoField
            name="photo"
            label={currentPhotoKey ? "New photo" : "Photo of the spot"}
            hint="Stand where the truck would park and shoot towards the spot, so a driver can see the width, the surface and anything overhead. It's the thing they check before committing."
          />

          {state.error && (
            <p className="mt-3 rounded-lg border border-border bg-card p-3 text-sm text-accent">
              {state.error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <SaveButton label={currentPhotoKey ? "Save new photo" : "Save photo"} />
            {currentPhotoKey && (
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : label}
    </button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-secondary text-accent">
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
