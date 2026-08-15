"use client";

import { useState, useTransition } from "react";
import { approveSupplier, revokeSupplier } from "./actions";

export function ApprovalButton({ userId, approved }: { userId: string; approved: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function run() {
    setMessage(null);
    start(async () => {
      const res = approved ? await revokeSupplier(userId) : await approveSupplier(userId);
      setIsError(Boolean(res.error));
      setMessage(res.error ?? res.ok ?? null);
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={approved ? "btn-secondary py-2 text-sm" : "btn-primary py-2 text-sm"}
      >
        {pending ? "Working…" : approved ? "Revoke access" : "Approve"}
      </button>
      {message && (
        <p className={`mt-1.5 text-xs ${isError ? "text-accent" : "text-muted"}`}>{message}</p>
      )}
    </div>
  );
}
