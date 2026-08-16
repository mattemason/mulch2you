"use client";

import { useState, useTransition } from "react";
import { respondToOffer } from "@/app/drops/actions";

export function RespondButtons({ token, crew }: { token: string; crew: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; ok?: "accepted" | "declined" } | null>(
    null,
  );

  function answer(choice: "accept" | "decline") {
    setResult(null);
    start(async () => setResult(await respondToOffer(token, choice)));
  }

  if (result?.ok === "accepted") {
    return (
      <div className="card mt-6 border-brand">
        <h2 className="font-semibold">You&apos;re on</h2>
        <p className="mt-1 text-sm text-muted">
          {crew} has your address and will be in touch. Once they&apos;ve tipped
          the load they&apos;ll photograph it, and you confirm it arrived — that
          confirmation is what triggers the charge.
        </p>
      </div>
    );
  }

  if (result?.ok === "declined") {
    return (
      <div className="card mt-6">
        <h2 className="font-semibold">Told them no</h2>
        <p className="mt-1 text-sm text-muted">
          They&apos;ll look elsewhere, and they never got your address. Your pin
          is still on the map for other crews.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => answer("accept")}
          disabled={pending}
          className="btn-primary"
        >
          {pending ? "Just a sec…" : "Yes, send it over"}
        </button>
        <button
          type="button"
          onClick={() => answer("decline")}
          disabled={pending}
          className="btn-secondary"
        >
          No thanks
        </button>
      </div>
      {result?.error && (
        <p className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {result.error}
        </p>
      )}
    </>
  );
}
