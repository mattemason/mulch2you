"use client";

import { useState, useTransition } from "react";
import { testGeocoder, type GeocoderTest } from "./actions";

/**
 * Runs a real address lookup on demand and shows the provider's own error.
 *
 * Users get a deliberately vague "temporarily unavailable" — they can't act on
 * anything more. Admins can: nearly every failure here is a missing API
 * enablement, an unattached billing account, or a key restriction, and the
 * provider says exactly which. Without this the only clue is a Railway log.
 */
export function Diagnostics() {
  const [result, setResult] = useState<GeocoderTest | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="mt-10">
      <h2 className="font-semibold">Diagnostics</h2>
      <p className="mt-1 text-sm text-muted">
        Runs a live address lookup and reports what the provider actually said.
      </p>

      <button
        type="button"
        onClick={() => start(async () => setResult(await testGeocoder()))}
        disabled={pending}
        className="btn-secondary mt-4"
      >
        {pending ? "Testing…" : "Test address lookup"}
      </button>

      {result && (
        <div className="card mt-4">
          <div className="flex items-center gap-2">
            <span aria-hidden>{result.ok ? "✅" : "❌"}</span>
            <span className="font-medium">
              {result.ok
                ? `${result.provider} returned ${result.count} suggestion${result.count === 1 ? "" : "s"}`
                : `${result.provider} lookup failed`}
            </span>
          </div>

          {result.sample && <p className="mt-2 text-sm text-muted">First result: {result.sample}</p>}

          {!result.ok && (
            <>
              <p className="mt-2 text-sm">{result.summary}</p>
              {result.detail && (
                <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs">
                  {result.detail}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
