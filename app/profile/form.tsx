"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveProfile, type ProfileState } from "./actions";

export function ProfileForm({
  role,
  defaults,
}: {
  role: "receiver" | "supplier" | "admin";
  defaults: {
    name: string;
    phone: string;
    businessName: string;
    abn: string;
    truckCapacityM3: string;
  };
}) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfile, {});
  const isSupplier = role === "supplier";

  return (
    <form action={action} className="mt-3 space-y-4">
      <Field label="Your name" name="name" defaultValue={defaults.name} required />

      {isSupplier && (
        <Field
          label="Business name"
          name="businessName"
          defaultValue={defaults.businessName}
          hint="What gardeners see when you claim a drop."
          required
        />
      )}

      <Field
        label={isSupplier ? "Mobile" : "Mobile (optional)"}
        name="phone"
        type="tel"
        defaultValue={defaults.phone}
        hint={
          isSupplier
            ? "Gardeners get this when they accept your drop, so they can ring if you're hard to find."
            : "Only shared with a crew once you've accepted their drop. Leave blank if you'd rather stick to email."
        }
        required={isSupplier}
      />

      {isSupplier && (
        <>
          <Field
            label="ABN"
            name="abn"
            defaultValue={defaults.abn}
            hint="Used to verify you're a real tree service. Not shown to gardeners."
          />
          <Field
            label="Truck capacity (m³)"
            name="truckCapacityM3"
            type="number"
            defaultValue={defaults.truckCapacityM3}
            hint="Roughly what a full load is for you. Helps us stop suggesting pins that can't take it."
          />
        </>
      )}

      {state.error && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-accent">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg border border-brand bg-card p-3 text-sm text-brand">{state.ok}</p>
      )}

      <Save />
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="field"
      />
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
