"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({
  role,
  defaultName,
}: {
  role: "receiver" | "supplier";
  defaultName: string;
}) {
  const [state, action] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="role" value={role} />

      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" defaultValue={defaultName} required className="field" />
      </div>

      {role === "supplier" && (
        <>
          <div>
            <label className="label" htmlFor="businessName">
              Business name
            </label>
            <input id="businessName" name="businessName" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Mobile
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0412 345 678"
              required
              className="field"
            />
            <p className="mt-1 text-xs text-muted">
              We text you when someone accepts a drop.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="abn">
              ABN <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="abn" name="abn" inputMode="numeric" className="field" />
          </div>
          <div>
            <label className="label" htmlFor="website">
              Website <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="website"
              name="website"
              inputMode="url"
              placeholder="acmetrees.com.au"
              className="field"
            />
            <p className="mt-1 text-xs text-muted">
              Shown to gardeners, so they can see who&apos;s turning up.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="contactEmail">
              Business email <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              placeholder="office@acmetrees.com.au"
              className="field"
            />
            <p className="mt-1 text-xs text-muted">
              If the office reads mail at a different address to the one you
              sign in with.
            </p>
          </div>
        </>
      )}

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
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}
