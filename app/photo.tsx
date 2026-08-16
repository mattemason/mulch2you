"use client";

import { useState } from "react";

/**
 * An uploaded photo that copes with the file being gone.
 *
 * The key lives in the database and the bytes live on disk, so the two can
 * disagree — most obviously when a deploy replaces a container whose uploads
 * weren't on a mounted volume. A broken-image icon reads as "this app is
 * broken"; saying what happened reads as a thing to fix.
 */
export function Photo({
  src,
  alt,
  className = "",
  missingLabel = "This photo is no longer available.",
}: {
  src: string;
  alt: string;
  className?: string;
  missingLabel?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted ${className}`}
      >
        {missingLabel}
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
