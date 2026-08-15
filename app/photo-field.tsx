"use client";

import { useId, useRef, useState } from "react";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Photo picker that downscales in the browser before upload.
 *
 * A driver standing in a front yard on patchy 4G won't wait for a 6 MB phone
 * photo to upload, and neither will a gardener. Drawing to a canvas and
 * re-encoding cuts it to a few hundred KB — and strips EXIF as a side effect,
 * though the server strips it again because anything client-side can be
 * bypassed.
 *
 * The file input stays mounted at all times: swapping it for a preview would
 * discard the FileList we just assigned to it.
 */
export function PhotoField({
  name,
  label,
  hint,
}: {
  name: string;
  label: string;
  hint?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const shrunk = await downscale(file);
      // Swap the input's FileList for the smaller version so the ordinary form
      // submit carries the shrunk blob rather than the original.
      const dt = new DataTransfer();
      dt.items.add(shrunk);
      if (inputRef.current) inputRef.current.files = dt.files;

      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(shrunk);
      });
    } catch {
      setError("Couldn't read that photo. Try another one.");
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  return (
    <div>
      <span className="label">{label}</span>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        onChange={onPick}
        className="sr-only"
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected photo" className="block max-h-64 w-full object-cover" />
          <div className="absolute right-2 top-2 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="rounded-lg bg-black/70 px-3 py-1.5 text-sm font-medium text-white"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center"
        >
          <span className="text-2xl" aria-hidden>
            📷
          </span>
          <span className="text-sm font-medium">
            {busy ? "Processing…" : "Take or choose a photo"}
          </span>
          <span className="text-xs text-muted">JPEG, PNG or HEIC</span>
        </label>
      )}

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}
    </div>
  );
}

async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", QUALITY),
  );
  if (!blob) throw new Error("encode failed");

  return new File([blob], "photo.webp", { type: "image/webp" });
}
